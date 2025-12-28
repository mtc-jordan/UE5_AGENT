"""
Real-time Workspace Collaboration Service.

Handles real-time file editing, cursor sharing, and file locking.
"""

import asyncio
import logging
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional, Set
from dataclasses import dataclass, field

from services.websocket import (
    connection_manager,
    WebSocketMessage,
    EventType
)

logger = logging.getLogger(__name__)


@dataclass
class FileLock:
    """Represents a file lock."""
    file_id: int
    user_id: int
    username: str
    locked_at: datetime = field(default_factory=datetime.utcnow)
    expires_at: datetime = field(default_factory=lambda: datetime.utcnow() + timedelta(minutes=5))
    
    def is_expired(self) -> bool:
        return datetime.utcnow() > self.expires_at
    
    def extend(self, minutes: int = 5):
        self.expires_at = datetime.utcnow() + timedelta(minutes=minutes)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "file_id": self.file_id,
            "user_id": self.user_id,
            "username": self.username,
            "locked_at": self.locked_at.isoformat(),
            "expires_at": self.expires_at.isoformat()
        }


@dataclass
class CursorPosition:
    """Represents a user's cursor position in a file."""
    user_id: int
    username: str
    file_id: int
    line: int
    column: int
    selection_start: Optional[Dict[str, int]] = None  # {line, column}
    selection_end: Optional[Dict[str, int]] = None    # {line, column}
    updated_at: datetime = field(default_factory=datetime.utcnow)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "user_id": self.user_id,
            "username": self.username,
            "file_id": self.file_id,
            "line": self.line,
            "column": self.column,
            "selection_start": self.selection_start,
            "selection_end": self.selection_end,
            "updated_at": self.updated_at.isoformat()
        }


