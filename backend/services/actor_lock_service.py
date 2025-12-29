"""
Actor Lock Service
==================

Real-time WebSocket service for managing actor locks in collaborative UE5 sessions.
Provides:
- Actor locking/unlocking
- Lock status broadcasting
- Conflict detection
- Auto-release on disconnect
- Lock timeout management
"""

import asyncio
import logging
from typing import Dict, Set, Optional, Any, List
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from fastapi import WebSocket, WebSocketDisconnect
import json

logger = logging.getLogger(__name__)


@dataclass
class ActorLock:
    """Represents a lock on an actor."""
    actor_id: str
    actor_name: str
    user_id: int
    user_name: str
    user_color: str
    locked_at: datetime = field(default_factory=datetime.utcnow)
    expires_at: Optional[datetime] = None
    
    def is_expired(self) -> bool:
        if self.expires_at is None:
            return False
        return datetime.utcnow() > self.expires_at
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "actor_id": self.actor_id,
            "actor_name": self.actor_name,
            "user_id": self.user_id,
            "user_name": self.user_name,
            "user_color": self.user_color,
            "locked_at": self.locked_at.isoformat(),
            "expires_at": self.expires_at.isoformat() if self.expires_at else None
        }


@dataclass
class CollaborationSession:
    """Represents a collaboration session."""
    session_id: str
    project_id: str
    created_at: datetime = field(default_factory=datetime.utcnow)
    
    # Connected users: user_id -> WebSocket
    connections: Dict[int, WebSocket] = field(default_factory=dict)
    
    # User info: user_id -> user details
    users: Dict[int, Dict[str, Any]] = field(default_factory=dict)
    
    # Actor locks: actor_id -> ActorLock
    locks: Dict[str, ActorLock] = field(default_factory=dict)
    
    # User selections: user_id -> Set of actor_ids
    selections: Dict[int, Set[str]] = field(default_factory=dict)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "session_id": self.session_id,
            "project_id": self.project_id,
            "created_at": self.created_at.isoformat(),
            "user_count": len(self.connections),
            "lock_count": len(self.locks),
            "users": list(self.users.values()),
            "locks": [lock.to_dict() for lock in self.locks.values()]
        }


