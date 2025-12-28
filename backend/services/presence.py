"""
User Presence Service.

Handles online/offline status, last seen tracking, and activity monitoring.
"""

import asyncio
import logging
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional, Set
from dataclasses import dataclass, field
from enum import Enum
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import update

from services.websocket import (
    connection_manager,
    WebSocketMessage,
    EventType
)
from models.user import User
from core.database import async_session

logger = logging.getLogger(__name__)


class UserStatus(str, Enum):
    """User presence status."""
    ONLINE = "online"
    AWAY = "away"
    BUSY = "busy"
    OFFLINE = "offline"


@dataclass
class UserPresence:
    """User presence information."""
    user_id: int
    username: str
    status: UserStatus = UserStatus.ONLINE
    last_seen: datetime = field(default_factory=datetime.utcnow)
    current_room: Optional[str] = None
    current_chat_id: Optional[int] = None
    activity: Optional[str] = None  # e.g., "Chatting", "Editing file", etc.
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "user_id": self.user_id,
            "username": self.username,
            "status": self.status.value,
            "last_seen": self.last_seen.isoformat(),
            "current_room": self.current_room,
            "current_chat_id": self.current_chat_id,
            "activity": self.activity
        }


class PresenceService:
    """
    Service for tracking user presence and activity.
    
    Features:
    - Online/offline status tracking
    - Last seen timestamps
    - Activity status (typing, editing, etc.)
    - Away detection after inactivity
    """
    
    def __init__(self):
        # User presence data: user_id -> UserPresence
        self._presence: Dict[int, UserPresence] = {}
        
        # Away timeout in seconds (5 minutes)
        self.away_timeout = 300
        
        # Offline timeout in seconds (30 minutes)
        self.offline_timeout = 1800
        
        # Background task for status updates
        self._status_task: Optional[asyncio.Task] = None
        
        # Lock for thread-safe operations
        self._lock = asyncio.Lock()
    
    async def start(self):
        """Start the presence service background tasks."""
        if self._status_task is None:
            self._status_task = asyncio.create_task(self._status_check_loop())
            logger.info("Presence service started")
    
    async def stop(self):
        """Stop the presence service background tasks."""
        if self._status_task:
            self._status_task.cancel()
            try:
                await self._status_task
            except asyncio.CancelledError:
                pass
            self._status_task = None
            logger.info("Presence service stopped")
    
    async def _status_check_loop(self):
        """Background loop to check and update user statuses."""
        while True:
            try:
                await asyncio.sleep(60)  # Check every minute
                await self._update_statuses()
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error in status check loop: {e}")
    
    async def _update_statuses(self):
        """Update user statuses based on activity."""
        now = datetime.utcnow()
        status_changes = []
        
        async with self._lock:
            for user_id, presence in list(self._presence.items()):
                # Check if user is still connected
                if not connection_manager.is_user_online(user_id):
                    # User disconnected, mark as offline
                    if presence.status != UserStatus.OFFLINE:
                        presence.status = UserStatus.OFFLINE
                        presence.last_seen = now
                        status_changes.append((user_id, UserStatus.OFFLINE))
                    continue
                
                # Check for inactivity
                inactive_seconds = (now - presence.last_seen).total_seconds()
                
                if inactive_seconds > self.away_timeout and presence.status == UserStatus.ONLINE:
                    # Mark as away
                    presence.status = UserStatus.AWAY
                    status_changes.append((user_id, UserStatus.AWAY))
        
        # Broadcast status changes
        for user_id, new_status in status_changes:
            await self._broadcast_status_change(user_id, new_status)
    
    async def user_connected(self, user_id: int, username: str):
        """Handle user connection."""
        async with self._lock:
            self._presence[user_id] = UserPresence(
                user_id=user_id,
                username=username,
                status=UserStatus.ONLINE,
                last_seen=datetime.utcnow()
            )
        
        # Update database
        await self._update_user_online_status(user_id, True)
        
        # Broadcast presence
        await self._broadcast_status_change(user_id, UserStatus.ONLINE)
        
        logger.debug(f"User {username} (ID: {user_id}) marked as online")
    
    async def user_disconnected(self, user_id: int):
        """Handle user disconnection."""
        username = None
        
        async with self._lock:
            if user_id in self._presence:
                username = self._presence[user_id].username
                self._presence[user_id].status = UserStatus.OFFLINE
                self._presence[user_id].last_seen = datetime.utcnow()
        
        # Update database
        await self._update_user_online_status(user_id, False)
        
        # Broadcast presence
        await self._broadcast_status_change(user_id, UserStatus.OFFLINE)
        
        if username:
            logger.debug(f"User {username} (ID: {user_id}) marked as offline")
    
    async def update_activity(
        self,
        user_id: int,
        activity: Optional[str] = None,
        room: Optional[str] = None,
        chat_id: Optional[int] = None
    ):
        """Update user activity."""
        async with self._lock:
            if user_id not in self._presence:
                return
            
            presence = self._presence[user_id]
            presence.last_seen = datetime.utcnow()
            
            if activity is not None:
                presence.activity = activity
            if room is not None:
                presence.current_room = room
            if chat_id is not None:
                presence.current_chat_id = chat_id
            
            # If user was away, mark as online
            if presence.status == UserStatus.AWAY:
                presence.status = UserStatus.ONLINE
                await self._broadcast_status_change(user_id, UserStatus.ONLINE)
    
    async def set_status(self, user_id: int, status: UserStatus):
        """Manually set user status."""
        async with self._lock:
            if user_id not in self._presence:
                return
            
            self._presence[user_id].status = status
            self._presence[user_id].last_seen = datetime.utcnow()
        
        await self._broadcast_status_change(user_id, status)
    
    async def _broadcast_status_change(self, user_id: int, status: UserStatus):
        """Broadcast user status change to all connected users."""
        presence = self._presence.get(user_id)
        if not presence:
            return
        
        await connection_manager.broadcast_to_all(
            WebSocketMessage(
                type=EventType.PRESENCE_UPDATE,
                payload=presence.to_dict(),
                sender_id=user_id
            ),
            exclude_user=user_id
        )
    
    async def _update_user_online_status(self, user_id: int, is_online: bool):
        """Update user online status in database."""
        try:
            async with async_session() as db:
                await db.execute(
                    update(User)
                    .where(User.id == user_id)
                    .values(
                        is_online=is_online,
                        last_seen=datetime.utcnow()
                    )
                )
                await db.commit()
        except Exception as e:
            logger.error(f"Failed to update user online status: {e}")
    
    def get_presence(self, user_id: int) -> Optional[UserPresence]:
        """Get presence info for a user."""
        return self._presence.get(user_id)
    
    def get_online_users(self) -> List[Dict[str, Any]]:
        """Get all online users."""
        return [
            p.to_dict()
            for p in self._presence.values()
            if p.status in (UserStatus.ONLINE, UserStatus.AWAY, UserStatus.BUSY)
        ]
    
    def get_users_in_chat(self, chat_id: int) -> List[Dict[str, Any]]:
        """Get users currently viewing a specific chat."""
        return [
            p.to_dict()
            for p in self._presence.values()
            if p.current_chat_id == chat_id and p.status != UserStatus.OFFLINE
        ]
    
    def is_user_online(self, user_id: int) -> bool:
        """Check if a user is online."""
        presence = self._presence.get(user_id)
        return presence is not None and presence.status != UserStatus.OFFLINE
    
    def get_user_status(self, user_id: int) -> UserStatus:
        """Get user's current status."""
        presence = self._presence.get(user_id)
        return presence.status if presence else UserStatus.OFFLINE


# Global instance
presence_service = PresenceService()
