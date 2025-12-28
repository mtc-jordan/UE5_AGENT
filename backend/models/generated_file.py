from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Enum, Boolean
from sqlalchemy.orm import relationship
from datetime import datetime
from core.database import Base
import enum


class FileType(str, enum.Enum):
    CPP = "cpp"
    H = "h"
    BLUEPRINT = "blueprint"
    PYTHON = "python"
    OTHER = "other"


class GeneratedFile(Base):
    __tablename__ = "generated_files"
    
    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    chat_id = Column(Integer, ForeignKey("chats.id"), nullable=True)
    message_id = Column(Integer, ForeignKey("messages.id"), nullable=True)
    file_path = Column(String(512), nullable=False)
    file_name = Column(String(255), nullable=False)
    file_type = Column(Enum(FileType), default=FileType.CPP)
    content = Column(Text, nullable=False)
    synced_to_ue = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    project = relationship("Project", back_populates="generated_files")
