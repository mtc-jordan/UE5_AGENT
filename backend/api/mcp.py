"""
UE5 AI Studio - Enhanced MCP API Endpoints
==========================================

FastAPI routes for MCP connection management with:
- Connection lifecycle management
- Health monitoring
- Tool discovery and invocation
- Circuit breaker status reporting

Version: 2.0.0
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List, Optional
from datetime import datetime
import logging

from core.database import get_db
from services.auth import get_current_user
from services.mcp import mcp_manager, get_available_tools
from models.user import User
from models.mcp_connection import MCPConnection, ConnectionStatus
from api.schemas import MCPConnectionCreate, MCPConnectionResponse, MCPToolCall

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/mcp", tags=["MCP Integration"])


# =============================================================================
# CONNECTION MANAGEMENT ENDPOINTS
# =============================================================================

@router.get("/connections", response_model=List[MCPConnectionResponse])
async def list_connections(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    List all MCP connections for the current user.
    
    Returns connection metadata from database with real-time status from manager.
    """
    result = await db.execute(
        select(MCPConnection).where(MCPConnection.user_id == current_user.id)
    )
    connections = result.scalars().all()
    
    # Enrich with real-time connection status
    enriched = []
    for conn in connections:
        response = MCPConnectionResponse.model_validate(conn)
        # Check actual connection status from manager
        if mcp_manager.is_connected(conn.id):
            response.status = ConnectionStatus.CONNECTED
        enriched.append(response)
    
    return enriched


@router.post("/connections", response_model=MCPConnectionResponse, status_code=status.HTTP_201_CREATED)
async def create_connection(
    connection_data: MCPConnectionCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Create a new MCP connection configuration.
    
    This creates the connection record but does not establish the connection.
    Use the /connect endpoint to establish the connection.
    """
    connection = MCPConnection(
        user_id=current_user.id,
        project_id=connection_data.project_id,
        name=connection_data.name,
        endpoint=connection_data.endpoint,
        status=ConnectionStatus.DISCONNECTED
    )
    db.add(connection)
    await db.commit()
    await db.refresh(connection)
    
    logger.info(f"Created MCP connection {connection.id} for user {current_user.id}")
    return MCPConnectionResponse.model_validate(connection)


@router.post("/connections/{connection_id}/connect", response_model=MCPConnectionResponse)
async def connect(
    connection_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Establish connection to an MCP server.
    
    Uses the enhanced MCP client with:
    - Connection pooling
    - Automatic retry with exponential backoff
    - Circuit breaker protection
    """
    result = await db.execute(
        select(MCPConnection).where(
            MCPConnection.id == connection_id,
            MCPConnection.user_id == current_user.id
        )
    )
    connection = result.scalar_one_or_none()
    
    if not connection:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Connection not found"
        )
    
    # Try to connect using enhanced manager
    connect_result = await mcp_manager.create_connection(connection_id, connection.endpoint)
    
    if connect_result["status"] == "connected":
        connection.status = ConnectionStatus.CONNECTED
        connection.last_connected = datetime.utcnow()
        connection.available_tools = connect_result.get("available_tools", [])
        logger.info(
            f"Connected to MCP server {connection.endpoint} "
            f"({connect_result.get('tools_count', 0)} tools available)"
        )
    elif connect_result["status"] == "circuit_open":
        connection.status = ConnectionStatus.ERROR
        logger.warning(f"Circuit breaker open for connection {connection_id}")
    else:
        connection.status = ConnectionStatus.ERROR
        logger.error(f"Failed to connect: {connect_result.get('error', 'Unknown error')}")
    
    await db.commit()
    await db.refresh(connection)
    return MCPConnectionResponse.model_validate(connection)


