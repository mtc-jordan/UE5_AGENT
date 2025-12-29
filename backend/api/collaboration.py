"""
Collaboration API endpoints for UE5 AI Agent

Provides real-time collaboration features:
- Session management
- User presence
- Activity tracking
- Actor locking
- Team chat
- Viewport sharing
"""

from fastapi import APIRouter, HTTPException, Depends, WebSocket, WebSocketDisconnect
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from datetime import datetime
import json
import asyncio

router = APIRouter(prefix="/collaboration", tags=["collaboration"])

# ==================== MODELS ====================

class TeamMember(BaseModel):
    id: str
    name: str
    email: str
    avatar: Optional[str] = None
    status: str = "online"  # online, away, busy, offline
    role: str = "editor"  # admin, editor, viewer
    color: str = "#3B82F6"
    current_action: Optional[str] = None
    selected_actors: List[str] = []
    viewport_position: Optional[Dict[str, float]] = None
    joined_at: datetime = datetime.now()
    last_active_at: datetime = datetime.now()

class ActivityItem(BaseModel):
    id: str
    user_id: str
    user_name: str
    user_color: str
    action: str
    target: Optional[str] = None
    details: Optional[str] = None
    timestamp: datetime = datetime.now()
    type: str  # create, modify, delete, select, lock, unlock, chat, join, leave, viewport

class ChatMessage(BaseModel):
    id: str
    user_id: str
    user_name: str
    user_color: str
    content: str
    timestamp: datetime = datetime.now()
    type: str = "text"  # text, image, system
    attachments: List[str] = []

class LockedActor(BaseModel):
    actor_id: str
    actor_name: str
    locked_by: str
    locked_by_name: str
    locked_at: datetime = datetime.now()

class CollaborationSession(BaseModel):
    id: str
    name: str
    project_name: str
    created_by: str
    created_at: datetime = datetime.now()
    members: List[TeamMember] = []
    max_members: int = 10
    is_public: bool = False
    invite_code: Optional[str] = None

class CreateSessionRequest(BaseModel):
    name: str
    project_name: str
    max_members: int = 10
    is_public: bool = False

class JoinSessionRequest(BaseModel):
    session_id: str
    invite_code: Optional[str] = None

class UpdatePresenceRequest(BaseModel):
    status: str
    current_action: Optional[str] = None
    selected_actors: List[str] = []
    viewport_position: Optional[Dict[str, float]] = None

class LockActorRequest(BaseModel):
    actor_id: str
    actor_name: str

class SendChatRequest(BaseModel):
    content: str
    type: str = "text"
    attachments: List[str] = []

class ShareViewportRequest(BaseModel):
    enabled: bool
    quality: str = "medium"  # low, medium, high

# ==================== IN-MEMORY STORAGE ====================
# In production, use Redis or a database

sessions: Dict[str, CollaborationSession] = {}
activities: Dict[str, List[ActivityItem]] = {}
chat_messages: Dict[str, List[ChatMessage]] = {}
locked_actors: Dict[str, List[LockedActor]] = {}
active_connections: Dict[str, List[WebSocket]] = {}

# ==================== WEBSOCKET MANAGER ====================

class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, List[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, session_id: str):
        await websocket.accept()
        if session_id not in self.active_connections:
            self.active_connections[session_id] = []
        self.active_connections[session_id].append(websocket)

    def disconnect(self, websocket: WebSocket, session_id: str):
        if session_id in self.active_connections:
            self.active_connections[session_id].remove(websocket)

    async def broadcast(self, session_id: str, message: dict):
        if session_id in self.active_connections:
            for connection in self.active_connections[session_id]:
                try:
                    await connection.send_json(message)
                except:
                    pass

    async def send_personal(self, websocket: WebSocket, message: dict):
        await websocket.send_json(message)

manager = ConnectionManager()

# ==================== ENDPOINTS ====================

@router.post("/sessions/create")
async def create_session(request: CreateSessionRequest, user_id: str = "user_1"):
    """Create a new collaboration session"""
    import uuid
    
    session_id = str(uuid.uuid4())[:8]
    invite_code = str(uuid.uuid4())[:6].upper()
    
    session = CollaborationSession(
        id=session_id,
        name=request.name,
        project_name=request.project_name,
        created_by=user_id,
        max_members=request.max_members,
        is_public=request.is_public,
        invite_code=invite_code,
        members=[]
    )
    
    sessions[session_id] = session
    activities[session_id] = []
    chat_messages[session_id] = []
    locked_actors[session_id] = []
    
    return {
        "success": True,
        "session": session.dict(),
        "invite_link": f"https://ue5-ai.studio/join/{invite_code}"
    }

