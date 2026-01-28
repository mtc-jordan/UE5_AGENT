"""
Workspace Collaboration WebSocket API
Handles real-time presence and cursor tracking for code editing
"""
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from typing import Optional
import json

from services.collaboration_service import collaboration_service
from services.auth import decode_token
from models.user import User
from database import get_db


router = APIRouter(prefix="/workspace-collab", tags=["workspace-collaboration"])


async def get_user_from_token(token: str) -> Optional[User]:
    """Get user from JWT token"""
    try:
        payload = decode_token(token)
        user_id = int(payload.get("sub"))
        
        # Get user from database
        db = next(get_db())
        user = db.query(User).filter(User.id == user_id).first()
        return user
    except:
        return None


@router.websocket("/ws")
async def workspace_collaboration_websocket(
    websocket: WebSocket,
    token: str = Query(...),
):
    """
    WebSocket endpoint for workspace collaboration
    
    Client -> Server messages:
    - cursor_update: {file_id, file_path, cursor_position: {line, column}, selection}
    - typing_status: {is_typing}
    - file_change: {file_id, file_path}
    - heartbeat: {}
    
    Server -> Client messages:
    - presence_full: {users: [...]}
    - presence_update: {event, user}
    - cursor_update: {user_id, username, color, cursor_position, selection}
    - typing_status: {user_id, username, is_typing}
    - heartbeat_ack: {}
    """
    user = None
    try:
        # Authenticate user
        user = await get_user_from_token(token)
        if not user:
            await websocket.close(code=1008, reason="Invalid token")
            return
        
        # Connect user to collaboration service
        await collaboration_service.connect(
            user_id=user.id,
            username=user.username,
            email=user.email,
            websocket=websocket
        )
        
        # Message handling loop
        while True:
            try:
                # Receive message from client
                data = await websocket.receive_text()
                message = json.loads(data)
                
                message_type = message.get("type")
                
                if message_type == "cursor_update":
                    # Update cursor position and broadcast to others
                    await collaboration_service.update_cursor(
                        user_id=user.id,
                        file_id=message.get("file_id"),
                        file_path=message.get("file_path"),
                        cursor_position=message.get("cursor_position"),
                        selection=message.get("selection")
                    )
                
                elif message_type == "typing_status":
                    # Update typing status
                    await collaboration_service.update_typing_status(
                        user_id=user.id,
                        is_typing=message.get("is_typing", False)
                    )
                
                elif message_type == "file_change":
                    # User switched to a different file
                    await collaboration_service.change_file(
                        user_id=user.id,
                        file_id=message.get("file_id"),
                        file_path=message.get("file_path")
                    )
                
                elif message_type == "heartbeat":
                    # Respond to heartbeat
                    await websocket.send_json({"type": "heartbeat_ack"})
                
                else:
                    print(f"Unknown message type from user {user.id}: {message_type}")
            
            except json.JSONDecodeError as e:
                print(f"Invalid JSON from user {user.id}: {e}")
                continue
            
            except Exception as e:
                print(f"Error processing message from user {user.id}: {e}")
                break
    
    except WebSocketDisconnect:
        print(f"User {user.id if user else 'unknown'} disconnected from workspace collaboration")
    
    except Exception as e:
        print(f"WebSocket error for user {user.id if user else 'unknown'}: {e}")
    
    finally:
        # Clean up: disconnect user from collaboration service
        if user:
            await collaboration_service.disconnect(user.id)


@router.get("/presence")
async def get_all_presence():
    """Get list of all online users in workspace"""
    users = collaboration_service.get_online_users()
    return {"users": users, "count": len(users)}


@router.get("/presence/file/{file_id}")
async def get_file_presence(file_id: int):
    """Get list of users currently viewing/editing a specific file"""
    viewers = collaboration_service.get_file_viewers(file_id)
    return {"viewers": viewers, "count": len(viewers)}


@router.get("/presence/user/{user_id}")
async def get_user_presence_data(user_id: int):
    """Get presence data for a specific user"""
    presence = collaboration_service.get_user_presence(user_id)
    if not presence:
        return {"error": "User not found or offline"}, 404
    return presence