@router.post("/connections/{connection_id}/disconnect", response_model=MCPConnectionResponse)
async def disconnect(
    connection_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Disconnect from an MCP server.
    
    Properly closes HTTP connections and cleans up resources.
    """
    result = await db.execute(
        select(MCPConnection).where(
            MCPConnection.id == connection_id,
            MCPConnection.user_id == current_user.id
        )
    )
    connection = result.scalar_one_or_none()
    
    if not connection:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Connection not found"
        )
    
    disconnect_result = await mcp_manager.remove_connection(connection_id)
    
    connection.status = ConnectionStatus.DISCONNECTED
    await db.commit()
    await db.refresh(connection)
    
    logger.info(f"Disconnected MCP connection {connection_id}")
    return MCPConnectionResponse.model_validate(connection)


@router.post("/connections/{connection_id}/reconnect", response_model=MCPConnectionResponse)
async def reconnect(
    connection_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Attempt to reconnect a disconnected connection.
    
    Useful when the connection was lost due to network issues or server restart.
    """
    result = await db.execute(
        select(MCPConnection).where(
            MCPConnection.id == connection_id,
            MCPConnection.user_id == current_user.id
        )
    )
    connection = result.scalar_one_or_none()
    
    if not connection:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Connection not found"
        )
    
    reconnect_result = await mcp_manager.reconnect(connection_id)
    
    if reconnect_result.get("status") == "connected" or reconnect_result.get("status") == "already_connected":
        connection.status = ConnectionStatus.CONNECTED
        connection.last_connected = datetime.utcnow()
    else:
        connection.status = ConnectionStatus.ERROR
    
    await db.commit()
    await db.refresh(connection)
    return MCPConnectionResponse.model_validate(connection)


@router.delete("/connections/{connection_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_connection(
    connection_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Delete an MCP connection configuration.
    
    Disconnects if connected and removes from database.
    """
    result = await db.execute(
        select(MCPConnection).where(
            MCPConnection.id == connection_id,
            MCPConnection.user_id == current_user.id
        )
    )
    connection = result.scalar_one_or_none()
    
    if not connection:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Connection not found"
        )
    
    # Disconnect if connected
    await mcp_manager.remove_connection(connection_id)
    
    await db.delete(connection)
    await db.commit()
    
    logger.info(f"Deleted MCP connection {connection_id}")


# =============================================================================
# HEALTH AND STATUS ENDPOINTS
# =============================================================================

@router.get("/connections/{connection_id}/status")
async def get_connection_status(
    connection_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get detailed status of an MCP connection.
    
    Returns:
    - Connection state
    - Circuit breaker status
    - Request statistics
    - Available tools count
    """
    # Verify ownership
    result = await db.execute(
        select(MCPConnection).where(
            MCPConnection.id == connection_id,
            MCPConnection.user_id == current_user.id
        )
    )
    connection = result.scalar_one_or_none()
    
    if not connection:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Connection not found"
        )
    
    # Get real-time status from manager
    status_info = mcp_manager.get_connection_status(connection_id)
    
    return {
        "connection_id": connection_id,
        "name": connection.name,
        "endpoint": connection.endpoint,
        "database_status": connection.status.value,
        "real_time_status": status_info
    }


