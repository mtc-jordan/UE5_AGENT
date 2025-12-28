from sqlalchemy import Column, Integer, String, DateTime, Boolean, JSON, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
from core.database import Base


class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(320), unique=True, index=True, nullable=False)
    username = Column(String(64), unique=True, index=True, nullable=False)
    hashed_password = Column(String(128), nullable=False)
    is_active = Column(Boolean, default=True)
    is_admin = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    projects = relationship("Project", back_populates="user", cascade="all, delete-orphan")
    chats = relationship("Chat", back_populates="user", cascade="all, delete-orphan")
    agents = relationship("Agent", back_populates="user", cascade="all, delete-orphan")
    mcp_connections = relationship("MCPConnection", back_populates="user", cascade="all, delete-orphan")
    preferences = relationship("UserPreferences", back_populates="user", uselist=False, cascade="all, delete-orphan")
    workspace_files = relationship("WorkspaceFile", back_populates="user", cascade="all, delete-orphan")


class UserPreferences(Base):
    """User preferences for chat defaults and other settings."""
    __tablename__ = "user_preferences"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False)
    
    # Chat defaults
    auto_generate_title = Column(Boolean, default=True)  # Auto-generate title from first message
    default_chat_mode = Column(String(16), default="team")  # solo or team
    default_model = Column(String(128), default="deepseek-chat")
    default_solo_agent = Column(String(64), default="architect")
    default_active_agents = Column(JSON, default=["architect", "developer", "blueprint", "qa"])
    
    # Chat behavior
    auto_pin_project_chats = Column(Boolean, default=False)
    title_format = Column(String(128), default="{topic}")  # Format: {topic}, {date}, {project}
    
    # UI preferences
    sidebar_collapsed = Column(Boolean, default=False)
    show_archived_by_default = Column(Boolean, default=False)
    
    # Workspace preferences
    default_workspace_view = Column(String(32), default="tree")  # tree, list, grid
    auto_save_interval = Column(Integer, default=30)  # seconds, 0 = disabled
    show_hidden_files = Column(Boolean, default=False)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    user = relationship("User", back_populates="preferences")
