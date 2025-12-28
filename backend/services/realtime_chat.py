"""
Real-time Chat Synchronization Service.

Handles real-time message delivery, read receipts, and chat synchronization.
"""

import asyncio
import logging
from datetime import datetime
from typing import Dict, Any, List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from sqlalchemy.orm import selectinload

from services.websocket import (
    connection_manager,
    WebSocketMessage,
    EventType
)
from models.chat import Chat, Message, MessageRole
from models.user import User
from core.database import async_session

logger = logging.getLogger(__name__)


class RealtimeChatService:
    """
    Service for real-time chat synchronization.
    
    Features:
    - Real-time message delivery
    - Message status tracking (sent, delivered, read)
    - Read receipts
    - Chat room management
    """
    
    def __init__(self):
        self._message_queue: asyncio.Queue = asyncio.Queue()
        self._processing = False
        self._process_task: Optional[asyncio.Task] = None
        
        # Register event handlers
        self._register_handlers()
    
    async def start(self):
        """Start the real-time chat service."""
        if self._process_task is None:
            self._processing = True
            self._process_task = asyncio.create_task(self._process_queue())
            logger.info("Realtime chat service started")
    
    async def stop(self):
        """Stop the real-time chat service."""
        self._processing = False
        if self._process_task:
            self._process_task.cancel()
            try:
                await self._process_task
            except asyncio.CancelledError:
                pass
            self._process_task = None
            logger.info("Realtime chat service stopped")
    
    async def _process_queue(self):
        """Process messages from the queue."""
        while self._processing:
            try:
                await asyncio.sleep(0.1)  # Small delay to prevent busy loop
            except asyncio.CancelledError:
                break
    
    def _register_handlers(self):
        """Register WebSocket event handlers."""
        
        @connection_manager.on_event(EventType.MESSAGE.value)
        async def handle_chat_message(user_id: int, message: WebSocketMessage):
            await self.handle_incoming_message(user_id, message)
        
        @connection_manager.on_event(EventType.MESSAGE_READ.value)
        async def handle_message_read(user_id: int, message: WebSocketMessage):
            await self.mark_messages_read(user_id, message)
    
    def get_chat_room(self, chat_id: int) -> str:
        """Get room name for a chat."""
        return f"chat:{chat_id}"
    
    async def join_chat(self, user_id: int, chat_id: int) -> bool:
        """Join a user to a chat room."""
        room = self.get_chat_room(chat_id)
        return await connection_manager.join_room(user_id, room)
    
    async def leave_chat(self, user_id: int, chat_id: int) -> bool:
        """Remove a user from a chat room."""
        room = self.get_chat_room(chat_id)
        return await connection_manager.leave_room(user_id, room)
    
    async def broadcast_message(
        self,
        chat_id: int,
        message_data: Dict[str, Any],
        sender_id: Optional[int] = None
    ):
        """Broadcast a message to all users in a chat room."""
        room = self.get_chat_room(chat_id)
        
        ws_message = WebSocketMessage(
            type=EventType.MESSAGE,
            payload={
                "chat_id": chat_id,
                "message": message_data
            },
            sender_id=sender_id,
            room=room
        )
        
        await connection_manager.broadcast_to_room(room, ws_message)
    
    async def handle_incoming_message(
        self,
        user_id: int,
        message: WebSocketMessage
    ):
        """Handle incoming chat message from WebSocket."""
        payload = message.payload
        chat_id = payload.get("chat_id")
        content = payload.get("content")
        
        if not chat_id or not content:
            return
        
        try:
            async with async_session() as db:
                # Verify user has access to chat
                result = await db.execute(
                    select(Chat).where(
                        Chat.id == chat_id,
                        Chat.user_id == user_id
                    )
                )
                chat = result.scalar_one_or_none()
                
                if not chat:
                    await connection_manager.send_to_user(
                        user_id,
                        WebSocketMessage(
                            type=EventType.ERROR,
                            payload={"message": "Chat not found or access denied"}
                        )
                    )
                    return
                
                # Create message
                new_message = Message(
                    chat_id=chat_id,
                    role=MessageRole.USER,
                    content=content
                )
                db.add(new_message)
                await db.commit()
                await db.refresh(new_message)
                
                # Broadcast to room
                message_data = {
                    "id": new_message.id,
                    "chat_id": chat_id,
                    "role": "user",
                    "content": content,
                    "created_at": new_message.created_at.isoformat(),
                    "sender_id": user_id,
                    "status": "sent"
                }
                
                await self.broadcast_message(chat_id, message_data, sender_id=user_id)
                
                # Send confirmation to sender
                await connection_manager.send_to_user(
                    user_id,
                    WebSocketMessage(
                        type=EventType.MESSAGE_SENT,
                        payload={
                            "message_id": new_message.id,
                            "chat_id": chat_id,
                            "status": "sent"
                        }
                    )
                )
                
        except Exception as e:
            logger.error(f"Error handling chat message: {e}")
            await connection_manager.send_to_user(
                user_id,
                WebSocketMessage(
                    type=EventType.ERROR,
                    payload={"message": "Failed to send message"}
                )
            )
    
    async def mark_messages_read(
        self,
        user_id: int,
        message: WebSocketMessage
    ):
        """Mark messages as read."""
        payload = message.payload
        chat_id = payload.get("chat_id")
        message_ids = payload.get("message_ids", [])
        
        if not chat_id:
            return
        
        try:
            async with async_session() as db:
                # Verify user has access
                result = await db.execute(
                    select(Chat).where(
                        Chat.id == chat_id,
                        Chat.user_id == user_id
                    )
                )
                chat = result.scalar_one_or_none()
                
                if not chat:
                    return
                
                # Broadcast read receipt
                room = self.get_chat_room(chat_id)
                await connection_manager.broadcast_to_room(
                    room,
                    WebSocketMessage(
                        type=EventType.MESSAGE_READ,
                        payload={
                            "chat_id": chat_id,
                            "message_ids": message_ids,
                            "read_by": user_id,
                            "read_at": datetime.utcnow().isoformat()
                        },
                        sender_id=user_id,
                        room=room
                    ),
                    exclude_user=user_id
                )
                
        except Exception as e:
            logger.error(f"Error marking messages read: {e}")
    
    async def notify_ai_response_start(
        self,
        chat_id: int,
        agent: str,
        agent_name: str
    ):
        """Notify chat room that AI is generating a response."""
        room = self.get_chat_room(chat_id)
        
        await connection_manager.broadcast_to_room(
            room,
            WebSocketMessage(
                type=EventType.TYPING_START,
                payload={
                    "chat_id": chat_id,
                    "agent": agent,
                    "agent_name": agent_name,
                    "is_ai": True
                },
                room=room
            )
        )
    
    async def notify_ai_response_chunk(
        self,
        chat_id: int,
        agent: str,
        chunk: str
    ):
        """Stream AI response chunk to chat room."""
        room = self.get_chat_room(chat_id)
        
        await connection_manager.broadcast_to_room(
            room,
            WebSocketMessage(
                type=EventType.MESSAGE,
                payload={
                    "chat_id": chat_id,
                    "type": "chunk",
                    "agent": agent,
                    "content": chunk
                },
                room=room
            )
        )
    
    async def notify_ai_response_complete(
        self,
        chat_id: int,
        agent: str,
        agent_name: str,
        message_id: int,
        content: str
    ):
        """Notify chat room that AI response is complete."""
        room = self.get_chat_room(chat_id)
        
        await connection_manager.broadcast_to_room(
            room,
            WebSocketMessage(
                type=EventType.MESSAGE,
                payload={
                    "chat_id": chat_id,
                    "type": "complete",
                    "message": {
                        "id": message_id,
                        "role": "assistant",
                        "agent": agent,
                        "agent_name": agent_name,
                        "content": content,
                        "created_at": datetime.utcnow().isoformat()
                    }
                },
                room=room
            )
        )
        
        # Stop typing indicator
        await connection_manager.broadcast_to_room(
            room,
            WebSocketMessage(
                type=EventType.TYPING_STOP,
                payload={
                    "chat_id": chat_id,
                    "agent": agent,
                    "is_ai": True
                },
                room=room
            )
        )
    
    async def notify_chat_updated(
        self,
        chat_id: int,
        updates: Dict[str, Any]
    ):
        """Notify chat room of chat metadata updates (title, etc.)."""
        room = self.get_chat_room(chat_id)
        
        await connection_manager.broadcast_to_room(
            room,
            WebSocketMessage(
                type=EventType.NOTIFICATION,
                payload={
                    "type": "chat_updated",
                    "chat_id": chat_id,
                    "updates": updates
                },
                room=room
            )
        )
    
    def get_chat_users(self, chat_id: int) -> List[Dict[str, Any]]:
        """Get users currently in a chat room."""
        room = self.get_chat_room(chat_id)
        return connection_manager.get_room_users(room)
    
    def get_typing_users(self, chat_id: int) -> List[Dict[str, Any]]:
        """Get users currently typing in a chat."""
        room = self.get_chat_room(chat_id)
        users = connection_manager.get_room_users(room)
        return [u for u in users if u.get("is_typing")]


# Global instance
realtime_chat = RealtimeChatService()