@router.get("/connections/{connection_id}/health")
async def health_check(
    connection_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Perform a health check on an MCP connection.
    
    Attempts to call get_project_info to verify the connection is working.
    """
    # Verify ownership
    result = await db.execute(
        select(MCPConnection).where(
            MCPConnection.id == connection_id,
            MCPConnection.user_id == current_user.id
        )
    )
    connection = result.scalar_one_or_none()
    
    if not connection:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Connection not found"
        )
    
    health_result = await mcp_manager.health_check(connection_id)
    
    # Update database status based on health check
    if health_result.get("healthy"):
        connection.status = ConnectionStatus.CONNECTED
    else:
        connection.status = ConnectionStatus.ERROR
    
    await db.commit()
    
    return health_result


@router.get("/status")
async def get_all_connections_status(
    current_user: User = Depends(get_current_user)
):
    """
    Get status of all active MCP connections for the current user.
    
    Returns aggregated status information for monitoring.
    """
    all_connections = mcp_manager.get_all_connections()
    
    return {
        "total_connections": len(all_connections),
        "connections": all_connections
    }


# =============================================================================
# TOOL MANAGEMENT ENDPOINTS
# =============================================================================

@router.get("/connections/{connection_id}/tools")
async def list_tools(
    connection_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    List available tools on the MCP server.
    
    Returns tools discovered during connection initialization.
    """
    result = await db.execute(
        select(MCPConnection).where(
            MCPConnection.id == connection_id,
            MCPConnection.user_id == current_user.id
        )
    )
    connection = result.scalar_one_or_none()
    
    if not connection:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Connection not found"
        )
    
    # Get tools from the active client if available
    client = mcp_manager.get_client(connection_id)
    if client and client.connected:
        return {
            "tools": client.available_tools,
            "count": len(client.available_tools),
            "source": "live"
        }
    
    # Fall back to database cache
    return {
        "tools": connection.available_tools or [],
        "count": len(connection.available_tools or []),
        "source": "cached"
    }


@router.post("/connections/{connection_id}/call")
async def call_tool(
    connection_id: int,
    tool_call: MCPToolCall,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Call a tool on the MCP server.
    
    Uses the enhanced client with:
    - Automatic retry on transient failures
    - Circuit breaker protection
    - Detailed error reporting
    """
    # Verify ownership
    result = await db.execute(
        select(MCPConnection).where(
            MCPConnection.id == connection_id,
            MCPConnection.user_id == current_user.id
        )
    )
    connection = result.scalar_one_or_none()
    
    if not connection:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Connection not found"
        )
    
    # Call tool using manager
    tool_result = await mcp_manager.call_tool(
        connection_id,
        tool_call.tool_name,
        tool_call.arguments
    )
    
    # Check for errors that indicate connection issues
    if "reconnect_required" in tool_result:
        connection.status = ConnectionStatus.ERROR
        await db.commit()
    
    return tool_result


@router.get("/tools/catalog")
async def get_tools_catalog(
    current_user: User = Depends(get_current_user)
):
    """
    Get the complete catalog of available MCP tools.
    
    Returns all tools with descriptions and categories,
    useful for UI display and documentation.
    """
    tools = get_available_tools()
    
    # Group by category
    categories = {}
    for tool in tools:
        category = tool["category"]
        if category not in categories:
            categories[category] = []
        categories[category].append({
            "name": tool["name"],
            "description": tool["description"]
        })
    
    return {
        "total_tools": len(tools),
        "categories": categories,
        "tools": tools
    }


# =============================================================================
# BATCH OPERATIONS
# =============================================================================

@router.post("/connections/{connection_id}/batch")
async def batch_call_tools(
    connection_id: int,
    tool_calls: List[MCPToolCall],
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Execute multiple tool calls in sequence.
    
    Useful for complex operations that require multiple steps.
    Returns results for all calls, including any failures.
    """
    # Verify ownership
    result = await db.execute(
        select(MCPConnection).where(
            MCPConnection.id == connection_id,
            MCPConnection.user_id == current_user.id
        )
    )
    connection = result.scalar_one_or_none()
    
    if not connection:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Connection not found"
        )
    
    results = []
    for i, tool_call in enumerate(tool_calls):
        tool_result = await mcp_manager.call_tool(
            connection_id,
            tool_call.tool_name,
            tool_call.arguments
        )
        results.append({
            "index": i,
            "tool_name": tool_call.tool_name,
            "result": tool_result,
            "success": "error" not in tool_result
        })
        
        # Stop on connection failure
        if "reconnect_required" in tool_result:
            connection.status = ConnectionStatus.ERROR
            await db.commit()
            break
    
    return {
        "total": len(tool_calls),
        "executed": len(results),
        "successful": sum(1 for r in results if r["success"]),
        "results": results
    }
