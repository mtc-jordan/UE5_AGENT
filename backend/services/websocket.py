"""
WebSocket Connection Manager for Real-time Collaboration.

Handles WebSocket connections, room management, and message broadcasting.
"""

import asyncio
import json
import logging
from datetime import datetime
from typing import Dict, Set, Optional, Any, List, Callable
from dataclasses import dataclass, field
from enum import Enum
from fastapi import WebSocket, WebSocketDisconnect
from collections import defaultdict
import jwt
from core.config import settings

logger = logging.getLogger(__name__)


class EventType(str, Enum):
    """WebSocket event types."""
    # Connection events
    CONNECT = "connect"
    DISCONNECT = "disconnect"
    ERROR = "error"
    PING = "ping"
    PONG = "pong"
    
    # Room events
    JOIN_ROOM = "join_room"
    LEAVE_ROOM = "leave_room"
    ROOM_JOINED = "room_joined"
    ROOM_LEFT = "room_left"
    
    # Chat events
    MESSAGE = "message"
    MESSAGE_SENT = "message_sent"
    MESSAGE_DELIVERED = "message_delivered"
    MESSAGE_READ = "message_read"
    TYPING_START = "typing_start"
    TYPING_STOP = "typing_stop"
    
    # Presence events
    PRESENCE_UPDATE = "presence_update"
    USER_JOINED = "user_joined"
    USER_LEFT = "user_left"
    USERS_ONLINE = "users_online"
    
    # Workspace events
    FILE_UPDATE = "file_update"
    FILE_LOCKED = "file_locked"
    FILE_UNLOCKED = "file_unlocked"
    CURSOR_UPDATE = "cursor_update"
    
    # Notification events
    NOTIFICATION = "notification"


@dataclass
class WebSocketMessage:
    """Structured WebSocket message."""
    type: EventType
    payload: Dict[str, Any] = field(default_factory=dict)
    timestamp: str = field(default_factory=lambda: datetime.utcnow().isoformat())
    sender_id: Optional[int] = None
    room: Optional[str] = None
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "type": self.type.value if isinstance(self.type, EventType) else self.type,
            "payload": self.payload,
            "timestamp": self.timestamp,
            "sender_id": self.sender_id,
            "room": self.room
        }
    
    def to_json(self) -> str:
        return json.dumps(self.to_dict())
    
    @classmethod
    def from_json(cls, data: str) -> "WebSocketMessage":
        parsed = json.loads(data)
        return cls(
            type=parsed.get("type", "unknown"),
            payload=parsed.get("payload", {}),
            timestamp=parsed.get("timestamp", datetime.utcnow().isoformat()),
            sender_id=parsed.get("sender_id"),
            room=parsed.get("room")
        )


@dataclass
class Connection:
    """Represents a WebSocket connection."""
    websocket: WebSocket
    user_id: int
    username: str
    connected_at: datetime = field(default_factory=datetime.utcnow)
    rooms: Set[str] = field(default_factory=set)
    is_typing: Dict[str, bool] = field(default_factory=dict)  # room -> is_typing
    last_activity: datetime = field(default_factory=datetime.utcnow)
    
    def update_activity(self):
        self.last_activity = datetime.utcnow()


