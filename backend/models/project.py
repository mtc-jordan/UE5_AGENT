from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
from core.database import Base


class Project(Base):
    __tablename__ = "projects"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    name = Column(String(255), nullable=False)
    description = Column(Text)
    ue_version = Column(String(32), default="5.3")
    project_path = Column(Text)  # Local UE5 project path
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    user = relationship("User", back_populates="projects")
    chats = relationship("Chat", back_populates="project", cascade="all, delete-orphan")
    mcp_connections = relationship("MCPConnection", back_populates="project")
    generated_files = relationship("GeneratedFile", back_populates="project", cascade="all, delete-orphan")
