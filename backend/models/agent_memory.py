from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Float
from sqlalchemy.orm import relationship
from datetime import datetime
from core.database import Base


class AgentMemory(Base):
    """
    Stores agent memories extracted from conversations.
    
    Memories are key insights, decisions, and context that agents can recall
    in future conversations within the same project.
    """
    __tablename__ = "agent_memories"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=True)
    agent = Column(String(64), nullable=False)  # Which agent created this memory
    
    # Memory content
    memory_type = Column(String(64), nullable=False)  # decision, insight, preference, context, code_pattern
    title = Column(String(255), nullable=False)  # Short summary
    content = Column(Text, nullable=False)  # Full memory content
    
    # Source tracking
    source_chat_id = Column(Integer, ForeignKey("chats.id"), nullable=True)
    source_message_id = Column(Integer, ForeignKey("messages.id"), nullable=True)
    
    # Relevance and usage
    importance = Column(Float, default=0.5)  # 0.0 to 1.0, higher = more important
    access_count = Column(Integer, default=0)  # How many times this memory was recalled
    last_accessed = Column(DateTime, nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    user = relationship("User")
    project = relationship("Project")
    source_chat = relationship("Chat")


class MemoryType:
    """Memory type constants"""
    DECISION = "decision"  # Architectural or design decisions made
    INSIGHT = "insight"  # Technical insights discovered
    PREFERENCE = "preference"  # User preferences learned
    CONTEXT = "context"  # Project context and background
    CODE_PATTERN = "code_pattern"  # Code patterns and conventions used
    ISSUE = "issue"  # Known issues and their solutions
    REQUIREMENT = "requirement"  # User requirements captured