class ConnectionManager:
    """
    Manages WebSocket connections, rooms, and message broadcasting.
    
    Features:
    - Connection lifecycle management
    - Room-based message routing
    - User presence tracking
    - Typing indicators
    - Heartbeat/ping-pong
    """
    
    def __init__(self):
        # Active connections: user_id -> Connection
        self._connections: Dict[int, Connection] = {}
        
        # Room memberships: room_name -> set of user_ids
        self._rooms: Dict[str, Set[int]] = defaultdict(set)
        
        # Typing status: room_name -> set of user_ids currently typing
        self._typing: Dict[str, Set[int]] = defaultdict(set)
        
        # Event handlers: event_type -> list of handlers
        self._handlers: Dict[str, List[Callable]] = defaultdict(list)
        
        # Lock for thread-safe operations
        self._lock = asyncio.Lock()
        
        # Heartbeat interval in seconds
        self.heartbeat_interval = 30
        
        # Typing timeout in seconds
        self.typing_timeout = 5
    
    async def connect(
        self,
        websocket: WebSocket,
        user_id: int,
        username: str
    ) -> Connection:
        """Accept a new WebSocket connection."""
        await websocket.accept()
        
        async with self._lock:
            # Close existing connection if user reconnects
            if user_id in self._connections:
                old_conn = self._connections[user_id]
                try:
                    await old_conn.websocket.close()
                except Exception:
                    pass
            
            # Create new connection
            connection = Connection(
                websocket=websocket,
                user_id=user_id,
                username=username
            )
            self._connections[user_id] = connection
            
            # Add to global room
            self._rooms["global"].add(user_id)
            connection.rooms.add("global")
        
        logger.info(f"User {username} (ID: {user_id}) connected. Total connections: {len(self._connections)}")
        
        # Broadcast presence update
        await self.broadcast_to_room(
            "global",
            WebSocketMessage(
                type=EventType.USER_JOINED,
                payload={
                    "user_id": user_id,
                    "username": username,
                    "online_count": len(self._connections)
                },
                sender_id=user_id
            ),
            exclude_user=user_id
        )
        
        # Send current online users to the new connection
        online_users = [
            {"user_id": uid, "username": conn.username}
            for uid, conn in self._connections.items()
        ]
        await self.send_to_user(
            user_id,
            WebSocketMessage(
                type=EventType.USERS_ONLINE,
                payload={"users": online_users}
            )
        )
        
        return connection
    
    async def disconnect(self, user_id: int):
        """Handle WebSocket disconnection."""
        async with self._lock:
            if user_id not in self._connections:
                return
            
            connection = self._connections[user_id]
            username = connection.username
            
            # Remove from all rooms
            for room in list(connection.rooms):
                self._rooms[room].discard(user_id)
                self._typing[room].discard(user_id)
            
            # Remove connection
            del self._connections[user_id]
        
        logger.info(f"User {username} (ID: {user_id}) disconnected. Total connections: {len(self._connections)}")
        
        # Broadcast presence update
        await self.broadcast_to_room(
            "global",
            WebSocketMessage(
                type=EventType.USER_LEFT,
                payload={
                    "user_id": user_id,
                    "username": username,
                    "online_count": len(self._connections)
                },
                sender_id=user_id
            )
        )
    
    async def join_room(self, user_id: int, room: str) -> bool:
        """Add user to a room."""
        async with self._lock:
            if user_id not in self._connections:
                return False
            
            connection = self._connections[user_id]
            self._rooms[room].add(user_id)
            connection.rooms.add(room)
        
        logger.debug(f"User {user_id} joined room {room}")
        
        # Notify room members
        await self.broadcast_to_room(
            room,
            WebSocketMessage(
                type=EventType.USER_JOINED,
                payload={
                    "user_id": user_id,
                    "username": connection.username,
                    "room": room
                },
                sender_id=user_id,
                room=room
            ),
            exclude_user=user_id
        )
        
        # Send room info to user
        room_users = [
            {"user_id": uid, "username": self._connections[uid].username}
            for uid in self._rooms[room]
            if uid in self._connections
        ]
        await self.send_to_user(
            user_id,
            WebSocketMessage(
                type=EventType.ROOM_JOINED,
                payload={
                    "room": room,
                    "users": room_users
                },
                room=room
            )
        )
        
        return True
    
    async def leave_room(self, user_id: int, room: str) -> bool:
        """Remove user from a room."""
        if room == "global":
            return False  # Can't leave global room
        
        async with self._lock:
            if user_id not in self._connections:
                return False
            
            connection = self._connections[user_id]
            self._rooms[room].discard(user_id)
            connection.rooms.discard(room)
            self._typing[room].discard(user_id)
        
        logger.debug(f"User {user_id} left room {room}")
        
        # Notify room members
        await self.broadcast_to_room(
            room,
            WebSocketMessage(
                type=EventType.USER_LEFT,
                payload={
                    "user_id": user_id,
                    "username": connection.username,
                    "room": room
                },
                sender_id=user_id,
                room=room
            )
        )
        
        # Confirm to user
        await self.send_to_user(
            user_id,
            WebSocketMessage(
                type=EventType.ROOM_LEFT,
                payload={"room": room},
                room=room
            )
        )
        
        return True
    
    async def send_to_user(self, user_id: int, message: WebSocketMessage) -> bool:
        """Send a message to a specific user."""
        if user_id not in self._connections:
            return False
        
        try:
            await self._connections[user_id].websocket.send_text(message.to_json())
            return True
        except Exception as e:
            logger.error(f"Failed to send message to user {user_id}: {e}")
            await self.disconnect(user_id)
            return False
    
    async def broadcast_to_room(
        self,
        room: str,
        message: WebSocketMessage,
        exclude_user: Optional[int] = None
    ):
        """Broadcast a message to all users in a room."""
        if room not in self._rooms:
            return
        
        message.room = room
        disconnected = []
        
        for user_id in self._rooms[room]:
            if exclude_user and user_id == exclude_user:
                continue
            
            if user_id in self._connections:
                try:
                    await self._connections[user_id].websocket.send_text(message.to_json())
                except Exception as e:
                    logger.error(f"Failed to broadcast to user {user_id}: {e}")
                    disconnected.append(user_id)
        
        # Clean up disconnected users
        for user_id in disconnected:
            await self.disconnect(user_id)
    
    async def broadcast_to_all(
        self,
        message: WebSocketMessage,
        exclude_user: Optional[int] = None
    ):
        """Broadcast a message to all connected users."""
        await self.broadcast_to_room("global", message, exclude_user)
    
    async def set_typing(self, user_id: int, room: str, is_typing: bool):
        """Update typing status for a user in a room."""
        if user_id not in self._connections:
            return
        
        connection = self._connections[user_id]
        
        async with self._lock:
            if is_typing:
                self._typing[room].add(user_id)
                connection.is_typing[room] = True
            else:
                self._typing[room].discard(user_id)
                connection.is_typing[room] = False
        
        # Broadcast typing status
        await self.broadcast_to_room(
            room,
            WebSocketMessage(
                type=EventType.TYPING_START if is_typing else EventType.TYPING_STOP,
                payload={
                    "user_id": user_id,
                    "username": connection.username,
                    "typing_users": [
                        {"user_id": uid, "username": self._connections[uid].username}
                        for uid in self._typing[room]
                        if uid in self._connections
                    ]
                },
                sender_id=user_id,
                room=room
            ),
            exclude_user=user_id
        )
    
    def get_room_users(self, room: str) -> List[Dict[str, Any]]:
        """Get list of users in a room."""
        return [
            {
                "user_id": uid,
                "username": self._connections[uid].username,
                "is_typing": self._connections[uid].is_typing.get(room, False)
            }
            for uid in self._rooms.get(room, set())
            if uid in self._connections
        ]
    
    def get_online_users(self) -> List[Dict[str, Any]]:
        """Get list of all online users."""
        return [
            {
                "user_id": uid,
                "username": conn.username,
                "connected_at": conn.connected_at.isoformat(),
                "rooms": list(conn.rooms)
            }
            for uid, conn in self._connections.items()
        ]
    
    def is_user_online(self, user_id: int) -> bool:
        """Check if a user is online."""
        return user_id in self._connections
    
    def get_connection(self, user_id: int) -> Optional[Connection]:
        """Get connection for a user."""
        return self._connections.get(user_id)
    
    @property
    def connection_count(self) -> int:
        """Get total number of active connections."""
        return len(self._connections)
    
    async def handle_message(self, user_id: int, raw_message: str):
        """Handle incoming WebSocket message."""
        try:
            message = WebSocketMessage.from_json(raw_message)
            message.sender_id = user_id
            
            # Update activity
            if user_id in self._connections:
                self._connections[user_id].update_activity()
            
            # Route message based on type
            event_type = message.type
            
            if event_type == EventType.PING.value:
                await self.send_to_user(user_id, WebSocketMessage(type=EventType.PONG))
            
            elif event_type == EventType.JOIN_ROOM.value:
                room = message.payload.get("room")
                if room:
                    await self.join_room(user_id, room)
            
            elif event_type == EventType.LEAVE_ROOM.value:
                room = message.payload.get("room")
                if room:
                    await self.leave_room(user_id, room)
            
            elif event_type == EventType.TYPING_START.value:
                room = message.payload.get("room") or message.room
                if room:
                    await self.set_typing(user_id, room, True)
            
            elif event_type == EventType.TYPING_STOP.value:
                room = message.payload.get("room") or message.room
                if room:
                    await self.set_typing(user_id, room, False)
            
            elif event_type == EventType.MESSAGE.value:
                # Forward message to room
                room = message.payload.get("room") or message.room
                if room:
                    await self.broadcast_to_room(room, message)
            
            # Call registered handlers
            for handler in self._handlers.get(event_type, []):
                try:
                    await handler(user_id, message)
                except Exception as e:
                    logger.error(f"Handler error for {event_type}: {e}")
        
        except json.JSONDecodeError as e:
            logger.error(f"Invalid JSON from user {user_id}: {e}")
            await self.send_to_user(
                user_id,
                WebSocketMessage(
                    type=EventType.ERROR,
                    payload={"message": "Invalid message format"}
                )
            )
        except Exception as e:
            logger.error(f"Error handling message from user {user_id}: {e}")
    
    def on_event(self, event_type: str):
        """Decorator to register event handlers."""
        def decorator(handler: Callable):
            self._handlers[event_type].append(handler)
            return handler
        return decorator


# Global connection manager instance
connection_manager = ConnectionManager()


async def authenticate_websocket(websocket: WebSocket) -> Optional[Dict[str, Any]]:
    """Authenticate WebSocket connection using JWT token."""
    # Try to get token from query params
    token = websocket.query_params.get("token")
    
    if not token:
        # Try to get from first message
        return None
    
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