class RealtimeWorkspaceService:
    """
    Service for real-time workspace collaboration.
    
    Features:
    - File locking to prevent conflicts
    - Cursor position sharing
    - Real-time file update notifications
    - Active editors tracking
    """
    
    def __init__(self):
        # File locks: file_id -> FileLock
        self._locks: Dict[int, FileLock] = {}
        
        # Cursor positions: file_id -> {user_id -> CursorPosition}
        self._cursors: Dict[int, Dict[int, CursorPosition]] = {}
        
        # Active editors: file_id -> set of user_ids
        self._active_editors: Dict[int, Set[int]] = {}
        
        # Lock for thread-safe operations
        self._lock = asyncio.Lock()
        
        # Background task for lock cleanup
        self._cleanup_task: Optional[asyncio.Task] = None
    
    async def start(self):
        """Start the workspace service background tasks."""
        if self._cleanup_task is None:
            self._cleanup_task = asyncio.create_task(self._cleanup_loop())
            logger.info("Realtime workspace service started")
    
    async def stop(self):
        """Stop the workspace service background tasks."""
        if self._cleanup_task:
            self._cleanup_task.cancel()
            try:
                await self._cleanup_task
            except asyncio.CancelledError:
                pass
            self._cleanup_task = None
            logger.info("Realtime workspace service stopped")
    
    async def _cleanup_loop(self):
        """Background loop to clean up expired locks."""
        while True:
            try:
                await asyncio.sleep(60)  # Check every minute
                await self._cleanup_expired_locks()
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error in cleanup loop: {e}")
    
    async def _cleanup_expired_locks(self):
        """Remove expired file locks."""
        async with self._lock:
            expired = [
                file_id for file_id, lock in self._locks.items()
                if lock.is_expired()
            ]
            
            for file_id in expired:
                lock = self._locks.pop(file_id)
                logger.debug(f"Expired lock removed for file {file_id}")
                
                # Notify room
                await self._broadcast_file_unlocked(file_id, lock)
    
    def get_workspace_room(self, workspace_id: int) -> str:
        """Get room name for a workspace."""
        return f"workspace:{workspace_id}"
    
    def get_file_room(self, file_id: int) -> str:
        """Get room name for a file."""
        return f"file:{file_id}"
    
    async def join_workspace(self, user_id: int, workspace_id: int) -> bool:
        """Join a user to a workspace room."""
        room = self.get_workspace_room(workspace_id)
        return await connection_manager.join_room(user_id, room)
    
    async def leave_workspace(self, user_id: int, workspace_id: int) -> bool:
        """Remove a user from a workspace room."""
        room = self.get_workspace_room(workspace_id)
        return await connection_manager.leave_room(user_id, room)
    
    async def open_file(
        self,
        user_id: int,
        username: str,
        file_id: int,
        workspace_id: int
    ):
        """Track that a user has opened a file."""
        async with self._lock:
            if file_id not in self._active_editors:
                self._active_editors[file_id] = set()
            self._active_editors[file_id].add(user_id)
        
        # Join file room
        room = self.get_file_room(file_id)
        await connection_manager.join_room(user_id, room)
        
        # Notify workspace
        workspace_room = self.get_workspace_room(workspace_id)
        await connection_manager.broadcast_to_room(
            workspace_room,
            WebSocketMessage(
                type=EventType.FILE_UPDATE,
                payload={
                    "action": "user_opened",
                    "file_id": file_id,
                    "user_id": user_id,
                    "username": username,
                    "active_editors": list(self._active_editors.get(file_id, set()))
                },
                sender_id=user_id,
                room=workspace_room
            ),
            exclude_user=user_id
        )
    
    async def close_file(
        self,
        user_id: int,
        username: str,
        file_id: int,
        workspace_id: int
    ):
        """Track that a user has closed a file."""
        async with self._lock:
            if file_id in self._active_editors:
                self._active_editors[file_id].discard(user_id)
                if not self._active_editors[file_id]:
                    del self._active_editors[file_id]
            
            # Remove cursor
            if file_id in self._cursors and user_id in self._cursors[file_id]:
                del self._cursors[file_id][user_id]
            
            # Release lock if held
            if file_id in self._locks and self._locks[file_id].user_id == user_id:
                lock = self._locks.pop(file_id)
                await self._broadcast_file_unlocked(file_id, lock)
        
        # Leave file room
        room = self.get_file_room(file_id)
        await connection_manager.leave_room(user_id, room)
        
        # Notify workspace
        workspace_room = self.get_workspace_room(workspace_id)
        await connection_manager.broadcast_to_room(
            workspace_room,
            WebSocketMessage(
                type=EventType.FILE_UPDATE,
                payload={
                    "action": "user_closed",
                    "file_id": file_id,
                    "user_id": user_id,
                    "username": username,
                    "active_editors": list(self._active_editors.get(file_id, set()))
                },
                sender_id=user_id,
                room=workspace_room
            )
        )
    
    async def lock_file(
        self,
        user_id: int,
        username: str,
        file_id: int
    ) -> Dict[str, Any]:
        """Attempt to lock a file for editing."""
        async with self._lock:
            # Check if already locked
            if file_id in self._locks:
                existing_lock = self._locks[file_id]
                if existing_lock.is_expired():
                    # Take over expired lock
                    del self._locks[file_id]
                elif existing_lock.user_id == user_id:
                    # Extend own lock
                    existing_lock.extend()
                    return {
                        "success": True,
                        "lock": existing_lock.to_dict(),
                        "extended": True
                    }
                else:
                    # Locked by another user
                    return {
                        "success": False,
                        "error": "File is locked by another user",
                        "lock": existing_lock.to_dict()
                    }
            
            # Create new lock
            lock = FileLock(
                file_id=file_id,
                user_id=user_id,
                username=username
            )
            self._locks[file_id] = lock
        
        # Broadcast lock
        room = self.get_file_room(file_id)
        await connection_manager.broadcast_to_room(
            room,
            WebSocketMessage(
                type=EventType.FILE_LOCKED,
                payload=lock.to_dict(),
                sender_id=user_id,
                room=room
            ),
            exclude_user=user_id
        )
        
        return {"success": True, "lock": lock.to_dict()}
    
    async def unlock_file(
        self,
        user_id: int,
        file_id: int
    ) -> Dict[str, Any]:
        """Release a file lock."""
        async with self._lock:
            if file_id not in self._locks:
                return {"success": True, "message": "File was not locked"}
            
            lock = self._locks[file_id]
            if lock.user_id != user_id:
                return {
                    "success": False,
                    "error": "Cannot unlock file locked by another user"
                }
            
            del self._locks[file_id]
        
        await self._broadcast_file_unlocked(file_id, lock)
        
        return {"success": True}
    
    async def _broadcast_file_unlocked(self, file_id: int, lock: FileLock):
        """Broadcast file unlock event."""
        room = self.get_file_room(file_id)
        await connection_manager.broadcast_to_room(
            room,
            WebSocketMessage(
                type=EventType.FILE_UNLOCKED,
                payload={
                    "file_id": file_id,
                    "previous_owner": {
                        "user_id": lock.user_id,
                        "username": lock.username
                    }
                },
                room=room
            )
        )
    
    async def update_cursor(
        self,
        user_id: int,
        username: str,
        file_id: int,
        line: int,
        column: int,
        selection_start: Optional[Dict[str, int]] = None,
        selection_end: Optional[Dict[str, int]] = None
    ):
        """Update user's cursor position in a file."""
        cursor = CursorPosition(
            user_id=user_id,
            username=username,
            file_id=file_id,
            line=line,
            column=column,
            selection_start=selection_start,
            selection_end=selection_end
        )
        
        async with self._lock:
            if file_id not in self._cursors:
                self._cursors[file_id] = {}
            self._cursors[file_id][user_id] = cursor
        
        # Broadcast cursor update
        room = self.get_file_room(file_id)
        await connection_manager.broadcast_to_room(
            room,
            WebSocketMessage(
                type=EventType.CURSOR_UPDATE,
                payload=cursor.to_dict(),
                sender_id=user_id,
                room=room
            ),
            exclude_user=user_id
        )
    
    async def notify_file_saved(
        self,
        user_id: int,
        username: str,
        file_id: int,
        workspace_id: int,
        version: int
    ):
        """Notify that a file has been saved."""
        workspace_room = self.get_workspace_room(workspace_id)
        file_room = self.get_file_room(file_id)
        
        message = WebSocketMessage(
            type=EventType.FILE_UPDATE,
            payload={
                "action": "saved",
                "file_id": file_id,
                "user_id": user_id,
                "username": username,
                "version": version,
                "saved_at": datetime.utcnow().isoformat()
            },
            sender_id=user_id
        )
        
        # Notify both rooms
        await connection_manager.broadcast_to_room(workspace_room, message, exclude_user=user_id)
        await connection_manager.broadcast_to_room(file_room, message, exclude_user=user_id)
    
    async def notify_file_created(
        self,
        user_id: int,
        username: str,
        file_data: Dict[str, Any],
        workspace_id: int
    ):
        """Notify that a new file has been created."""
        workspace_room = self.get_workspace_room(workspace_id)
        
        await connection_manager.broadcast_to_room(
            workspace_room,
            WebSocketMessage(
                type=EventType.FILE_UPDATE,
                payload={
                    "action": "created",
                    "file": file_data,
                    "user_id": user_id,
                    "username": username
                },
                sender_id=user_id,
                room=workspace_room
            ),
            exclude_user=user_id
        )
    
    async def notify_file_deleted(
        self,
        user_id: int,
        username: str,
        file_id: int,
        workspace_id: int
    ):
        """Notify that a file has been deleted."""
        workspace_room = self.get_workspace_room(workspace_id)
        
        # Clean up file state
        async with self._lock:
            self._active_editors.pop(file_id, None)
            self._cursors.pop(file_id, None)
            self._locks.pop(file_id, None)
        
        await connection_manager.broadcast_to_room(
            workspace_room,
            WebSocketMessage(
                type=EventType.FILE_UPDATE,
                payload={
                    "action": "deleted",
                    "file_id": file_id,
                    "user_id": user_id,
                    "username": username
                },
                sender_id=user_id,
                room=workspace_room
            ),
            exclude_user=user_id
        )
    
    def get_file_lock(self, file_id: int) -> Optional[Dict[str, Any]]:
        """Get lock info for a file."""
        lock = self._locks.get(file_id)
        if lock and not lock.is_expired():
            return lock.to_dict()
        return None
    
    def get_file_cursors(self, file_id: int) -> List[Dict[str, Any]]:
        """Get all cursor positions for a file."""
        cursors = self._cursors.get(file_id, {})
        return [c.to_dict() for c in cursors.values()]
    
    def get_active_editors(self, file_id: int) -> List[int]:
        """Get list of users editing a file."""
        return list(self._active_editors.get(file_id, set()))
    
    def is_file_locked(self, file_id: int) -> bool:
        """Check if a file is locked."""
        lock = self._locks.get(file_id)
        return lock is not None and not lock.is_expired()
    
    def get_lock_owner(self, file_id: int) -> Optional[int]:
        """Get the user ID of the lock owner."""
        lock = self._locks.get(file_id)
        if lock and not lock.is_expired():
            return lock.user_id
        return None


# Global instance
realtime_workspace = RealtimeWorkspaceService()
