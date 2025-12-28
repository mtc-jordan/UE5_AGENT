"""
Agent Relay Service for UE5 AI Studio.

WebSocket server that handles connections from desktop agents.
Implements JWT authentication and manages agent-to-cloud communication.

Architecture:
┌─────────────────────────────────────────────────────────────────┐
│                    UE5 AI Studio Cloud                          │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────────────┐ │
│  │   Web UI    │───▶│   Backend   │◀──▶│  Agent Relay        │ │
│  │  (React)    │    │  (FastAPI)  │    │  (WebSocket Server) │ │
│  └─────────────┘    └─────────────┘    └──────────┬──────────┘ │  
└──────────────────────────────────────────────────│─────────────┘
                                                    │
                                                    │ WebSocket
                                                    │ (JWT Auth)
                                                    ▼
                              UE5 AI Studio Agent (Electron)
"""

import asyncio
import json
import logging
import secrets
from datetime import datetime, timedelta
from typing import Dict, Set, Optional, Any, List, Callable
from dataclasses import dataclass, field
from enum import Enum
from fastapi import WebSocket, WebSocketDisconnect, HTTPException, status
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_

from core.config import settings
from core.database import async_session

logger = logging.getLogger(__name__)

# Password hashing for token storage
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


class AgentEventType(str, Enum):
    """Agent WebSocket event types."""
    # Connection events
    CONNECT = "connect"
    DISCONNECT = "disconnect"
    AUTH_SUCCESS = "auth_success"
    AUTH_FAILED = "auth_failed"
    HEARTBEAT = "heartbeat"
    HEARTBEAT_ACK = "heartbeat_ack"
    ERROR = "error"
    
    # MCP status events
    MCP_CONNECTED = "mcp_connected"
    MCP_DISCONNECTED = "mcp_disconnected"
    MCP_STATUS = "mcp_status"
    
    # Tool execution events
    EXECUTE_TOOL = "execute_tool"
    TOOL_RESULT = "tool_result"
    TOOL_ERROR = "tool_error"
    
    # Project info events
    PROJECT_INFO = "project_info"
    PROJECT_UPDATE = "project_update"
    
    # Agent info events
    AGENT_INFO = "agent_info"
    AGENT_STATUS = "agent_status"


@dataclass
class AgentMessage:
    """Structured agent WebSocket message."""
    type: AgentEventType
    payload: Dict[str, Any] = field(default_factory=dict)
    timestamp: str = field(default_factory=lambda: datetime.utcnow().isoformat())
    request_id: Optional[str] = None
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "type": self.type.value if isinstance(self.type, AgentEventType) else self.type,
            "payload": self.payload,
            "timestamp": self.timestamp,
            "request_id": self.request_id
        }
    
    def to_json(self) -> str:
        return json.dumps(self.to_dict())
    
    @classmethod
    def from_json(cls, data: str) -> "AgentMessage":
        parsed = json.loads(data)
        return cls(
            type=parsed.get("type", "unknown"),
            payload=parsed.get("payload", {}),
            timestamp=parsed.get("timestamp", datetime.utcnow().isoformat()),
            request_id=parsed.get("request_id")
        )


@dataclass
class AgentConnection:
    """Represents an active agent connection."""
    websocket: WebSocket
    user_id: int
    token_id: int
    connection_id: str
    connected_at: datetime = field(default_factory=datetime.utcnow)
    last_heartbeat: datetime = field(default_factory=datetime.utcnow)
    
    # Agent info
    agent_version: Optional[str] = None
    agent_platform: Optional[str] = None
    agent_hostname: Optional[str] = None
    
    # MCP status
    mcp_connected: bool = False
    mcp_host: Optional[str] = None
    mcp_project_name: Optional[str] = None
    mcp_engine_version: Optional[str] = None
    mcp_tools_count: int = 0
    
    # Statistics
    commands_executed: int = 0
    last_command_at: Optional[datetime] = None
    
    # Pending requests (request_id -> asyncio.Future)
    pending_requests: Dict[str, asyncio.Future] = field(default_factory=dict)
    
    def update_heartbeat(self):
        self.last_heartbeat = datetime.utcnow()
    
    def update_mcp_status(
        self,
        connected: bool,
        host: str = None,
        project_name: str = None,
        engine_version: str = None,
        tools_count: int = 0
    ):
        self.mcp_connected = connected
        self.mcp_host = host
        self.mcp_project_name = project_name
        self.mcp_engine_version = engine_version
        self.mcp_tools_count = tools_count
    
    def to_status_dict(self) -> Dict[str, Any]:
        return {
            "connection_id": self.connection_id,
            "connected_at": self.connected_at.isoformat(),
            "last_heartbeat": self.last_heartbeat.isoformat(),
            "agent_version": self.agent_version,
            "agent_platform": self.agent_platform,
            "agent_hostname": self.agent_hostname,
            "mcp_connected": self.mcp_connected,
            "mcp_host": self.mcp_host,
            "mcp_project_name": self.mcp_project_name,
            "mcp_engine_version": self.mcp_engine_version,
            "mcp_tools_count": self.mcp_tools_count,
            "commands_executed": self.commands_executed,
            "last_command_at": self.last_command_at.isoformat() if self.last_command_at else None
        }


