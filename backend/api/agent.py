"""
Agent API Endpoints for UE5 AI Studio.

Handles agent token management, connection status, and tool execution.
"""

from fastapi import APIRouter, Depends, HTTPException, status, WebSocket, WebSocketDisconnect, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime, timedelta
from passlib.context import CryptContext

from core.database import get_db
from services.auth import get_current_user
from services.agent_relay import agent_relay, AgentMessage, AgentEventType
from models.user import User
from models.agent_token import AgentToken, AgentConnection

router = APIRouter(prefix="/agent", tags=["Agent"])

# Password hashing for token storage
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


# ==================== SCHEMAS ====================

class CreateTokenRequest(BaseModel):
    """Request to create a new agent token."""
    name: str = Field(..., min_length=1, max_length=128, description="Token name")
    description: Optional[str] = Field(None, max_length=500, description="Token description")
    expires_days: Optional[int] = Field(None, ge=1, le=365, description="Expiration in days (null = never)")


class CreateTokenResponse(BaseModel):
    """Response with the created token (only shown once)."""
    id: int
    name: str
    token: str  # Full token - only shown once!
    token_prefix: str
    expires_at: Optional[str]
    created_at: str


class TokenInfo(BaseModel):
    """Token information (without the actual token)."""
    id: int
    name: str
    token_prefix: str
    description: Optional[str]
    is_active: bool
    is_revoked: bool
    last_used_at: Optional[str]
    last_ip: Optional[str]
    expires_at: Optional[str]
    created_at: str


class ConnectionStatus(BaseModel):
    """Agent connection status."""
    connected: bool
    connection_id: Optional[str] = None
    connected_at: Optional[str] = None
    agent_version: Optional[str] = None
    agent_platform: Optional[str] = None
    agent_hostname: Optional[str] = None
    mcp_connected: bool = False
    mcp_host: Optional[str] = None
    mcp_project_name: Optional[str] = None
    mcp_engine_version: Optional[str] = None
    mcp_tools_count: int = 0
    commands_executed: int = 0
    last_command_at: Optional[str] = None


class ExecuteToolRequest(BaseModel):
    """Request to execute an MCP tool."""
    tool_name: str = Field(..., description="Name of the MCP tool")
    parameters: Dict[str, Any] = Field(default_factory=dict, description="Tool parameters")
    timeout: float = Field(30.0, ge=1, le=300, description="Execution timeout in seconds")


class ExecuteToolResponse(BaseModel):
    """Response from tool execution."""
    success: bool
    result: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
    execution_time_ms: float


# ==================== TOKEN MANAGEMENT ====================

@router.post("/tokens", response_model=CreateTokenResponse)
async def create_agent_token(
    request: CreateTokenRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Create a new agent token.
    
    The token is only shown once in the response. Store it securely!
    """
    # Generate token
    raw_token = AgentToken.generate_token()
    token_hash = pwd_context.hash(raw_token)
    token_prefix = AgentToken.get_token_prefix(raw_token)
    
    # Calculate expiration
    expires_at = None
    if request.expires_days:
        expires_at = datetime.utcnow() + timedelta(days=request.expires_days)
    
    # Create token record
    agent_token = AgentToken(
        user_id=current_user.id,
        name=request.name,
        description=request.description,
        token_hash=token_hash,
        token_prefix=token_prefix,
        expires_at=expires_at
    )
    
    db.add(agent_token)
    await db.commit()
    await db.refresh(agent_token)
    
    # Create JWT for the agent
    jwt_token = agent_relay.create_agent_jwt(current_user.id, agent_token.id)
    
    return CreateTokenResponse(
        id=agent_token.id,
        name=agent_token.name,
        token=jwt_token,  # This is the JWT the agent will use
        token_prefix=token_prefix,
        expires_at=expires_at.isoformat() if expires_at else None,
        created_at=agent_token.created_at.isoformat()
    )


@router.get("/tokens", response_model=List[TokenInfo])
async def list_agent_tokens(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """List all agent tokens for the current user."""
    result = await db.execute(
        select(AgentToken).where(
            AgentToken.user_id == current_user.id
        ).order_by(AgentToken.created_at.desc())
    )
    tokens = result.scalars().all()
    
    return [
        TokenInfo(
            id=t.id,
            name=t.name,
            token_prefix=t.token_prefix,
            description=t.description,
            is_active=t.is_active,
            is_revoked=t.is_revoked,
            last_used_at=t.last_used_at.isoformat() if t.last_used_at else None,
            last_ip=t.last_ip,
            expires_at=t.expires_at.isoformat() if t.expires_at else None,
            created_at=t.created_at.isoformat()
        )
        for t in tokens
    ]


@router.delete("/tokens/{token_id}")
async def revoke_agent_token(
    token_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Revoke an agent token."""
    result = await db.execute(
        select(AgentToken).where(
            and_(
                AgentToken.id == token_id,
                AgentToken.user_id == current_user.id
            )
        )
    )
    token = result.scalar_one_or_none()
    
    if not token:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Token not found"
        )
    
    token.revoke()
    await db.commit()
    
    # Disconnect agent if connected with this token
    connection = agent_relay.get_connection(current_user.id)
    if connection and connection.token_id == token_id:
        await agent_relay.disconnect(current_user.id, reason="Token revoked")
    
    return {"message": "Token revoked successfully"}


