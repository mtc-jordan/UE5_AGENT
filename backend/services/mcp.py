"""
UE5 AI Studio - Enhanced MCP Service
=====================================

Model Context Protocol client for UE5 integration with:
- Connection pooling with persistent HTTP sessions
- Automatic reconnection with exponential backoff
- Circuit breaker pattern for fault tolerance
- Thread-safe connection management with lifecycle hooks

Version: 2.0.0
"""

import httpx
import asyncio
import time
import logging
from typing import Optional, List, Dict, Any, Callable, Awaitable, TypeVar
from dataclasses import dataclass, field
from enum import Enum
from contextlib import asynccontextmanager

# Configure logging
logger = logging.getLogger(__name__)

T = TypeVar('T')


# =============================================================================
# CIRCUIT BREAKER PATTERN
# =============================================================================

class CircuitState(Enum):
    """Circuit breaker states."""
    CLOSED = "closed"      # Normal operation - requests allowed
    OPEN = "open"          # Failing - requests rejected
    HALF_OPEN = "half_open"  # Testing recovery - limited requests


@dataclass
class CircuitBreaker:
    """
    Circuit breaker implementation for fault tolerance.
    
    Prevents cascade failures by temporarily blocking requests
    to a failing service, allowing it time to recover.
    """
    failure_threshold: int = 3          # Failures before opening circuit
    recovery_timeout: float = 30.0      # Seconds before testing recovery
    half_open_max_calls: int = 1        # Test calls in half-open state
    
    failure_count: int = field(default=0, init=False)
    success_count: int = field(default=0, init=False)
    last_failure_time: float = field(default=0.0, init=False)
    state: CircuitState = field(default=CircuitState.CLOSED, init=False)
    half_open_calls: int = field(default=0, init=False)
    
    def record_success(self) -> None:
        """Record a successful call."""
        self.failure_count = 0
        self.success_count += 1
        if self.state == CircuitState.HALF_OPEN:
            self.state = CircuitState.CLOSED
            self.half_open_calls = 0
            logger.info("Circuit breaker closed - service recovered")
    
    def record_failure(self) -> None:
        """Record a failed call."""
        self.failure_count += 1
        self.last_failure_time = time.time()
        
        if self.state == CircuitState.HALF_OPEN:
            self.state = CircuitState.OPEN
            self.half_open_calls = 0
            logger.warning("Circuit breaker opened - recovery failed")
        elif self.failure_count >= self.failure_threshold:
            self.state = CircuitState.OPEN
            logger.warning(f"Circuit breaker opened after {self.failure_count} failures")
    
    def can_execute(self) -> bool:
        """Check if a request can be executed."""
        if self.state == CircuitState.CLOSED:
            return True
        
        if self.state == CircuitState.OPEN:
            # Check if recovery timeout has passed
            if time.time() - self.last_failure_time >= self.recovery_timeout:
                self.state = CircuitState.HALF_OPEN
                self.half_open_calls = 0
                logger.info("Circuit breaker half-open - testing recovery")
                return True
            return False
        
        if self.state == CircuitState.HALF_OPEN:
            # Allow limited calls in half-open state
            if self.half_open_calls < self.half_open_max_calls:
                self.half_open_calls += 1
                return True
            return False
        
        return False
    
    def get_status(self) -> Dict[str, Any]:
        """Get circuit breaker status."""
        return {
            "state": self.state.value,
            "failure_count": self.failure_count,
            "success_count": self.success_count,
            "last_failure": self.last_failure_time,
            "can_execute": self.can_execute()
        }


# =============================================================================
# CUSTOM EXCEPTIONS
# =============================================================================

class MCPConnectionError(Exception):
    """Raised when MCP connection fails."""
    pass


class MCPCircuitOpenError(Exception):
    """Raised when circuit breaker is open."""
    pass


class MCPToolError(Exception):
    """Raised when a tool call fails."""
    pass


# =============================================================================
# ENHANCED MCP CLIENT
# =============================================================================

