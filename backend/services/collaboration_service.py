"""
Real-time Collaboration Service
Handles WebSocket connections, presence tracking, and cursor synchronization
"""
from typing import Dict, Set, Optional, List
from dataclasses import dataclass, asdict
from datetime import datetime
import asyncio
import json
from fastapi import WebSocket


@dataclass
class UserPresence:
    """User presence information"""
    user_id: int
    username: str
    email: str
    color: str
    current_file_id: Optional[int] = None
    current_file_path: Optional[str] = None
    cursor_position: Optional[Dict] = None  # {line: int, column: int}
    selection: Optional[Dict] = None  # {start: {line, column}, end: {line, column}}
    is_typing: bool = False
    last_activity: datetime = None
    
    def to_dict(self):
        data = asdict(self)
        if self.last_activity:
            data['last_activity'] = self.last_activity.isoformat()
        return data


class CollaborationService:
    """Manages real-time collaboration sessions"""
    
    # User colors for visual distinction
    USER_COLORS = [
        "#3B82F6",  # Blue
        "#10B981",  # Green
        "#F59E0B",  # Amber
        "#EF4444",  # Red
        "#8B5CF6",  # Purple
        "#EC4899",  # Pink
        "#06B6D4",  # Cyan
        "#84CC16",  # Lime
        "#F97316",  # Orange
        "#14B8A6",  # Teal
    ]
    
    def __init__(self):
        # Active WebSocket connections: {user_id: WebSocket}
        self.connections: Dict[int, WebSocket] = {}
        
        # User presence data: {user_id: UserPresence}
        self.presence: Dict[int, UserPresence] = {}
        
        # File viewers: {file_id: Set[user_id]}
        self.file_viewers: Dict[int, Set[int]] = {}
        
        # Color assignments: {user_id: color}
        self.user_colors: Dict[int, str] = {}
        
        # Next color index
        self._color_index = 0
    
    def _assign_color(self, user_id: int) -> str:
        """Assign a unique color to a user"""
        if user_id not in self.user_colors:
            color = self.USER_COLORS[self._color_index % len(self.USER_COLORS)]
            self.user_colors[user_id] = color
            self._color_index += 1
        return self.user_colors[user_id]
    
    async def connect(self, user_id: int, username: str, email: str, websocket: WebSocket):
        """Register a new WebSocket connection"""
        await websocket.accept()
        
        # Store connection
        self.connections[user_id] = websocket
        
        # Create presence
        color = self._assign_color(user_id)
        self.presence[user_id] = UserPresence(
            user_id=user_id,
            username=username,
            email=email,
            color=color,
            last_activity=datetime.now()
        )
        
        # Notify all users about new connection
        await self.broadcast_presence_update(user_id, "joined")
        
        # Send current presence to new user
        await self.send_full_presence(user_id)
    
    async def disconnect(self, user_id: int):
        """Handle user disconnection"""
        if user_id in self.connections:
            del self.connections[user_id]
        
        if user_id in self.presence:
            # Remove from file viewers
            presence = self.presence[user_id]
            if presence.current_file_id and presence.current_file_id in self.file_viewers:
                self.file_viewers[presence.current_file_id].discard(user_id)
            
            del self.presence[user_id]
        
        # Notify all users about disconnection
        await self.broadcast_presence_update(user_id, "left")
    
    async def update_cursor(self, user_id: int, file_id: int, file_path: str, 
                           cursor_position: Dict, selection: Optional[Dict] = None):
        """Update user's cursor position"""
        if user_id not in self.presence:
            return
        
        presence = self.presence[user_id]
        presence.current_file_id = file_id
        presence.current_file_path = file_path
        presence.cursor_position = cursor_position
        presence.selection = selection
        presence.last_activity = datetime.now()
        
        # Update file viewers
        if file_id not in self.file_viewers:
            self.file_viewers[file_id] = set()
        self.file_viewers[file_id].add(user_id)
        
        # Broadcast cursor update to users viewing the same file
        await self.broadcast_cursor_update(user_id, file_id)
    
    async def update_typing_status(self, user_id: int, is_typing: bool):
        """Update user's typing status"""
        if user_id not in self.presence:
            return
        
        presence = self.presence[user_id]
        presence.is_typing = is_typing
        presence.last_activity = datetime.now()
        
        # Broadcast typing status to users viewing the same file
        if presence.current_file_id:
            await self.broadcast_typing_status(user_id, presence.current_file_id, is_typing)
    
    async def change_file(self, user_id: int, file_id: Optional[int], file_path: Optional[str]):
        """Update which file the user is viewing"""
        if user_id not in self.presence:
            return
        
        presence = self.presence[user_id]
        
        # Remove from old file viewers
        if presence.current_file_id and presence.current_file_id in self.file_viewers:
            self.file_viewers[presence.current_file_id].discard(user_id)
        
        # Update presence
        presence.current_file_id = file_id
        presence.current_file_path = file_path
        presence.cursor_position = None
        presence.selection = None
        presence.is_typing = False
        presence.last_activity = datetime.now()
        
        # Add to new file viewers
        if file_id:
            if file_id not in self.file_viewers:
                self.file_viewers[file_id] = set()
            self.file_viewers[file_id].add(user_id)
        
        # Broadcast file change
        await self.broadcast_presence_update(user_id, "file_changed")
    
    async def send_message(self, user_id: int, message: Dict):
        """Send a message to a specific user"""
        if user_id in self.connections:
            try:
                await self.connections[user_id].send_json(message)
            except Exception as e:
                print(f"Error sending message to user {user_id}: {e}")
                await self.disconnect(user_id)
    
    async def broadcast(self, message: Dict, exclude_user: Optional[int] = None):
        """Broadcast a message to all connected users"""
        disconnected = []
        for user_id, websocket in self.connections.items():
            if exclude_user and user_id == exclude_user:
                continue
            try:
                await websocket.send_json(message)
            except Exception as e:
                print(f"Error broadcasting to user {user_id}: {e}")
                disconnected.append(user_id)
        
        # Clean up disconnected users
        for user_id in disconnected:
            await self.disconnect(user_id)
    
    async def broadcast_to_file_viewers(self, file_id: int, message: Dict, 
                                       exclude_user: Optional[int] = None):
        """Broadcast a message to users viewing a specific file"""
        if file_id not in self.file_viewers:
            return
        
        viewers = self.file_viewers[file_id].copy()
        disconnected = []
        
        for user_id in viewers:
            if exclude_user and user_id == exclude_user:
                continue
            if user_id in self.connections:
                try:
                    await self.connections[user_id].send_json(message)
                except Exception as e:
                    print(f"Error sending to user {user_id}: {e}")
                    disconnected.append(user_id)
        
        # Clean up disconnected users
        for user_id in disconnected:
            await self.disconnect(user_id)
    
    async def send_full_presence(self, user_id: int):
        """Send full presence list to a user"""
        presence_list = [p.to_dict() for p in self.presence.values()]
        await self.send_message(user_id, {
            "type": "presence_full",
            "users": presence_list
        })
    
    async def broadcast_presence_update(self, user_id: int, event: str):
        """Broadcast presence update to all users"""
        if user_id in self.presence:
            presence = self.presence[user_id].to_dict()
        else:
            presence = {"user_id": user_id}
        
        await self.broadcast({
            "type": "presence_update",
            "event": event,
            "user": presence
        })
    
    async def broadcast_cursor_update(self, user_id: int, file_id: int):
        """Broadcast cursor position to users viewing the same file"""
        if user_id not in self.presence:
            return
        
        presence = self.presence[user_id]
        await self.broadcast_to_file_viewers(file_id, {
            "type": "cursor_update",
            "user_id": user_id,
            "username": presence.username,
            "color": presence.color,
            "cursor_position": presence.cursor_position,
            "selection": presence.selection
        }, exclude_user=user_id)
    
    async def broadcast_typing_status(self, user_id: int, file_id: int, is_typing: bool):
        """Broadcast typing status to users viewing the same file"""
        if user_id not in self.presence:
            return
        
        presence = self.presence[user_id]
        await self.broadcast_to_file_viewers(file_id, {
            "type": "typing_status",
            "user_id": user_id,
            "username": presence.username,
            "is_typing": is_typing
        }, exclude_user=user_id)
    
    def get_online_users(self) -> List[Dict]:
        """Get list of all online users"""
        return [p.to_dict() for p in self.presence.values()]
    
    def get_file_viewers(self, file_id: int) -> List[Dict]:
        """Get list of users viewing a specific file"""
        if file_id not in self.file_viewers:
            return []
        
        viewers = []
        for user_id in self.file_viewers[file_id]:
            if user_id in self.presence:
                viewers.append(self.presence[user_id].to_dict())
        return viewers
    
    def get_user_presence(self, user_id: int) -> Optional[Dict]:
        """Get presence data for a specific user"""
        if user_id in self.presence:
            return self.presence[user_id].to_dict()
        return None


# Global collaboration service instance
collaboration_service = CollaborationService()
