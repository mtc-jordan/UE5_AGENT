from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Enum, JSON, Boolean
from sqlalchemy.orm import relationship
from datetime import datetime
from core.database import Base
import enum


class ChatMode(str, enum.Enum):
    SOLO = "solo"
    TEAM = "team"


class MessageRole(str, enum.Enum):
    USER = "user"
    ASSISTANT = "assistant"
    SYSTEM = "system"


class Chat(Base):
    __tablename__ = "chats"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=True)
    title = Column(String(255), default="New Conversation")
    mode = Column(Enum(ChatMode), default=ChatMode.TEAM)
    active_agents = Column(JSON, default=["architect", "developer", "blueprint", "qa"])
    solo_agent = Column(String(64), default="architect")
    model = Column(String(128), default="deepseek-chat")
    
    # Chat management fields
    is_pinned = Column(Boolean, default=False)
    is_archived = Column(Boolean, default=False)
    pinned_at = Column(DateTime, nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    user = relationship("User", back_populates="chats")
    project = relationship("Project", back_populates="chats")
    messages = relationship("Message", back_populates="chat", cascade="all, delete-orphan", order_by="Message.created_at")


class Message(Base):
    __tablename__ = "messages"
    
    id = Column(Integer, primary_key=True, index=True)
    chat_id = Column(Integer, ForeignKey("chats.id"), nullable=False)
    role = Column(Enum(MessageRole), nullable=False)
    agent = Column(String(64), nullable=True)  # architect, developer, blueprint, qa, devops, artist
    content = Column(Text, nullable=False)
    attachments = Column(JSON, nullable=True)  # [{name, type, data}]
    tool_calls = Column(JSON, nullable=True)  # [{name, args, result}]
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    chat = relationship("Chat", back_populates="messages")