# ==================== CONNECTION STATUS ====================

@router.get("/status", response_model=ConnectionStatus)
async def get_agent_status(
    current_user: User = Depends(get_current_user)
):
    """Get the current agent connection status."""
    status_data = agent_relay.get_connection_status(current_user.id)
    return ConnectionStatus(**status_data)


@router.get("/connections")
async def list_active_connections(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """List all active agent connections for the current user."""
    result = await db.execute(
        select(AgentConnection).where(
            and_(
                AgentConnection.user_id == current_user.id,
                AgentConnection.status != "disconnected"
            )
        ).order_by(AgentConnection.connected_at.desc())
    )
    connections = result.scalars().all()
    
    return [c.to_dict() for c in connections]


# ==================== TOOL EXECUTION ====================

@router.post("/execute", response_model=ExecuteToolResponse)
async def execute_mcp_tool(
    request: ExecuteToolRequest,
    current_user: User = Depends(get_current_user)
):
    """
    Execute an MCP tool through the connected agent.
    
    Requires an active agent connection with MCP connected.
    """
    import time
    start_time = time.time()
    
    try:
        result = await agent_relay.execute_tool(
            user_id=current_user.id,
            tool_name=request.tool_name,
            parameters=request.parameters,
            timeout=request.timeout
        )
        
        execution_time = (time.time() - start_time) * 1000
        
        return ExecuteToolResponse(
            success=True,
            result=result,
            execution_time_ms=execution_time
        )
        
    except HTTPException as e:
        execution_time = (time.time() - start_time) * 1000
        return ExecuteToolResponse(
            success=False,
            error=e.detail,
            execution_time_ms=execution_time
        )
    except Exception as e:
        execution_time = (time.time() - start_time) * 1000
        return ExecuteToolResponse(
            success=False,
            error=str(e),
            execution_time_ms=execution_time
        )


# ==================== WEBSOCKET ENDPOINT ====================

@router.websocket("/ws")
async def agent_websocket(
    websocket: WebSocket,
    token: str = Query(..., description="JWT token for authentication")
):
    """
    WebSocket endpoint for agent connections.
    
    The agent connects here with a JWT token for authentication.
    After authentication, the agent can send/receive messages for:
    - MCP status updates
    - Tool execution requests/results
    - Project information
    - Heartbeats
    """
    await websocket.accept()
    
    # Authenticate
    connection = await agent_relay.authenticate(websocket, token)
    
    if not connection:
        await websocket.close(code=4001, reason="Authentication failed")
        return
    
    try:
        # Main message loop
        while True:
            try:
                data = await websocket.receive_json()
                message = AgentMessage.from_json(json.dumps(data)) if isinstance(data, dict) else AgentMessage.from_json(data)
                await agent_relay.handle_message(connection, message)
            except json.JSONDecodeError:
                await websocket.send_json(
                    AgentMessage(
                        type=AgentEventType.ERROR,
                        payload={"error": "Invalid JSON"}
                    ).to_dict()
                )
    except WebSocketDisconnect:
        await agent_relay.disconnect(connection.user_id, reason="Client disconnected")
    except Exception as e:
        await agent_relay.disconnect(connection.user_id, reason=f"Error: {str(e)}")


# Import json for WebSocket handler
import json