class AgentRelayService:
    """
    Agent Relay WebSocket Service.
    
    Manages WebSocket connections from desktop agents, handles authentication,
    and routes messages between the web platform and agents.
    """
    
    def __init__(self):
        # Active agent connections: user_id -> AgentConnection
        self._connections: Dict[int, AgentConnection] = {}
        
        # Connection by connection_id for quick lookup
        self._connections_by_id: Dict[str, AgentConnection] = {}
        
        # Lock for thread-safe operations
        self._lock = asyncio.Lock()
        
        # Heartbeat interval in seconds
        self.heartbeat_interval = 30
        
        # Connection timeout in seconds (no heartbeat)
        self.connection_timeout = 90
        
        # Heartbeat task
        self._heartbeat_task: Optional[asyncio.Task] = None
        
        # Event handlers
        self._handlers: Dict[str, List[Callable]] = {}
    
    async def start(self):
        """Start the agent relay service."""
        self._heartbeat_task = asyncio.create_task(self._heartbeat_loop())
        logger.info("Agent Relay Service started")
    
    async def stop(self):
        """Stop the agent relay service."""
        if self._heartbeat_task:
            self._heartbeat_task.cancel()
            try:
                await self._heartbeat_task
            except asyncio.CancelledError:
                pass
        
        # Close all connections
        async with self._lock:
            for conn in list(self._connections.values()):
                try:
                    await conn.websocket.close()
                except Exception:
                    pass
            self._connections.clear()
            self._connections_by_id.clear()
        
        logger.info("Agent Relay Service stopped")
    
    async def _heartbeat_loop(self):
        """Send heartbeats and check for stale connections."""
        while True:
            try:
                await asyncio.sleep(self.heartbeat_interval)
                
                now = datetime.utcnow()
                stale_connections = []
                
                async with self._lock:
                    for user_id, conn in self._connections.items():
                        # Check for timeout
                        if (now - conn.last_heartbeat).total_seconds() > self.connection_timeout:
                            stale_connections.append(user_id)
                        else:
                            # Send heartbeat
                            try:
                                await conn.websocket.send_json(
                                    AgentMessage(
                                        type=AgentEventType.HEARTBEAT,
                                        payload={"server_time": now.isoformat()}
                                    ).to_dict()
                                )
                            except Exception as e:
                                logger.warning(f"Failed to send heartbeat to user {user_id}: {e}")
                                stale_connections.append(user_id)
                
                # Remove stale connections
                for user_id in stale_connections:
                    await self.disconnect(user_id, reason="timeout")
                    
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Heartbeat loop error: {e}")
    
    def create_agent_jwt(self, user_id: int, token_id: int, expires_hours: int = 24 * 30) -> str:
        """
        Create a JWT token for agent authentication.
        
        Args:
            user_id: The user's ID
            token_id: The agent token's ID
            expires_hours: Token expiration in hours (default 30 days)
        
        Returns:
            JWT token string
        """
        expire = datetime.utcnow() + timedelta(hours=expires_hours)
        payload = {
            "sub": str(user_id),  # Must be string for JWT standard
            "token_id": token_id,
            "type": "agent",
            "exp": expire,
            "iat": datetime.utcnow()
        }
        return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)
    
    def verify_agent_jwt(self, token: str) -> Optional[Dict[str, Any]]:
        """
        Verify an agent JWT token.
        
        Args:
            token: JWT token string
        
        Returns:
            Token payload if valid, None otherwise
        """
        try:
            # Decode without subject validation since we use numeric user IDs
            payload = jwt.decode(
                token,
                settings.JWT_SECRET,
                algorithms=[settings.JWT_ALGORITHM],
                options={"verify_sub": False}  # Skip subject string validation
            )
            
            # Verify it's an agent token
            if payload.get("type") != "agent":
                return None
            
            # Convert sub back to int if it's a string
            if "sub" in payload and isinstance(payload["sub"], str):
                payload["sub"] = int(payload["sub"])
            
            return payload
        except JWTError as e:
            logger.warning(f"JWT verification failed: {e}")
            return None
    
    async def authenticate(
        self,
        websocket: WebSocket,
        token: str
    ) -> Optional[AgentConnection]:
        """
        Authenticate an agent connection using JWT.
        
        Args:
            websocket: The WebSocket connection
            token: JWT token from the agent
        
        Returns:
            AgentConnection if authenticated, None otherwise
        """
        # Verify JWT
        payload = self.verify_agent_jwt(token)
        if not payload:
            await websocket.send_json(
                AgentMessage(
                    type=AgentEventType.AUTH_FAILED,
                    payload={"error": "Invalid or expired token"}
                ).to_dict()
            )
            return None
        
        user_id = payload.get("sub")
        token_id = payload.get("token_id")
        
        if not user_id or not token_id:
            await websocket.send_json(
                AgentMessage(
                    type=AgentEventType.AUTH_FAILED,
                    payload={"error": "Invalid token payload"}
                ).to_dict()
            )
            return None
        
        # Verify token exists and is active in database
        from models.agent_token import AgentToken
        
        async with async_session() as db:
            result = await db.execute(
                select(AgentToken).where(
                    and_(
                        AgentToken.id == token_id,
                        AgentToken.user_id == user_id,
                        AgentToken.is_active == True,
                        AgentToken.is_revoked == False
                    )
                )
            )
            agent_token = result.scalar_one_or_none()
            
            if not agent_token or not agent_token.is_valid():
                await websocket.send_json(
                    AgentMessage(
                        type=AgentEventType.AUTH_FAILED,
                        payload={"error": "Token has been revoked or expired"}
                    ).to_dict()
                )
                return None
            
            # Update token usage
            agent_token.update_usage()
            await db.commit()
        
        # Generate connection ID
        connection_id = secrets.token_urlsafe(16)
        
        # Create connection
        connection = AgentConnection(
            websocket=websocket,
            user_id=user_id,
            token_id=token_id,
            connection_id=connection_id
        )
        
        # Store connection
        async with self._lock:
            # Close existing connection if user reconnects
            if user_id in self._connections:
                old_conn = self._connections[user_id]
                try:
                    await old_conn.websocket.send_json(
                        AgentMessage(
                            type=AgentEventType.DISCONNECT,
                            payload={"reason": "New connection established"}
                        ).to_dict()
                    )
                    await old_conn.websocket.close()
                except Exception:
                    pass
                if old_conn.connection_id in self._connections_by_id:
                    del self._connections_by_id[old_conn.connection_id]
            
            self._connections[user_id] = connection
            self._connections_by_id[connection_id] = connection
        
        # Send auth success
        await websocket.send_json(
            AgentMessage(
                type=AgentEventType.AUTH_SUCCESS,
                payload={
                    "connection_id": connection_id,
                    "user_id": user_id,
                    "heartbeat_interval": self.heartbeat_interval
                }
            ).to_dict()
        )
        
        logger.info(f"Agent authenticated for user {user_id}, connection_id: {connection_id}")
        
        # Notify handlers
        await self._emit("connect", connection)
        
        return connection
    
    async def disconnect(self, user_id: int, reason: str = "disconnected"):
        """Disconnect an agent."""
        async with self._lock:
            if user_id not in self._connections:
                return
            
            connection = self._connections[user_id]
            connection_id = connection.connection_id
            
            # Remove from maps
            del self._connections[user_id]
            if connection_id in self._connections_by_id:
                del self._connections_by_id[connection_id]
        
        # Try to send disconnect message
        try:
            await connection.websocket.send_json(
                AgentMessage(
                    type=AgentEventType.DISCONNECT,
                    payload={"reason": reason}
                ).to_dict()
            )
            await connection.websocket.close()
        except Exception:
            pass
        
        logger.info(f"Agent disconnected for user {user_id}, reason: {reason}")
        
        # Update database
        from models.agent_token import AgentConnection as AgentConnectionModel
        
        async with async_session() as db:
            result = await db.execute(
                select(AgentConnectionModel).where(
                    AgentConnectionModel.connection_id == connection_id
                )
            )
            db_conn = result.scalar_one_or_none()
            if db_conn:
                db_conn.disconnect()
                await db.commit()
        
        # Notify handlers
        await self._emit("disconnect", connection)
    
    async def handle_message(self, connection: AgentConnection, message: AgentMessage):
        """Handle an incoming message from an agent."""
        connection.update_heartbeat()
        
        if message.type == AgentEventType.HEARTBEAT_ACK:
            # Heartbeat acknowledgment
            pass
        
        elif message.type == "heartbeat" or message.type == AgentEventType.HEARTBEAT:
            # Heartbeat from agent - may include UE5 status
            payload = message.payload
            ue5_status = payload.get("ue5_status")
            
            if ue5_status:
                was_connected = connection.mcp_connected
                is_connected = ue5_status == "connected"
                
                # Only update if status changed
                if was_connected != is_connected:
                    connection.update_mcp_status(connected=is_connected)
                    await self._update_connection_in_db(connection)
                    
                    if is_connected:
                        logger.info(f"Agent MCP connected for user {connection.user_id} via heartbeat")
                    else:
                        logger.info(f"Agent MCP disconnected for user {connection.user_id} via heartbeat")
            
            # Send heartbeat ack
            await connection.websocket.send_json(
                AgentMessage(
                    type=AgentEventType.HEARTBEAT_ACK,
                    payload={"server_time": datetime.utcnow().isoformat()}
                ).to_dict()
            )
        
        elif message.type == AgentEventType.MCP_CONNECTED:
            # Agent connected to MCP server
            payload = message.payload
            connection.update_mcp_status(
                connected=True,
                host=payload.get("host"),
                project_name=payload.get("project_name"),
                engine_version=payload.get("engine_version"),
                tools_count=payload.get("tools_count", 0)
            )
            
            # Update database
            await self._update_connection_in_db(connection)
            
            # Notify handlers
            await self._emit("mcp_connected", connection)
            
            logger.info(f"Agent MCP connected for user {connection.user_id}: {payload.get('project_name')}")
        
        elif message.type == AgentEventType.MCP_DISCONNECTED:
            # Agent disconnected from MCP server
            connection.update_mcp_status(connected=False)
            
            # Update database
            await self._update_connection_in_db(connection)
            
            # Notify handlers
            await self._emit("mcp_disconnected", connection)
            
            logger.info(f"Agent MCP disconnected for user {connection.user_id}")
        
        elif message.type == AgentEventType.TOOL_RESULT or message.type == "tool_result":
            # Tool execution result
            request_id = message.request_id
            logger.info(f"Received tool_result: request_id={request_id}, payload={message.payload}")
            if request_id and request_id in connection.pending_requests:
                future = connection.pending_requests.pop(request_id)
                if not future.done():
                    # Extract result from payload if nested
                    result = message.payload.get("result", message.payload)
                    future.set_result(result)
        
        elif message.type == AgentEventType.TOOL_ERROR or message.type == "tool_error":
            # Tool execution error
            request_id = message.request_id
            logger.info(f"Received tool_error: request_id={request_id}, payload={message.payload}")
            if request_id and request_id in connection.pending_requests:
                future = connection.pending_requests.pop(request_id)
                if not future.done():
                    future.set_exception(
                        Exception(message.payload.get("error", "Unknown error"))
                    )
        
        elif message.type == AgentEventType.AGENT_INFO:
            # Agent info update
            payload = message.payload
            connection.agent_version = payload.get("version")
            connection.agent_platform = payload.get("platform")
            connection.agent_hostname = payload.get("hostname")
            
            # Update database
            await self._update_connection_in_db(connection)
        
        elif message.type == AgentEventType.PROJECT_INFO:
            # Project info from UE5
            await self._emit("project_info", connection, message.payload)
        
        elif message.type == "status_update" or message.type == AgentEventType.AGENT_STATUS:
            # Status update from agent (includes MCP connection status)
            payload = message.payload
            ue5_status = payload.get("ue5_status", "disconnected")
            logger.info(f"Received status_update: ue5_status={ue5_status}, payload={payload}")
            
            if ue5_status == "connected":
                connection.update_mcp_status(
                    connected=True,
                    host=payload.get("mcp_host"),
                    tools_count=len(payload.get("available_tools", []))
                )
                logger.info(f"Agent MCP connected for user {connection.user_id} via status_update")
            else:
                connection.update_mcp_status(connected=False)
                logger.info(f"Agent MCP disconnected for user {connection.user_id} via status_update")
            
            # Update database
            await self._update_connection_in_db(connection)
            
            # Notify handlers
            if ue5_status == "connected":
                await self._emit("mcp_connected", connection)
            else:
                await self._emit("mcp_disconnected", connection)
    
    async def execute_tool(
        self,
        user_id: int,
        tool_name: str,
        parameters: Dict[str, Any],
        timeout: float = 30.0
    ) -> Dict[str, Any]:
        """
        Execute an MCP tool through the agent.
        
        Args:
            user_id: The user's ID
            tool_name: Name of the MCP tool to execute
            parameters: Tool parameters
            timeout: Execution timeout in seconds
        
        Returns:
            Tool execution result
        
        Raises:
            HTTPException: If agent not connected or execution fails
        """
        connection = self._connections.get(user_id)
        
        if not connection:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Agent not connected"
            )
        
        if not connection.mcp_connected:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Agent not connected to UE5 MCP server"
            )
        
        # Generate request ID
        request_id = secrets.token_urlsafe(16)
        
        # Create future for response
        future = asyncio.get_event_loop().create_future()
        connection.pending_requests[request_id] = future
        
        try:
            # Send execute command
            await connection.websocket.send_json(
                AgentMessage(
                    type=AgentEventType.EXECUTE_TOOL,
                    payload={
                        "tool_name": tool_name,
                        "parameters": parameters
                    },
                    request_id=request_id
                ).to_dict()
            )
            
            # Wait for result
            result = await asyncio.wait_for(future, timeout=timeout)
            
            # Update statistics
            connection.commands_executed += 1
            connection.last_command_at = datetime.utcnow()
            
            return result
            
        except asyncio.TimeoutError:
            connection.pending_requests.pop(request_id, None)
            raise HTTPException(
                status_code=status.HTTP_504_GATEWAY_TIMEOUT,
                detail=f"Tool execution timed out after {timeout}s"
            )
        except Exception as e:
            connection.pending_requests.pop(request_id, None)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=str(e)
            )
    
    def get_connection(self, user_id: int) -> Optional[AgentConnection]:
        """Get an agent connection by user ID."""
        return self._connections.get(user_id)
    
    def is_agent_connected(self, user_id: int) -> bool:
        """Check if an agent is connected for the given user."""
        return user_id in self._connections
    
    def is_mcp_connected(self, user_id: int) -> bool:
        """Check if MCP is connected for the given user's agent."""
        connection = self._connections.get(user_id)
        if not connection:
            return False
        return connection.mcp_connected
    
    def get_connection_status(self, user_id: int) -> Dict[str, Any]:
        """Get the connection status for a user."""
        connection = self._connections.get(user_id)
        
        if not connection:
            return {
                "connected": False,
                "mcp_connected": False
            }
        
        return {
            "connected": True,
            **connection.to_status_dict()
        }
    
    def get_all_connections(self) -> List[Dict[str, Any]]:
        """Get all active connections (admin only)."""
        return [
            {"user_id": user_id, **conn.to_status_dict()}
            for user_id, conn in self._connections.items()
        ]
    
    @property
    def connection_count(self) -> int:
        """Get the number of active connections."""
        return len(self._connections)
    
    async def _update_connection_in_db(self, connection: AgentConnection):
        """Update connection info in database."""
        from models.agent_token import AgentConnection as AgentConnectionModel
        
        async with async_session() as db:
            result = await db.execute(
                select(AgentConnectionModel).where(
                    AgentConnectionModel.connection_id == connection.connection_id
                )
            )
            db_conn = result.scalar_one_or_none()
            
            if db_conn:
                db_conn.agent_version = connection.agent_version
                db_conn.agent_platform = connection.agent_platform
                db_conn.agent_hostname = connection.agent_hostname
                db_conn.update_mcp_status(
                    connected=connection.mcp_connected,
                    host=connection.mcp_host,
                    project_name=connection.mcp_project_name,
                    engine_version=connection.mcp_engine_version
                )
                await db.commit()
            else:
                # Create new connection record
                db_conn = AgentConnectionModel(
                    user_id=connection.user_id,
                    token_id=connection.token_id,
                    connection_id=connection.connection_id,
                    agent_version=connection.agent_version,
                    agent_platform=connection.agent_platform,
                    agent_hostname=connection.agent_hostname,
                    mcp_connected=connection.mcp_connected,
                    mcp_host=connection.mcp_host,
                    mcp_project_name=connection.mcp_project_name,
                    mcp_engine_version=connection.mcp_engine_version
                )
                db.add(db_conn)
                await db.commit()
    
    def on(self, event: str, handler: Callable):
        """Register an event handler."""
        if event not in self._handlers:
            self._handlers[event] = []
        self._handlers[event].append(handler)
    
    async def _emit(self, event: str, *args, **kwargs):
        """Emit an event to all registered handlers."""
        if event in self._handlers:
            for handler in self._handlers[event]:
                try:
                    if asyncio.iscoroutinefunction(handler):
                        await handler(*args, **kwargs)
                    else:
                        handler(*args, **kwargs)
                except Exception as e:
                    logger.error(f"Event handler error for {event}: {e}")


# Global instance
agent_relay = AgentRelayService()


def get_agent_relay() -> AgentRelayService:
    """Get the global agent relay service instance."""
    return agent_relay
