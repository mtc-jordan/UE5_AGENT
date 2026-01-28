"""
Yjs Synchronization WebSocket API
Handles real-time CRDT synchronization for collaborative editing
"""
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from typing import Optional
import struct
import asyncio

from services.yjs_service import yjs_service
from services.auth import decode_token
from models.user import User
from core.database import get_db


router = APIRouter(prefix="/yjs", tags=["yjs-sync"])


# Message types (Yjs protocol)
MESSAGE_SYNC = 0
MESSAGE_AWARENESS = 1


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


@router.websocket("/sync/{file_id}")
async def yjs_sync_websocket(
    websocket: WebSocket,
    file_id: int,
    token: str = Query(...),
):
    """
    WebSocket endpoint for Yjs synchronization
    
    Protocol:
    - Binary messages only
    - First byte: message type (0=sync, 1=awareness)
    - Sync messages: [0, ...yjs update bytes]
    - Awareness messages: [1, ...awareness update bytes]
    
    Flow:
    1. Client connects
    2. Server sends full document state
    3. Client/server exchange updates in real-time
    4. Server broadcasts updates to all connected clients
    """
    user = None
    try:
        # Authenticate user
        user = await get_user_from_token(token)
        if not user:
            await websocket.close(code=1008, reason="Invalid token")
            return
        
        await websocket.accept()
        
        # Get or create Yjs document
        # Note: In production, load initial content from database
        doc = await yjs_service.get_or_create_document(file_id, initial_content="")
        
        # Add user as editor
        await yjs_service.add_editor(file_id, user.id)
        
        # Send initial sync (full document state)
        state_update = await yjs_service.get_state_as_update(file_id)
        sync_message = bytes([MESSAGE_SYNC]) + state_update
        await websocket.send_bytes(sync_message)
        
        print(f"User {user.id} connected to Yjs document {file_id}")
        
        # Message handling loop
        while True:
            try:
                # Receive message from client
                data = await websocket.receive_bytes()
                
                if len(data) == 0:
                    continue
                
                message_type = data[0]
                message_data = data[1:]
                
                if message_type == MESSAGE_SYNC:
                    # Apply update to document
                    update = await yjs_service.apply_update(file_id, message_data, user.id)
                    
                    # Broadcast to other editors
                    # Note: In production, use a proper pub/sub system
                    # For now, we'll rely on the collaboration service
                    # to handle broadcasting via separate WebSocket
                    
                    print(f"Applied Yjs update from user {user.id} to file {file_id}")
                
                elif message_type == MESSAGE_AWARENESS:
                    # Awareness updates (cursor position, selection, etc.)
                    # These are handled by the collaboration service
                    # We just pass them through
                    print(f"Received awareness update from user {user.id}")
                
                else:
                    print(f"Unknown Yjs message type from user {user.id}: {message_type}")
            
            except Exception as e:
                print(f"Error processing Yjs message from user {user.id}: {e}")
                break
    
    except WebSocketDisconnect:
        print(f"User {user.id if user else 'unknown'} disconnected from Yjs sync")
    
    except Exception as e:
        print(f"Yjs WebSocket error for user {user.id if user else 'unknown'}: {e}")
    
    finally:
        # Clean up: remove user as editor
        if user:
            await yjs_service.remove_editor(file_id, user.id)
            
            # Check if document should be closed (no more editors)
            editors = await yjs_service.get_editors(file_id)
            if len(editors) == 0:
                # Save final content to database
                final_content = await yjs_service.close_document(file_id)
                print(f"Closed Yjs document {file_id}, final content length: {len(final_content) if final_content else 0}")
                
                # TODO: Save final_content to database (workspace file)


@router.get("/document/{file_id}/info")
async def get_document_info(file_id: int):
    """Get information about a Yjs document"""
    info = await yjs_service.get_document_info(file_id)
    if not info:
        return {"error": "Document not found"}, 404
    return info


@router.get("/documents")
async def get_all_documents():
    """Get list of all active Yjs documents"""
    documents = await yjs_service.get_all_documents()
    return {"documents": documents, "count": len(documents)}


@router.post("/document/{file_id}/content")
async def get_document_content(file_id: int):
    """Get current text content of a document"""
    try:
        content = await yjs_service.get_text_content(file_id)
        return {"file_id": file_id, "content": content, "length": len(content)}
    except ValueError as e:
        return {"error": str(e)}, 404
