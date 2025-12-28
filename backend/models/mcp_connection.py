from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Enum, JSON
from sqlalchemy.orm import relationship
from datetime import datetime
from core.database import Base
import enum


class ConnectionStatus(str, enum.Enum):
    CONNECTED = "connected"
    DISCONNECTED = "disconnected"
    ERROR = "error"


class MCPConnection(Base):
    __tablename__ = "mcp_connections"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=True)
    name = Column(String(128), nullable=False)
    endpoint = Column(String(512), nullable=False)  # e.g., http://localhost:8080
    status = Column(Enum(ConnectionStatus), default=ConnectionStatus.DISCONNECTED)
    last_connected = Column(DateTime, nullable=True)
    available_tools = Column(JSON, nullable=True)  # List of tool names
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    user = relationship("User", back_populates="mcp_connections")
    project = relationship("Project", back_populates="mcp_connections")