@router.post("/sessions/join")
async def join_session(request: JoinSessionRequest, user_id: str = "user_1", user_name: str = "User"):
    """Join an existing collaboration session"""
    session = sessions.get(request.session_id)
    
    if not session:
        # Try to find by invite code
        for s in sessions.values():
            if s.invite_code == request.invite_code:
                session = s
                break
    
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    if len(session.members) >= session.max_members:
        raise HTTPException(status_code=400, detail="Session is full")
    
    # Add member
    member = TeamMember(
        id=user_id,
        name=user_name,
        email=f"{user_id}@example.com",
        status="online",
        role="editor" if len(session.members) > 0 else "admin"
    )
    session.members.append(member)
    
    # Add join activity
    activity = ActivityItem(
        id=str(len(activities[session.id])),
        user_id=user_id,
        user_name=user_name,
        user_color=member.color,
        action="Joined the session",
        type="join"
    )
    activities[session.id].append(activity)
    
    # Broadcast to other members
    await manager.broadcast(session.id, {
        "type": "member_joined",
        "member": member.dict(),
        "activity": activity.dict()
    })
    
    return {
        "success": True,
        "session": session.dict(),
        "activities": [a.dict() for a in activities[session.id][-20:]],
        "chat_messages": [m.dict() for m in chat_messages[session.id][-50:]],
        "locked_actors": [l.dict() for l in locked_actors[session.id]]
    }

@router.post("/sessions/{session_id}/leave")
async def leave_session(session_id: str, user_id: str = "user_1", user_name: str = "User"):
    """Leave a collaboration session"""
    session = sessions.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    # Remove member
    session.members = [m for m in session.members if m.id != user_id]
    
    # Unlock any actors locked by this user
    locked_actors[session_id] = [l for l in locked_actors[session_id] if l.locked_by != user_id]
    
    # Add leave activity
    activity = ActivityItem(
        id=str(len(activities[session_id])),
        user_id=user_id,
        user_name=user_name,
        user_color="#6B7280",
        action="Left the session",
        type="leave"
    )
    activities[session_id].append(activity)
    
    # Broadcast to other members
    await manager.broadcast(session_id, {
        "type": "member_left",
        "user_id": user_id,
        "activity": activity.dict()
    })
    
    return {"success": True}

@router.get("/sessions/{session_id}")
async def get_session(session_id: str):
    """Get session details"""
    session = sessions.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    return {
        "session": session.dict(),
        "activities": [a.dict() for a in activities[session_id][-20:]],
        "chat_messages": [m.dict() for m in chat_messages[session_id][-50:]],
        "locked_actors": [l.dict() for l in locked_actors[session_id]]
    }

@router.get("/sessions/{session_id}/members")
async def get_members(session_id: str):
    """Get session members"""
    session = sessions.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    return {"members": [m.dict() for m in session.members]}

@router.post("/sessions/{session_id}/presence")
async def update_presence(session_id: str, request: UpdatePresenceRequest, user_id: str = "user_1"):
    """Update user presence"""
    session = sessions.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    for member in session.members:
        if member.id == user_id:
            member.status = request.status
            member.current_action = request.current_action
            member.selected_actors = request.selected_actors
            member.viewport_position = request.viewport_position
            member.last_active_at = datetime.now()
            break
    
    # Broadcast presence update
    await manager.broadcast(session_id, {
        "type": "presence_update",
        "user_id": user_id,
        "status": request.status,
        "current_action": request.current_action,
        "selected_actors": request.selected_actors,
        "viewport_position": request.viewport_position
    })
    
    return {"success": True}

@router.post("/sessions/{session_id}/lock")
async def lock_actor(session_id: str, request: LockActorRequest, user_id: str = "user_1", user_name: str = "User"):
    """Lock an actor for exclusive editing"""
    session = sessions.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    # Check if already locked
    for lock in locked_actors[session_id]:
        if lock.actor_id == request.actor_id:
            if lock.locked_by == user_id:
                return {"success": True, "already_locked": True}
            raise HTTPException(status_code=400, detail=f"Actor is locked by {lock.locked_by_name}")
    
    # Create lock
    lock = LockedActor(
        actor_id=request.actor_id,
        actor_name=request.actor_name,
        locked_by=user_id,
        locked_by_name=user_name
    )
    locked_actors[session_id].append(lock)
    
    # Add activity
    activity = ActivityItem(
        id=str(len(activities[session_id])),
        user_id=user_id,
        user_name=user_name,
        user_color="#F59E0B",
        action="Locked actor",
        target=request.actor_name,
        type="lock"
    )
    activities[session_id].append(activity)
    
    # Broadcast
    await manager.broadcast(session_id, {
        "type": "actor_locked",
        "lock": lock.dict(),
        "activity": activity.dict()
    })
    
    return {"success": True, "lock": lock.dict()}

@router.post("/sessions/{session_id}/unlock")
async def unlock_actor(session_id: str, actor_id: str, user_id: str = "user_1", user_name: str = "User"):
    """Unlock an actor"""
    session = sessions.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    # Find and remove lock
    lock_to_remove = None
    for lock in locked_actors[session_id]:
        if lock.actor_id == actor_id:
            if lock.locked_by != user_id:
                # Check if user is admin
                is_admin = any(m.id == user_id and m.role == "admin" for m in session.members)
                if not is_admin:
                    raise HTTPException(status_code=403, detail="Only the lock owner or admin can unlock")
            lock_to_remove = lock
            break
    
    if lock_to_remove:
        locked_actors[session_id].remove(lock_to_remove)
        
        # Add activity
        activity = ActivityItem(
            id=str(len(activities[session_id])),
            user_id=user_id,
            user_name=user_name,
            user_color="#10B981",
            action="Unlocked actor",
            target=lock_to_remove.actor_name,
            type="unlock"
        )
        activities[session_id].append(activity)
        
        # Broadcast
        await manager.broadcast(session_id, {
            "type": "actor_unlocked",
            "actor_id": actor_id,
            "activity": activity.dict()
        })
    
    return {"success": True}