class ActorLockService:
    """
    Service for managing actor locks in collaborative sessions.
    
    Features:
    - Real-time lock synchronization via WebSocket
    - Automatic lock release on disconnect
    - Lock timeout with auto-release
    - Selection broadcasting
    - Conflict detection and resolution
    """
    
    def __init__(self):
        # Sessions: session_id -> CollaborationSession
        self._sessions: Dict[str, CollaborationSession] = {}
        
        # User to session mapping: user_id -> session_id
        self._user_sessions: Dict[int, str] = {}
        
        # Lock for thread-safe operations
        self._lock = asyncio.Lock()
        
        # Lock timeout in minutes (0 = no timeout)
        self.lock_timeout_minutes = 30
        
        # Cleanup task
        self._cleanup_task: Optional[asyncio.Task] = None
        
    async def start(self):
        """Start the actor lock service."""
        self._cleanup_task = asyncio.create_task(self._cleanup_loop())
        logger.info("Actor Lock Service started")
        
    async def stop(self):
        """Stop the actor lock service."""
        if self._cleanup_task:
            self._cleanup_task.cancel()
            try:
                await self._cleanup_task
            except asyncio.CancelledError:
                pass
        
        # Close all connections
        async with self._lock:
            for session in self._sessions.values():
                for ws in session.connections.values():
                    try:
                        await ws.close()
                    except Exception:
                        pass
            self._sessions.clear()
            self._user_sessions.clear()
        
        logger.info("Actor Lock Service stopped")
    
    async def _cleanup_loop(self):
        """Periodically clean up expired locks."""
        while True:
            try:
                await asyncio.sleep(60)  # Check every minute
                
                async with self._lock:
                    for session in self._sessions.values():
                        expired_locks = [
                            actor_id for actor_id, lock in session.locks.items()
                            if lock.is_expired()
                        ]
                        
                        for actor_id in expired_locks:
                            lock = session.locks.pop(actor_id)
                            await self._broadcast_to_session(
                                session.session_id,
                                {
                                    "type": "lock_expired",
                                    "actor_id": actor_id,
                                    "actor_name": lock.actor_name,
                                    "previous_owner": lock.user_name
                                }
                            )
                            logger.info(f"Lock expired: {actor_id} (was held by {lock.user_name})")
                            
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Cleanup loop error: {e}")
    
    async def create_session(
        self,
        session_id: str,
        project_id: str
    ) -> CollaborationSession:
        """Create a new collaboration session."""
        async with self._lock:
            if session_id in self._sessions:
                return self._sessions[session_id]
            
            session = CollaborationSession(
                session_id=session_id,
                project_id=project_id
            )
            self._sessions[session_id] = session
            logger.info(f"Created collaboration session: {session_id}")
            return session
    
    async def join_session(
        self,
        session_id: str,
        user_id: int,
        user_name: str,
        user_color: str,
        websocket: WebSocket
    ) -> bool:
        """Join a collaboration session."""
        async with self._lock:
            session = self._sessions.get(session_id)
            if not session:
                return False
            
            # Leave any existing session
            if user_id in self._user_sessions:
                await self._leave_session_internal(user_id)
            
            # Add to session
            session.connections[user_id] = websocket
            session.users[user_id] = {
                "user_id": user_id,
                "user_name": user_name,
                "user_color": user_color,
                "joined_at": datetime.utcnow().isoformat()
            }
            session.selections[user_id] = set()
            self._user_sessions[user_id] = session_id
            
            # Broadcast join event
            await self._broadcast_to_session(
                session_id,
                {
                    "type": "user_joined",
                    "user_id": user_id,
                    "user_name": user_name,
                    "user_color": user_color
                },
                exclude_user=user_id
            )
            
            logger.info(f"User {user_name} joined session {session_id}")
            return True
    
    async def leave_session(self, user_id: int):
        """Leave the current collaboration session."""
        async with self._lock:
            await self._leave_session_internal(user_id)
    
    async def _leave_session_internal(self, user_id: int):
        """Internal method to leave session (must be called with lock held)."""
        session_id = self._user_sessions.get(user_id)
        if not session_id:
            return
        
        session = self._sessions.get(session_id)
        if not session:
            return
        
        user_info = session.users.get(user_id, {})
        user_name = user_info.get("user_name", "Unknown")
        
        # Release all locks held by this user
        released_locks = []
        for actor_id, lock in list(session.locks.items()):
            if lock.user_id == user_id:
                released_locks.append(actor_id)
                del session.locks[actor_id]
        
        # Remove user from session
        session.connections.pop(user_id, None)
        session.users.pop(user_id, None)
        session.selections.pop(user_id, None)
        self._user_sessions.pop(user_id, None)
        
        # Broadcast leave event
        await self._broadcast_to_session(
            session_id,
            {
                "type": "user_left",
                "user_id": user_id,
                "user_name": user_name,
                "released_locks": released_locks
            }
        )
        
        logger.info(f"User {user_name} left session {session_id}, released {len(released_locks)} locks")
        
        # Clean up empty sessions
        if not session.connections:
            del self._sessions[session_id]
            logger.info(f"Removed empty session: {session_id}")
    
    async def lock_actor(
        self,
        user_id: int,
        actor_id: str,
        actor_name: str
    ) -> Dict[str, Any]:
        """
        Lock an actor for exclusive editing.
        
        Returns:
            Dict with success status and lock info or conflict info
        """
        async with self._lock:
            session_id = self._user_sessions.get(user_id)
            if not session_id:
                return {"success": False, "error": "Not in a session"}
            
            session = self._sessions.get(session_id)
            if not session:
                return {"success": False, "error": "Session not found"}
            
            # Check if already locked
            existing_lock = session.locks.get(actor_id)
            if existing_lock:
                if existing_lock.user_id == user_id:
                    # Already locked by this user
                    return {
                        "success": True,
                        "message": "Already locked by you",
                        "lock": existing_lock.to_dict()
                    }
                else:
                    # Locked by another user
                    return {
                        "success": False,
                        "error": "Actor is locked by another user",
                        "conflict": {
                            "locked_by": existing_lock.user_name,
                            "locked_at": existing_lock.locked_at.isoformat()
                        }
                    }
            
            # Create new lock
            user_info = session.users.get(user_id, {})
            expires_at = None
            if self.lock_timeout_minutes > 0:
                expires_at = datetime.utcnow() + timedelta(minutes=self.lock_timeout_minutes)
            
            lock = ActorLock(
                actor_id=actor_id,
                actor_name=actor_name,
                user_id=user_id,
                user_name=user_info.get("user_name", "Unknown"),
                user_color=user_info.get("user_color", "#3B82F6"),
                expires_at=expires_at
            )
            session.locks[actor_id] = lock
            
            # Broadcast lock event
            await self._broadcast_to_session(
                session_id,
                {
                    "type": "actor_locked",
                    "lock": lock.to_dict()
                }
            )
            
            logger.info(f"Actor {actor_name} locked by {lock.user_name}")
            return {"success": True, "lock": lock.to_dict()}
    
    async def unlock_actor(
        self,
        user_id: int,
        actor_id: str,
        force: bool = False
    ) -> Dict[str, Any]:
        """
        Unlock an actor.
        
        Args:
            user_id: User requesting unlock
            actor_id: Actor to unlock
            force: Force unlock even if not owner (admin only)
            
        Returns:
            Dict with success status
        """
        async with self._lock:
            session_id = self._user_sessions.get(user_id)
            if not session_id:
                return {"success": False, "error": "Not in a session"}
            
            session = self._sessions.get(session_id)
            if not session:
                return {"success": False, "error": "Session not found"}
            
            lock = session.locks.get(actor_id)
            if not lock:
                return {"success": True, "message": "Actor was not locked"}
            
            # Check ownership
            if lock.user_id != user_id and not force:
                return {
                    "success": False,
                    "error": "You don't own this lock",
                    "owner": lock.user_name
                }
            
            # Remove lock
            del session.locks[actor_id]
            
            # Broadcast unlock event
            await self._broadcast_to_session(
                session_id,
                {
                    "type": "actor_unlocked",
                    "actor_id": actor_id,
                    "actor_name": lock.actor_name,
                    "unlocked_by": session.users.get(user_id, {}).get("user_name", "Unknown")
                }
            )
            
            logger.info(f"Actor {lock.actor_name} unlocked")
            return {"success": True}
    
    async def update_selection(
        self,
        user_id: int,
        selected_actors: List[str]
    ) -> Dict[str, Any]:
        """
        Update user's selection and broadcast to others.
        
        Args:
            user_id: User updating selection
            selected_actors: List of selected actor IDs
            
        Returns:
            Dict with success status
        """
        async with self._lock:
            session_id = self._user_sessions.get(user_id)
            if not session_id:
                return {"success": False, "error": "Not in a session"}
            
            session = self._sessions.get(session_id)
            if not session:
                return {"success": False, "error": "Session not found"}
            
            # Update selection
            session.selections[user_id] = set(selected_actors)
            
            user_info = session.users.get(user_id, {})
            
            # Broadcast selection update
            await self._broadcast_to_session(
                session_id,
                {
                    "type": "selection_changed",
                    "user_id": user_id,
                    "user_name": user_info.get("user_name", "Unknown"),
                    "user_color": user_info.get("user_color", "#3B82F6"),
                    "selected_actors": selected_actors
                },
                exclude_user=user_id
            )
            
            return {"success": True}
    
    async def get_session_state(self, session_id: str) -> Optional[Dict[str, Any]]:
        """Get the current state of a session."""
        async with self._lock:
            session = self._sessions.get(session_id)
            if not session:
                return None
            
            return {
                "session": session.to_dict(),
                "selections": {
                    user_id: list(actors)
                    for user_id, actors in session.selections.items()
                }
            }
    
    async def get_user_session(self, user_id: int) -> Optional[str]:
        """Get the session ID for a user."""
        return self._user_sessions.get(user_id)
    
    async def _broadcast_to_session(
        self,
        session_id: str,
        message: Dict[str, Any],
        exclude_user: Optional[int] = None
    ):
        """Broadcast a message to all users in a session."""
        session = self._sessions.get(session_id)
        if not session:
            return
        
        message["timestamp"] = datetime.utcnow().isoformat()
        message_json = json.dumps(message)
        
        disconnected = []
        for user_id, ws in session.connections.items():
            if exclude_user and user_id == exclude_user:
                continue
            
            try:
                await ws.send_text(message_json)
            except Exception as e:
                logger.warning(f"Failed to send to user {user_id}: {e}")
                disconnected.append(user_id)
        
        # Clean up disconnected users
        for user_id in disconnected:
            await self._leave_session_internal(user_id)
    
    async def handle_websocket(
        self,
        websocket: WebSocket,
        session_id: str,
        user_id: int,
        user_name: str,
        user_color: str
    ):
        """
        Handle a WebSocket connection for collaboration.
        
        This is the main entry point for WebSocket connections.
        """
        await websocket.accept()
        
        # Create session if it doesn't exist
        await self.create_session(session_id, session_id)
        
        # Join session
        joined = await self.join_session(
            session_id=session_id,
            user_id=user_id,
            user_name=user_name,
            user_color=user_color,
            websocket=websocket
        )
        
        if not joined:
            await websocket.close(code=4000, reason="Failed to join session")
            return
        
        # Send initial state
        state = await self.get_session_state(session_id)
        await websocket.send_json({
            "type": "session_state",
            "state": state
        })
        
        try:
            while True:
                data = await websocket.receive_json()
                await self._handle_message(user_id, data)
                
        except WebSocketDisconnect:
            logger.info(f"User {user_name} disconnected from session {session_id}")
        except Exception as e:
            logger.error(f"WebSocket error: {e}")
        finally:
            await self.leave_session(user_id)
    
    async def _handle_message(self, user_id: int, data: Dict[str, Any]):
        """Handle an incoming WebSocket message."""
        msg_type = data.get("type")
        
        if msg_type == "lock":
            result = await self.lock_actor(
                user_id=user_id,
                actor_id=data.get("actor_id"),
                actor_name=data.get("actor_name", "Unknown")
            )
            # Response is broadcast to all users
            
        elif msg_type == "unlock":
            result = await self.unlock_actor(
                user_id=user_id,
                actor_id=data.get("actor_id"),
                force=data.get("force", False)
            )
            
        elif msg_type == "selection":
            result = await self.update_selection(
                user_id=user_id,
                selected_actors=data.get("actors", [])
            )
            
        elif msg_type == "ping":
            session_id = self._user_sessions.get(user_id)
            if session_id:
                session = self._sessions.get(session_id)
                if session and user_id in session.connections:
                    await session.connections[user_id].send_json({
                        "type": "pong",
                        "timestamp": datetime.utcnow().isoformat()
                    })


# Global instance
actor_lock_service = ActorLockService()


def get_actor_lock_service() -> ActorLockService:
    """Get the global actor lock service instance."""
    return actor_lock_service
