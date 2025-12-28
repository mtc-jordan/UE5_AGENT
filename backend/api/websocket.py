"""
WebSocket API Endpoints.

Handles WebSocket connections for real-time features.
"""

import logging
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, Query, HTTPException
from typing import Optional
import jwt

from services.websocket import (
    connection_manager,
    authenticate_websocket,
    WebSocketMessage,
    EventType
)
from services.presence import presence_service
from services.realtime_chat import realtime_chat
from core.config import settings
from core.database import async_session
from models.user import User
from sqlalchemy import select

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/ws", tags=["websocket"])


async def get_user_from_token(token: str) -> Optional[dict]:
    """Validate JWT token and return user info."""
    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET,
            algorithms=[settings.JWT_ALGORITHM]
        )
        return payload
    except jwt.ExpiredSignatureError:
        logger.warning("WebSocket auth failed: Token expired")
        return None
    except jwt.InvalidTokenError as e:
        logger.warning(f"WebSocket auth failed: {e}")
        return None


@router.websocket("/connect")
async def websocket_endpoint(
    websocket: WebSocket,
    token: Optional[str] = Query(None)
):
    """
    Main WebSocket endpoint for real-time communication.
    
    Connect with: ws://host/api/ws/connect?token=<jwt_token>
    
    Events:
    - join_room: Join a chat/workspace room
    - leave_room: Leave a room
    - message: Send a chat message
    - typing_start: Start typing indicator
    - typing_stop: Stop typing indicator
    - ping: Keep-alive ping
    """
    # Authenticate
    if not token:
        await websocket.close(code=4001, reason="Missing authentication token")
        return
    
    user_data = await get_user_from_token(token)
    if not user_data:
        await websocket.close(code=4001, reason="Invalid or expired token")
        return
    
    user_id = user_data.get("sub") or user_data.get("user_id")
    if not user_id:
        await websocket.close(code=4001, reason="Invalid token payload")
        return
    
    user_id = int(user_id)
    
    # Get username from database
    try:
        async with async_session() as db:
            result = await db.execute(
                select(User).where(User.id == user_id)
            )
            user = result.scalar_one_or_none()
            if not user:
                await websocket.close(code=4001, reason="User not found")
                return
            username = user.username
    except Exception as e:
        logger.error(f"Database error during WebSocket auth: {e}")
        await websocket.close(code=4002, reason="Database error")
        return
    
    # Connect
    try:
        connection = await connection_manager.connect(websocket, user_id, username)
        await presence_service.user_connected(user_id, username)
        
        logger.info(f"WebSocket connected: {username} (ID: {user_id})")
        
        # Send welcome message
        await connection_manager.send_to_user(
            user_id,
            WebSocketMessage(
                type=EventType.CONNECT,
                payload={
                    "message": "Connected successfully",
                    "user_id": user_id,
                    "username": username
                }
            )
        )
        
        # Message loop
        while True:
            try:
                data = await websocket.receive_text()
                await connection_manager.handle_message(user_id, data)
                
                # Update presence activity
                await presence_service.update_activity(user_id)
                
            except WebSocketDisconnect:
                break
            except Exception as e:
                logger.error(f"Error processing message from {username}: {e}")
                await connection_manager.send_to_user(
                    user_id,
                    WebSocketMessage(
                        type=EventType.ERROR,
                        payload={"message": str(e)}
                    )
                )
    
    except WebSocketDisconnect:
        pass
    except Exception as e:
        logger.error(f"WebSocket error for {username}: {e}")
    finally:
        # Cleanup
        await connection_manager.disconnect(user_id)
        await presence_service.user_disconnected(user_id)
        logger.info(f"WebSocket disconnected: {username} (ID: {user_id})")


@router.get("/status")
async def get_websocket_status():
    """Get WebSocket server status."""
    return {
        "status": "running",
        "connections": connection_manager.connection_count,
        "online_users": len(presence_service.get_online_users())
    }


@router.get("/online")
async def get_online_users():
    """Get list of online users."""
    return {
        "users": presence_service.get_online_users(),
        "count": len(presence_service.get_online_users())
    }


@router.get("/presence/{user_id}")
async def get_user_presence(user_id: int):
    """Get presence info for a specific user."""
    presence = presence_service.get_presence(user_id)
    if presence:
        return presence.to_dict()
    return {
        "user_id": user_id,
        "status": "offline",
        "last_seen": None
    }


@router.get("/chat/{chat_id}/users")
async def get_chat_users(chat_id: int):
    """Get users currently in a chat room."""
    return {
        "chat_id": chat_id,
        "users": realtime_chat.get_chat_users(chat_id),
        "typing": realtime_chat.get_typing_users(chat_id)
    }