class MCPClient:
    """
    Enhanced Model Context Protocol client for UE5 integration.
    
    Features:
    - Persistent HTTP connection with connection pooling
    - Automatic retry with exponential backoff
    - Circuit breaker for fault tolerance
    - Proper resource cleanup
    """
    
    # Retry configuration
    MAX_RETRIES: int = 3
    BASE_DELAY: float = 1.0  # seconds
    MAX_DELAY: float = 30.0  # seconds
    
    def __init__(self, endpoint: str):
        """
        Initialize MCP client.
        
        Args:
            endpoint: The MCP server endpoint URL
        """
        self.endpoint = endpoint.rstrip("/")
        self.connected = False
        self.available_tools: List[str] = []
        self.server_info: Dict[str, Any] = {}
        
        # Persistent HTTP client (lazy initialized)
        self._http_client: Optional[httpx.AsyncClient] = None
        self._client_lock = asyncio.Lock()
        
        # Circuit breaker for fault tolerance
        self._circuit = CircuitBreaker(
            failure_threshold=3,
            recovery_timeout=30.0,
            half_open_max_calls=1
        )
        
        # Connection metadata
        self._last_connected: Optional[float] = None
        self._connection_attempts: int = 0
        self._total_requests: int = 0
        self._failed_requests: int = 0
    
    async def _get_client(self) -> httpx.AsyncClient:
        """
        Get or create the persistent HTTP client.
        
        Uses double-checked locking for thread safety.
        """
        if self._http_client is None or self._http_client.is_closed:
            async with self._client_lock:
                if self._http_client is None or self._http_client.is_closed:
                    self._http_client = httpx.AsyncClient(
                        timeout=httpx.Timeout(
                            connect=10.0,
                            read=60.0,
                            write=10.0,
                            pool=5.0
                        ),
                        limits=httpx.Limits(
                            max_keepalive_connections=5,
                            max_connections=10,
                            keepalive_expiry=30.0
                        ),
                        http2=True  # Enable HTTP/2 for multiplexing
                    )
                    logger.debug(f"Created new HTTP client for {self.endpoint}")
        return self._http_client
    
    async def _execute_with_retry(
        self,
        operation: Callable[[], Awaitable[T]],
        operation_name: str
    ) -> T:
        """
        Execute an operation with exponential backoff retry.
        
        Args:
            operation: Async callable to execute
            operation_name: Name for logging
            
        Returns:
            Result of the operation
            
        Raises:
            MCPCircuitOpenError: If circuit breaker is open
            MCPConnectionError: If all retries fail
        """
        # Check circuit breaker
        if not self._circuit.can_execute():
            raise MCPCircuitOpenError(
                f"Circuit breaker open for {self.endpoint}. "
                f"Service may be unavailable. Status: {self._circuit.get_status()}"
            )
        
        last_exception: Optional[Exception] = None
        
        for attempt in range(self.MAX_RETRIES):
            try:
                self._total_requests += 1
                result = await operation()
                
                # Success - reset circuit breaker
                self._circuit.record_success()
                return result
                
            except (httpx.ConnectError, httpx.TimeoutException, httpx.HTTPStatusError) as e:
                last_exception = e
                self._failed_requests += 1
                self._circuit.record_failure()
                
                if attempt < self.MAX_RETRIES - 1:
                    # Calculate delay with exponential backoff and jitter
                    delay = min(
                        self.BASE_DELAY * (2 ** attempt),
                        self.MAX_DELAY
                    )
                    # Add jitter (±25%)
                    import random
                    delay *= (0.75 + random.random() * 0.5)
                    
                    logger.warning(
                        f"{operation_name} failed (attempt {attempt + 1}/{self.MAX_RETRIES}): "
                        f"{e}. Retrying in {delay:.2f}s..."
                    )
                    await asyncio.sleep(delay)
                else:
                    logger.error(
                        f"{operation_name} failed after {self.MAX_RETRIES} attempts: {e}"
                    )
            
            except Exception as e:
                # Non-retryable error
                last_exception = e
                self._failed_requests += 1
                logger.error(f"{operation_name} failed with unexpected error: {e}")
                break
        
        raise MCPConnectionError(
            f"{operation_name} failed after {self.MAX_RETRIES} attempts: {last_exception}"
        )
    
    async def connect(self) -> Dict[str, Any]:
        """
        Connect to the MCP server and discover available tools.
        
        Returns:
            Connection result with status, server info, and available tools
        """
        self._connection_attempts += 1
        
        async def _do_connect():
            client = await self._get_client()
            
            # Initialize connection
            init_response = await client.post(
                f"{self.endpoint}/initialize",
                json={
                    "protocolVersion": "2024-11-05",
                    "capabilities": {
                        "tools": {}
                    },
                    "clientInfo": {
                        "name": "UE5 AI Studio",
                        "version": "2.0.0"
                    }
                }
            )
            init_response.raise_for_status()
            init_data = init_response.json()
            
            # List available tools
            tools_response = await client.post(
                f"{self.endpoint}/tools/list",
                json={}
            )
            tools_response.raise_for_status()
            tools_data = tools_response.json()
            
            return init_data, tools_data
        
        try:
            init_data, tools_data = await self._execute_with_retry(
                _do_connect,
                "MCP connection"
            )
            
            self.server_info = init_data.get("serverInfo", {})
            self.available_tools = [
                tool["name"] for tool in tools_data.get("tools", [])
            ]
            self.connected = True
            self._last_connected = time.time()
            
            logger.info(
                f"Connected to MCP server: {self.server_info.get('name', 'unknown')} "
                f"v{self.server_info.get('version', 'unknown')} "
                f"({len(self.available_tools)} tools available)"
            )
            
            return {
                "status": "connected",
                "server_info": self.server_info,
                "available_tools": self.available_tools,
                "tools_count": len(self.available_tools)
            }
            
        except MCPCircuitOpenError as e:
            logger.warning(f"Connection blocked by circuit breaker: {e}")
            return {
                "status": "circuit_open",
                "error": str(e),
                "circuit_status": self._circuit.get_status()
            }
            
        except MCPConnectionError as e:
            self.connected = False
            logger.error(f"Failed to connect to MCP server: {e}")
            return {
                "status": "error",
                "error": str(e),
                "circuit_status": self._circuit.get_status()
            }
            
        except Exception as e:
            self.connected = False
            logger.error(f"Unexpected error during connection: {e}")
            return {
                "status": "error",
                "error": str(e)
            }
    
    async def disconnect(self) -> Dict[str, Any]:
        """
        Disconnect from the MCP server and cleanup resources.
        
        Returns:
            Disconnection status
        """
        async with self._client_lock:
            if self._http_client and not self._http_client.is_closed:
                await self._http_client.aclose()
                self._http_client = None
                logger.debug(f"Closed HTTP client for {self.endpoint}")
        
        self.connected = False
        self.available_tools = []
        
        return {
            "status": "disconnected",
            "stats": {
                "total_requests": self._total_requests,
                "failed_requests": self._failed_requests,
                "connection_attempts": self._connection_attempts
            }
        }
    
    async def call_tool(
        self,
        tool_name: str,
        arguments: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Call a tool on the MCP server.
        
        Args:
            tool_name: Name of the tool to call
            arguments: Tool arguments
            
        Returns:
            Tool execution result
        """
        if not self.connected:
            return {
                "error": "Not connected to MCP server",
                "suggestion": "Call connect() first or check connection status"
            }
        
        if tool_name not in self.available_tools:
            return {
                "error": f"Tool '{tool_name}' not found",
                "available_tools": self.available_tools[:10],  # Show first 10
                "total_tools": len(self.available_tools)
            }
        
        async def _do_call():
            client = await self._get_client()
            response = await client.post(
                f"{self.endpoint}/tools/call",
                json={
                    "name": tool_name,
                    "arguments": arguments
                }
            )
            response.raise_for_status()
            return response.json()
        
        try:
            result = await self._execute_with_retry(
                _do_call,
                f"Tool call: {tool_name}"
            )
            
            logger.debug(f"Tool '{tool_name}' executed successfully")
            return result
            
        except MCPCircuitOpenError as e:
            return {
                "error": "Service temporarily unavailable",
                "details": str(e),
                "circuit_status": self._circuit.get_status()
            }
            
        except MCPConnectionError as e:
            # Mark as disconnected if tool calls fail repeatedly
            self.connected = False
            return {
                "error": str(e),
                "reconnect_required": True
            }
            
        except Exception as e:
            return {"error": str(e)}
    
    def get_status(self) -> Dict[str, Any]:
        """
        Get detailed client status.
        
        Returns:
            Status information including connection state and statistics
        """
        return {
            "endpoint": self.endpoint,
            "connected": self.connected,
            "server_info": self.server_info,
            "tools_count": len(self.available_tools),
            "circuit_breaker": self._circuit.get_status(),
            "stats": {
                "total_requests": self._total_requests,
                "failed_requests": self._failed_requests,
                "success_rate": (
                    (self._total_requests - self._failed_requests) / self._total_requests * 100
                    if self._total_requests > 0 else 0
                ),
                "connection_attempts": self._connection_attempts,
                "last_connected": self._last_connected
            }
        }
    
    # =========================================================================
    # CONVENIENCE METHODS FOR COMMON UE5 OPERATIONS
    # =========================================================================
    
    async def get_actor_list(self) -> Dict[str, Any]:
        """Get list of all actors in the level."""
        return await self.call_tool("get_actor_list", {})
    
    async def spawn_actor(
        self,
        class_name: str,
        x: float = 0.0,
        y: float = 0.0,
        z: float = 0.0
    ) -> Dict[str, Any]:
        """Spawn an actor in the level."""
        return await self.call_tool("spawn_actor", {
            "class_name": class_name,
            "x": x,
            "y": y,
            "z": z
        })
    
    async def delete_actor(self, actor_name: str) -> Dict[str, Any]:
        """Delete an actor by name."""
        return await self.call_tool("delete_actor", {"actor_name": actor_name})
    
    async def get_actor_properties(self, actor_name: str) -> Dict[str, Any]:
        """Get actor location, rotation, scale."""
        return await self.call_tool("get_actor_properties", {"actor_name": actor_name})
    
    async def set_actor_property(
        self,
        actor_name: str,
        property: str,
        x: float,
        y: float,
        z: float
    ) -> Dict[str, Any]:
        """Set actor location, rotation, or scale."""
        return await self.call_tool("set_actor_property", {
            "actor_name": actor_name,
            "property": property,
            "x": x,
            "y": y,
            "z": z
        })
    
    async def create_blueprint(
        self,
        blueprint_name: str,
        parent_class: str,
        path: Optional[str] = None
    ) -> Dict[str, Any]:
        """Create a new Blueprint asset."""
        args = {
            "blueprint_name": blueprint_name,
            "parent_class": parent_class
        }
        if path:
            args["path"] = path
        return await self.call_tool("create_blueprint", args)
    
    async def compile_blueprint(self, blueprint_path: str) -> Dict[str, Any]:
        """Compile a Blueprint."""
        return await self.call_tool("compile_blueprint", {"blueprint_path": blueprint_path})
    
    async def execute_console_command(self, command: str) -> Dict[str, Any]:
        """Execute a console command in the editor."""
        return await self.call_tool("execute_console_command", {"command": command})
    
    async def get_project_info(self) -> Dict[str, Any]:
        """Get project information."""
        return await self.call_tool("get_project_info", {})
    
    async def take_screenshot(self, filename: str) -> Dict[str, Any]:
        """Take a screenshot of the viewport."""
        return await self.call_tool("take_screenshot", {"filename": filename})
    
    async def start_pie(self, mode: str = "SelectedViewport") -> Dict[str, Any]:
        """Start Play In Editor session."""
        return await self.call_tool("start_pie", {"mode": mode})
    
    async def stop_pie(self) -> Dict[str, Any]:
        """Stop Play In Editor session."""
        return await self.call_tool("stop_pie", {})


# =============================================================================
# THREAD-SAFE CONNECTION MANAGER
# =============================================================================

class MCPConnectionManager:
    """
    Thread-safe manager for multiple MCP connections.
    
    Features:
    - Per-connection locking to prevent race conditions
    - Proper lifecycle management with cleanup hooks
    - Connection health monitoring
    """
    
    def __init__(self):
        """Initialize the connection manager."""
        self._connections: Dict[int, MCPClient] = {}
        self._locks: Dict[int, asyncio.Lock] = {}
        self._global_lock = asyncio.Lock()
        self._shutdown_event = asyncio.Event()
        
        logger.info("MCPConnectionManager initialized")
    
    async def _get_lock(self, connection_id: int) -> asyncio.Lock:
        """
        Get or create a lock for a specific connection.
        
        Args:
            connection_id: The connection identifier
            
        Returns:
            asyncio.Lock for the connection
        """
        async with self._global_lock:
            if connection_id not in self._locks:
                self._locks[connection_id] = asyncio.Lock()
            return self._locks[connection_id]
    
    def get_client(self, connection_id: int) -> Optional[MCPClient]:
        """
        Get an existing MCP client.
        
        Args:
            connection_id: The connection identifier
            
        Returns:
            MCPClient if found, None otherwise
        """
        return self._connections.get(connection_id)
    
    async def create_connection(
        self,
        connection_id: int,
        endpoint: str
    ) -> Dict[str, Any]:
        """
        Create and connect a new MCP client with proper locking.
        
        Args:
            connection_id: The connection identifier
            endpoint: The MCP server endpoint URL
            
        Returns:
            Connection result
        """
        lock = await self._get_lock(connection_id)
        
        async with lock:
            # Remove existing connection if any
            if connection_id in self._connections:
                old_client = self._connections[connection_id]
                await old_client.disconnect()
                logger.info(f"Disconnected existing connection {connection_id}")
            
            # Create new client
            client = MCPClient(endpoint)
            result = await client.connect()
            
            if result["status"] == "connected":
                self._connections[connection_id] = client
                logger.info(f"Created connection {connection_id} to {endpoint}")
            else:
                logger.warning(f"Failed to create connection {connection_id}: {result}")
            
            return result
    
    async def remove_connection(self, connection_id: int) -> Dict[str, Any]:
        """
        Safely disconnect and remove an MCP client.
        
        Args:
            connection_id: The connection identifier
            
        Returns:
            Disconnection result
        """
        lock = await self._get_lock(connection_id)
        
        async with lock:
            client = self._connections.pop(connection_id, None)
            if client:
                result = await client.disconnect()
                logger.info(f"Removed connection {connection_id}")
                return result
            return {"status": "not_found"}
    
    async def call_tool(
        self,
        connection_id: int,
        tool_name: str,
        arguments: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Call a tool on a specific connection.
        
        Args:
            connection_id: The connection identifier
            tool_name: Name of the tool to call
            arguments: Tool arguments
            
        Returns:
            Tool execution result
        """
        client = self._connections.get(connection_id)
        if not client:
            return {
                "error": f"Connection {connection_id} not found",
                "suggestion": "Create a connection first"
            }
        
        return await client.call_tool(tool_name, arguments)
    
    def is_connected(self, connection_id: int) -> bool:
        """
        Check if a connection is active.
        
        Args:
            connection_id: The connection identifier
            
        Returns:
            True if connected, False otherwise
        """
        client = self._connections.get(connection_id)
        return client.connected if client else False
    
    def get_connection_status(self, connection_id: int) -> Dict[str, Any]:
        """
        Get detailed status of a connection.
        
        Args:
            connection_id: The connection identifier
            
        Returns:
            Connection status
        """
        client = self._connections.get(connection_id)
        if client:
            return client.get_status()
        return {"error": "Connection not found"}
    
    def get_all_connections(self) -> Dict[int, Dict[str, Any]]:
        """
        Get status of all connections.
        
        Returns:
            Dictionary of connection statuses
        """
        return {
            conn_id: client.get_status()
            for conn_id, client in self._connections.items()
        }
    
    async def health_check(self, connection_id: int) -> Dict[str, Any]:
        """
        Perform a health check on a connection.
        
        Args:
            connection_id: The connection identifier
            
        Returns:
            Health check result
        """
        client = self._connections.get(connection_id)
        if not client:
            return {"healthy": False, "error": "Connection not found"}
        
        if not client.connected:
            return {"healthy": False, "error": "Not connected"}
        
        # Try to get project info as a health check
        try:
            result = await client.get_project_info()
            if "error" in result:
                return {"healthy": False, "error": result["error"]}
            return {"healthy": True, "project_info": result}
        except Exception as e:
            return {"healthy": False, "error": str(e)}
    
    async def reconnect(self, connection_id: int) -> Dict[str, Any]:
        """
        Attempt to reconnect a disconnected connection.
        
        Args:
            connection_id: The connection identifier
            
        Returns:
            Reconnection result
        """
        client = self._connections.get(connection_id)
        if not client:
            return {"error": "Connection not found"}
        
        if client.connected:
            return {"status": "already_connected"}
        
        return await client.connect()
    
    async def shutdown(self) -> None:
        """
        Gracefully close all connections during application shutdown.
        """
        logger.info("Shutting down MCPConnectionManager...")
        self._shutdown_event.set()
        
        async with self._global_lock:
            # Disconnect all clients concurrently
            tasks = [
                client.disconnect()
                for client in self._connections.values()
            ]
            
            if tasks:
                results = await asyncio.gather(*tasks, return_exceptions=True)
                for i, result in enumerate(results):
                    if isinstance(result, Exception):
                        logger.error(f"Error during shutdown: {result}")
            
            self._connections.clear()
            self._locks.clear()
        
        logger.info("MCPConnectionManager shutdown complete")


# =============================================================================
# SINGLETON INSTANCE AND LIFECYCLE MANAGEMENT
# =============================================================================

# Singleton instance
mcp_manager = MCPConnectionManager()


@asynccontextmanager
async def lifespan_manager():
    """
    Context manager for FastAPI lifespan events.
    
    Usage in main.py:
        from services.mcp import lifespan_manager
        
        @asynccontextmanager
        async def lifespan(app: FastAPI):
            async with lifespan_manager():
                yield
        
        app = FastAPI(lifespan=lifespan)
    """
    logger.info("MCP service starting...")
    try:
        yield mcp_manager
    finally:
        await mcp_manager.shutdown()
        logger.info("MCP service stopped")


# =============================================================================
# UTILITY FUNCTIONS
# =============================================================================

async def get_mcp_manager() -> MCPConnectionManager:
    """
    Dependency injection helper for FastAPI.
    
    Usage:
        @router.get("/status")
        async def get_status(manager: MCPConnectionManager = Depends(get_mcp_manager)):
            return manager.get_all_connections()
    """
    return mcp_manager


def get_available_tools() -> List[Dict[str, str]]:
    """
    Get list of all available MCP tools with descriptions.
    
    Returns:
        List of tool definitions
    """
    return [
        # Actor Management
        {"name": "get_actor_list", "category": "Actor", "description": "Get list of all actors in the level"},
        {"name": "spawn_actor", "category": "Actor", "description": "Spawn actor (PointLight, SpotLight, etc.)"},
        {"name": "delete_actor", "category": "Actor", "description": "Delete an actor by name"},
        {"name": "get_actor_properties", "category": "Actor", "description": "Get actor location, rotation, scale"},
        {"name": "set_actor_property", "category": "Actor", "description": "Set actor location, rotation, or scale"},
        {"name": "find_actors_by_class", "category": "Actor", "description": "Find all actors of a specific class"},
        {"name": "find_actors_by_tag", "category": "Actor", "description": "Find all actors with a specific tag"},
        {"name": "find_actors_by_name", "category": "Actor", "description": "Find actors by name pattern"},
        {"name": "duplicate_actor", "category": "Actor", "description": "Duplicate an actor with offset"},
        {"name": "set_actor_visibility", "category": "Actor", "description": "Show or hide an actor"},
        {"name": "snap_actor_to_ground", "category": "Actor", "description": "Snap actor to ground surface"},
        {"name": "rename_actor", "category": "Actor", "description": "Rename an actor's label"},
        {"name": "add_actor_tag", "category": "Actor", "description": "Add a tag to an actor"},
        {"name": "remove_actor_tag", "category": "Actor", "description": "Remove a tag from an actor"},
        {"name": "get_actor_tags", "category": "Actor", "description": "Get all tags assigned to an actor"},
        {"name": "set_actor_mobility", "category": "Actor", "description": "Set mobility (Static, Stationary, Movable)"},
        {"name": "get_actor_mobility", "category": "Actor", "description": "Get current mobility of an actor"},
        {"name": "attach_actor_to_actor", "category": "Actor", "description": "Attach one actor to another"},
        {"name": "detach_actor", "category": "Actor", "description": "Detach an actor from its parent"},
        
        # Selection & Focus
        {"name": "select_actors", "category": "Selection", "description": "Select actors by name"},
        {"name": "get_selected_actors", "category": "Selection", "description": "Get currently selected actors"},
        {"name": "clear_selection", "category": "Selection", "description": "Clear all selected actors"},
        {"name": "focus_on_actor", "category": "Selection", "description": "Focus viewport on an actor"},
        
        # Viewport & Camera
        {"name": "get_viewport_camera", "category": "Viewport", "description": "Get viewport camera position"},
        {"name": "set_viewport_camera", "category": "Viewport", "description": "Set viewport camera position"},
        {"name": "take_screenshot", "category": "Viewport", "description": "Take a screenshot"},
        {"name": "set_view_mode", "category": "Viewport", "description": "Set viewport view mode"},
        {"name": "get_view_mode", "category": "Viewport", "description": "Get current view mode"},
        {"name": "pilot_actor", "category": "Viewport", "description": "Pilot an actor with viewport"},
        {"name": "stop_piloting", "category": "Viewport", "description": "Stop piloting current actor"},
        {"name": "set_viewport_realtime", "category": "Viewport", "description": "Enable/disable realtime rendering"},
        {"name": "set_viewport_stats", "category": "Viewport", "description": "Show/hide viewport statistics"},
        
        # Level Management
        {"name": "get_current_level", "category": "Level", "description": "Get current level information"},
        {"name": "load_level", "category": "Level", "description": "Load a level by path"},
        {"name": "save_level", "category": "Level", "description": "Save the current level"},
        
        # Play In Editor
        {"name": "start_pie", "category": "PIE", "description": "Start Play In Editor session"},
        {"name": "stop_pie", "category": "PIE", "description": "Stop Play In Editor session"},
        
        # Asset Management
        {"name": "search_assets", "category": "Asset", "description": "Search for assets by name/type"},
        {"name": "get_asset_info", "category": "Asset", "description": "Get detailed asset information"},
        {"name": "load_asset", "category": "Asset", "description": "Load an asset into memory"},
        {"name": "duplicate_asset", "category": "Asset", "description": "Duplicate an asset"},
        {"name": "rename_asset", "category": "Asset", "description": "Rename an asset"},
        {"name": "delete_asset", "category": "Asset", "description": "Delete an asset"},
        {"name": "create_folder", "category": "Asset", "description": "Create a content folder"},
        {"name": "get_asset_references", "category": "Asset", "description": "Get asset references"},
        
        # Blueprint Operations
        {"name": "create_blueprint", "category": "Blueprint", "description": "Create a new Blueprint asset"},
        {"name": "get_blueprint_info", "category": "Blueprint", "description": "Get Blueprint class information"},
        {"name": "compile_blueprint", "category": "Blueprint", "description": "Compile a Blueprint"},
        {"name": "spawn_blueprint_actor", "category": "Blueprint", "description": "Spawn actor from Blueprint"},
        {"name": "add_blueprint_variable", "category": "Blueprint", "description": "Add variable to Blueprint"},
        {"name": "remove_blueprint_variable", "category": "Blueprint", "description": "Remove variable from Blueprint"},
        {"name": "get_blueprint_variables", "category": "Blueprint", "description": "Get all Blueprint variables"},
        {"name": "get_blueprint_functions", "category": "Blueprint", "description": "Get all Blueprint functions"},
        {"name": "set_blueprint_variable_default", "category": "Blueprint", "description": "Set variable default value"},
        
        # Material Operations
        {"name": "create_material_instance", "category": "Material", "description": "Create a material instance"},
        {"name": "set_material_scalar", "category": "Material", "description": "Set scalar parameter"},
        {"name": "apply_material_to_actor", "category": "Material", "description": "Apply material to actor"},
        {"name": "set_material_vector", "category": "Material", "description": "Set vector parameter"},
        {"name": "get_material_parameters", "category": "Material", "description": "Get material parameters"},
        {"name": "replace_actor_material", "category": "Material", "description": "Replace actor material"},
        {"name": "get_actor_materials", "category": "Material", "description": "Get actor materials"},
        
        # Physics & Collision
        {"name": "set_simulate_physics", "category": "Physics", "description": "Enable/disable physics"},
        {"name": "set_collision_enabled", "category": "Physics", "description": "Enable/disable collision"},
        {"name": "set_collision_profile", "category": "Physics", "description": "Set collision profile"},
        {"name": "add_impulse", "category": "Physics", "description": "Add impulse force to actor"},
        {"name": "get_physics_state", "category": "Physics", "description": "Get physics state"},
        
        # Editor Utilities
        {"name": "execute_console_command", "category": "Editor", "description": "Execute console command"},
        {"name": "get_project_info", "category": "Editor", "description": "Get project information"},
        {"name": "get_editor_preference", "category": "Editor", "description": "Get editor preference"},
        {"name": "set_editor_preference", "category": "Editor", "description": "Set editor preference"},
        {"name": "run_editor_utility", "category": "Editor", "description": "Run editor utility"},
        {"name": "get_engine_info", "category": "Editor", "description": "Get engine version info"},
        
        # Viewport Bookmarks
        {"name": "set_viewport_bookmark", "category": "Bookmark", "description": "Save viewport bookmark"},
        {"name": "jump_to_bookmark", "category": "Bookmark", "description": "Jump to saved bookmark"},
        {"name": "clear_bookmark", "category": "Bookmark", "description": "Clear a bookmark slot"},
        {"name": "list_bookmarks", "category": "Bookmark", "description": "List all bookmarks"},
        
        # Component Operations
        {"name": "get_actor_components", "category": "Component", "description": "Get actor components"},
        {"name": "get_component_properties", "category": "Component", "description": "Get component properties"},
        {"name": "set_component_transform", "category": "Component", "description": "Set component transform"},
        {"name": "set_component_visibility", "category": "Component", "description": "Set component visibility"},
        {"name": "remove_component", "category": "Component", "description": "Remove a component"},
        
        # Animation & Sequencer
        {"name": "play_animation", "category": "Animation", "description": "Play animation on skeletal mesh"},
        {"name": "stop_animation", "category": "Animation", "description": "Stop animation"},
        {"name": "get_animation_list", "category": "Animation", "description": "Get available animations"},
        {"name": "create_level_sequence", "category": "Animation", "description": "Create level sequence"},
        {"name": "add_actor_to_sequence", "category": "Animation", "description": "Add actor to sequence"},
        {"name": "play_sequence", "category": "Animation", "description": "Play level sequence"},
        {"name": "stop_sequence", "category": "Animation", "description": "Stop playing sequence"},
        {"name": "set_sequence_time", "category": "Animation", "description": "Set sequence playback time"},
        
        # Audio
        {"name": "play_sound_at_location", "category": "Audio", "description": "Play sound at location"},
        {"name": "spawn_audio_component", "category": "Audio", "description": "Spawn audio component"},
        {"name": "set_audio_volume", "category": "Audio", "description": "Set audio volume"},
        {"name": "stop_all_sounds", "category": "Audio", "description": "Stop all sounds"},
        {"name": "get_audio_components", "category": "Audio", "description": "Get audio components"},
        {"name": "set_audio_attenuation", "category": "Audio", "description": "Set audio attenuation"},
        
        # Landscape & Foliage
        {"name": "get_landscape_info", "category": "Landscape", "description": "Get landscape information"},
        {"name": "get_landscape_height", "category": "Landscape", "description": "Get landscape height"},
        {"name": "get_foliage_types", "category": "Landscape", "description": "Get foliage types"},
        {"name": "add_foliage_instance", "category": "Landscape", "description": "Add foliage instance"},
        {"name": "remove_foliage_in_radius", "category": "Landscape", "description": "Remove foliage in radius"},
        {"name": "get_foliage_count", "category": "Landscape", "description": "Get foliage count"},
    ]
