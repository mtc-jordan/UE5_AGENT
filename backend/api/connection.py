"""
Connection API Endpoints.

REST API for UE5 connection status and management.

Version: 1.0.0
"""

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from typing import Optional, Dict, Any
from datetime import datetime

from services.auth import get_current_user
from services.agent_relay import agent_relay
from services.mcp import mcp_manager
from models.user import User

router = APIRouter(prefix="/connection", tags=["Connection"])


# =============================================================================
# SCHEMAS
# =============================================================================

class ConnectionStatusResponse(BaseModel):
    """Connection status response."""
    ue5_connected: bool
    ue5_connection_id: Optional[str] = None
    ue5_connected_at: Optional[str] = None
    ue5_version: Optional[str] = None
    mcp_total_connections: int
    mcp_active_connections: int
    last_activity: Optional[str] = None
    status: str


# =============================================================================
# CONNECTION STATUS ENDPOINTS
# =============================================================================

@router.get("/status", response_model=ConnectionStatusResponse)
async def get_connection_status(
    current_user: User = Depends(get_current_user)
):
    """
    Get overall connection status for UE5 and MCP.
    
    Returns:
    - UE5 connection status
    - MCP connections count
    - Last activity timestamp
    """
    # Get UE5 agent connection status
    ue5_status = agent_relay.get_connection_status(current_user.id)
    
    # Get MCP connections status
    mcp_connections = mcp_manager.get_all_connections()
    mcp_total = len(mcp_connections)
    mcp_active = sum(1 for conn in mcp_connections.values() if conn.get("connected", False))
    
    # Determine overall status
    if ue5_status.get("connected"):
        overall_status = "connected"
    elif mcp_active > 0:
        overall_status = "partial"
    else:
        overall_status = "disconnected"
    
    return ConnectionStatusResponse(
        ue5_connected=ue5_status.get("connected", False),
        ue5_connection_id=ue5_status.get("connection_id"),
        ue5_connected_at=ue5_status.get("connected_at"),
        ue5_version=ue5_status.get("agent_version"),
        mcp_total_connections=mcp_total,
        mcp_active_connections=mcp_active,
        last_activity=ue5_status.get("connected_at"),
        status=overall_status
    )


@router.get("/ue5/status")
async def get_ue5_status(
    current_user: User = Depends(get_current_user)
):
    """Get UE5 agent connection status."""
    return agent_relay.get_connection_status(current_user.id)


@router.get("/mcp/status")
async def get_mcp_status(
    current_user: User = Depends(get_current_user)
):
    """Get MCP connections status."""
    connections = mcp_manager.get_all_connections()
    
    return {
        "total_connections": len(connections),
        "active_connections": sum(1 for conn in connections.values() if conn.get("connected", False)),
        "connections": connections
    }


@router.get("/health")
async def health_check():
    """Health check endpoint for monitoring."""
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "service": "UE5 AI Studio"
    }
