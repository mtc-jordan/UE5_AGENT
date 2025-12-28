from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum


# Enums
class ChatModeEnum(str, Enum):
    SOLO = "solo"
    TEAM = "team"
    ROUNDTABLE = "roundtable"


class MessageRoleEnum(str, Enum):
    USER = "user"
    ASSISTANT = "assistant"
    SYSTEM = "system"


# Auth Schemas
class UserCreate(BaseModel):
    email: EmailStr
    username: str = Field(..., min_length=3, max_length=64)
    password: str = Field(..., min_length=6)


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserResponse(BaseModel):
    id: int
    email: str
    username: str
    is_active: bool
    is_admin: bool
    created_at: datetime

    class Config:
        from_attributes = True


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


# Project Schemas
class ProjectCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    ue_version: str = "5.3"
    project_path: Optional[str] = None


class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    ue_version: Optional[str] = None
    project_path: Optional[str] = None


class ProjectResponse(BaseModel):
    id: int
    user_id: int
    name: str
    description: Optional[str]
    ue_version: str
    project_path: Optional[str]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ProjectDetailResponse(BaseModel):
    id: int
    user_id: int
    name: str
    description: Optional[str]
    ue_version: str
    project_path: Optional[str]
    created_at: datetime
    updated_at: datetime
    chat_count: int = 0
    recent_chats: List["ChatResponse"] = []

    class Config:
        from_attributes = True


# Chat Schemas
class ChatCreate(BaseModel):
    project_id: Optional[int] = None
    title: str = "New Conversation"
    mode: ChatModeEnum = ChatModeEnum.TEAM
    active_agents: List[str] = ["architect", "developer", "blueprint", "qa"]
    solo_agent: str = "architect"
    model: str = "deepseek-chat"


class ChatUpdate(BaseModel):
    title: Optional[str] = None
    mode: Optional[ChatModeEnum] = None
    active_agents: Optional[List[str]] = None
    solo_agent: Optional[str] = None
    model: Optional[str] = None
    is_pinned: Optional[bool] = None
    is_archived: Optional[bool] = None
    project_id: Optional[int] = None


class ChatResponse(BaseModel):
    id: int
    user_id: int
    project_id: Optional[int]
    title: str
    mode: str
    active_agents: Optional[List[str]]
    solo_agent: str
    model: str
    is_pinned: bool = False
    is_archived: bool = False
    pinned_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# Message Schemas
class MessageCreate(BaseModel):
    content: str
    attachments: Optional[List[Dict[str, Any]]] = None


class MessageResponse(BaseModel):
    id: int
    chat_id: int
    role: str
    agent: Optional[str]
    content: str
    attachments: Optional[List[Dict[str, Any]]]
    tool_calls: Optional[List[Dict[str, Any]]]
    created_at: datetime

    class Config:
        from_attributes = True


# Agent Schemas
class AgentCreate(BaseModel):
    key: str = Field(..., min_length=1, max_length=64)
    name: str = Field(..., min_length=1, max_length=128)
    description: Optional[str] = None
    system_prompt: str
    color: str = "cyan"
    icon: str = "Cpu"


class AgentUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    system_prompt: Optional[str] = None
    color: Optional[str] = None
    icon: Optional[str] = None


class AgentResponse(BaseModel):
    id: int
    user_id: Optional[int]
    key: str
    name: str
    description: Optional[str]
    system_prompt: str
    color: str
    icon: str
    is_default: bool
    created_at: datetime

    class Config:
        from_attributes = True


# MCP Schemas
class MCPConnectionCreate(BaseModel):
    project_id: Optional[int] = None
    name: str = Field(..., min_length=1, max_length=128)
    endpoint: str = Field(..., min_length=1, max_length=512)


class MCPConnectionResponse(BaseModel):
    id: int
    user_id: int
    project_id: Optional[int]
    name: str
    endpoint: str
    status: str
    last_connected: Optional[datetime]
    available_tools: Optional[List[str]]
    created_at: datetime

    class Config:
        from_attributes = True


class MCPToolCall(BaseModel):
    tool_name: str
    arguments: Dict[str, Any]


# AI Chat Schemas
class AIChatRequest(BaseModel):
    message: str
    chat_id: Optional[int] = None
    mode: ChatModeEnum = ChatModeEnum.TEAM
    active_agents: List[str] = ["architect", "developer", "blueprint", "qa"]
    solo_agent: str = "architect"
    model: str = "deepseek-chat"
    attachments: Optional[List[Dict[str, Any]]] = None


class AIChatChunk(BaseModel):
    type: str  # chunk, complete, phase, done, error
    agent: Optional[str] = None
    agent_name: Optional[str] = None
    agent_color: Optional[str] = None
    content: Optional[str] = None
    message: Optional[str] = None
    phase: Optional[str] = None


# Generated File Schemas
class GeneratedFileResponse(BaseModel):
    id: int
    project_id: int
    chat_id: Optional[int]
    file_path: str
    file_name: str
    file_type: str
    content: str
    synced_to_ue: bool
    created_at: datetime

    class Config:
        from_attributes = True


# User Preferences Schemas
class UserPreferencesUpdate(BaseModel):
    auto_generate_title: Optional[bool] = None
    default_chat_mode: Optional[ChatModeEnum] = None
    default_model: Optional[str] = None
    default_solo_agent: Optional[str] = None
    default_active_agents: Optional[List[str]] = None
    auto_pin_project_chats: Optional[bool] = None
    title_format: Optional[str] = None
    sidebar_collapsed: Optional[bool] = None
    show_archived_by_default: Optional[bool] = None


class UserPreferencesResponse(BaseModel):
    id: int
    user_id: int
    auto_generate_title: bool
    default_chat_mode: str
    default_model: str
    default_solo_agent: str
    default_active_agents: List[str]
    auto_pin_project_chats: bool
    title_format: str
    sidebar_collapsed: bool
    show_archived_by_default: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# Title Generation Schema
class GenerateTitleRequest(BaseModel):
    message: str
    project_name: Optional[str] = None


class GenerateTitleResponse(BaseModel):
    title: str
