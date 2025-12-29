"""
Collaboration WebSocket Endpoint
================================

WebSocket endpoint for real-time collaboration features including:
- Actor locking
- Selection synchronization
- User presence
- Real-time updates
"""

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query, Depends, HTTPException
from typing import Optional
import logging
import jwt
from core.config import settings
from services.actor_lock_service import get_actor_lock_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/collaboration", tags=["collaboration-ws"])


def verify_ws_token(token: str) -> Optional[dict]:
    """Verify WebSocket authentication token."""
    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET,
            algorithms=[settings.JWT_ALGORITHM]
        )
        return payload
    except jwt.ExpiredSignatureError:
        logger.warning("WebSocket token expired")
        return None
    except jwt.JWTError as e:
        logger.warning(f"WebSocket token error: {e}")
        return None


@router.websocket("/ws/{session_id}")
async def collaboration_websocket(
    websocket: WebSocket,
    session_id: str,
    token: str = Query(...),
    user_name: str = Query("Anonymous"),
    user_color: str = Query("#3B82F6")
):
    """
    WebSocket endpoint for real-time collaboration.
    
    Connect to a collaboration session for:
    - Actor locking/unlocking
    - Selection synchronization
    - User presence updates
    - Real-time notifications
    
    Query Parameters:
        session_id: The collaboration session ID
        token: JWT authentication token
        user_name: Display name for the user
        user_color: Color for user highlights (hex)
    
    Message Types (Client -> Server):
        - lock: Lock an actor { actor_id, actor_name }
        - unlock: Unlock an actor { actor_id }
        - selection: Update selection { actors: string[] }
        - ping: Keep-alive ping
    
    Message Types (Server -> Client):
        - session_state: Initial session state
        - user_joined: A user joined the session
        - user_left: A user left the session
        - actor_locked: An actor was locked
        - actor_unlocked: An actor was unlocked
        - lock_expired: A lock expired
        - selection_changed: A user's selection changed
        - pong: Response to ping
    """
    # Verify token
    payload = verify_ws_token(token)
    if not payload:
        await websocket.close(code=4001, reason="Invalid or expired token")
        return
    
    user_id = int(payload.get("sub", 0))
    if not user_id:
        await websocket.close(code=4002, reason="Invalid user ID")
        return
    
    # Get the actor lock service
    lock_service = get_actor_lock_service()
    
    # Handle the WebSocket connection
    await lock_service.handle_websocket(
        websocket=websocket,
        session_id=session_id,
        user_id=user_id,
        user_name=user_name,
        user_color=user_color
    )