@router.post("/sessions/{session_id}/chat")
async def send_chat(session_id: str, request: SendChatRequest, user_id: str = "user_1", user_name: str = "User"):
    """Send a chat message"""
    session = sessions.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    # Get user color
    user_color = "#3B82F6"
    for member in session.members:
        if member.id == user_id:
            user_color = member.color
            break
    
    message = ChatMessage(
        id=str(len(chat_messages[session_id])),
        user_id=user_id,
        user_name=user_name,
        user_color=user_color,
        content=request.content,
        type=request.type,
        attachments=request.attachments
    )
    chat_messages[session_id].append(message)
    
    # Broadcast
    await manager.broadcast(session_id, {
        "type": "chat_message",
        "message": message.dict()
    })
    
    return {"success": True, "message": message.dict()}

@router.get("/sessions/{session_id}/chat")
async def get_chat(session_id: str, limit: int = 50):
    """Get chat messages"""
    if session_id not in chat_messages:
        raise HTTPException(status_code=404, detail="Session not found")
    
    return {"messages": [m.dict() for m in chat_messages[session_id][-limit:]]}

@router.get("/sessions/{session_id}/activities")
async def get_activities(session_id: str, limit: int = 20):
    """Get activity feed"""
    if session_id not in activities:
        raise HTTPException(status_code=404, detail="Session not found")
    
    return {"activities": [a.dict() for a in activities[session_id][-limit:]]}

@router.post("/sessions/{session_id}/activity")
async def add_activity(session_id: str, action: str, target: str = None, details: str = None, 
                       activity_type: str = "modify", user_id: str = "user_1", user_name: str = "User"):
    """Add an activity to the feed"""
    session = sessions.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    # Get user color
    user_color = "#3B82F6"
    for member in session.members:
        if member.id == user_id:
            user_color = member.color
            break
    
    activity = ActivityItem(
        id=str(len(activities[session_id])),
        user_id=user_id,
        user_name=user_name,
        user_color=user_color,
        action=action,
        target=target,
        details=details,
        type=activity_type
    )
    activities[session_id].append(activity)
    
    # Broadcast
    await manager.broadcast(session_id, {
        "type": "activity",
        "activity": activity.dict()
    })
    
    return {"success": True, "activity": activity.dict()}

@router.post("/sessions/{session_id}/viewport/share")
async def share_viewport(session_id: str, request: ShareViewportRequest, user_id: str = "user_1"):
    """Enable/disable viewport sharing"""
    session = sessions.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    # Broadcast viewport sharing status
    await manager.broadcast(session_id, {
        "type": "viewport_sharing",
        "user_id": user_id,
        "enabled": request.enabled,
        "quality": request.quality
    })
    
    return {"success": True}

# ==================== WEBSOCKET ENDPOINT ====================

@router.websocket("/ws/{session_id}/{user_id}")
async def websocket_endpoint(websocket: WebSocket, session_id: str, user_id: str):
    """WebSocket endpoint for real-time collaboration"""
    await manager.connect(websocket, session_id)
    
    try:
        # Send initial state
        session = sessions.get(session_id)
        if session:
            await manager.send_personal(websocket, {
                "type": "initial_state",
                "session": session.dict(),
                "activities": [a.dict() for a in activities.get(session_id, [])[-20:]],
                "chat_messages": [m.dict() for m in chat_messages.get(session_id, [])[-50:]],
                "locked_actors": [l.dict() for l in locked_actors.get(session_id, [])]
            })
        
        while True:
            data = await websocket.receive_json()
            
            # Handle different message types
            if data["type"] == "presence":
                # Update presence and broadcast
                await manager.broadcast(session_id, {
                    "type": "presence_update",
                    "user_id": user_id,
                    **data.get("data", {})
                })
            
            elif data["type"] == "selection":
                # Broadcast selection change
                await manager.broadcast(session_id, {
                    "type": "selection_update",
                    "user_id": user_id,
                    "selected_actors": data.get("selected_actors", [])
                })
            
            elif data["type"] == "viewport":
                # Broadcast viewport update
                await manager.broadcast(session_id, {
                    "type": "viewport_update",
                    "user_id": user_id,
                    "position": data.get("position"),
                    "rotation": data.get("rotation")
                })
            
            elif data["type"] == "cursor":
                # Broadcast cursor position
                await manager.broadcast(session_id, {
                    "type": "cursor_update",
                    "user_id": user_id,
                    "position": data.get("position")
                })
    
    except WebSocketDisconnect:
        manager.disconnect(websocket, session_id)
        
        # Broadcast disconnect
        await manager.broadcast(session_id, {
            "type": "member_disconnected",
            "user_id": user_id
        })
