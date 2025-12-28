"""
Model Comparison Database Models.

Stores comparison sessions and results for AI model comparison feature.
"""

from sqlalchemy import Column, Integer, String, DateTime, Boolean, JSON, ForeignKey, Text, Float
from sqlalchemy.orm import relationship
from datetime import datetime
from core.database import Base


class ComparisonSession(Base):
    """
    A comparison session where a user compares multiple AI models.
    
    Stores the prompt and metadata for a comparison run.
    """
    __tablename__ = "comparison_sessions"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    # Session info
    title = Column(String(256), default="Untitled Comparison")
    prompt = Column(Text, nullable=False)
    system_prompt = Column(Text, nullable=True)
    
    # Models being compared (JSON array of model IDs)
    models = Column(JSON, nullable=False)  # e.g., ["gemini-2.5-flash", "deepseek-chat", "claude-3-5-sonnet"]
    
    # Status
    status = Column(String(32), default="pending")  # pending, running, completed, failed
    
    # Metadata
    is_saved = Column(Boolean, default=False)  # User explicitly saved this comparison
    is_favorite = Column(Boolean, default=False)
    tags = Column(JSON, default=[])  # User-defined tags
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)
    
    # Relationships
    user = relationship("User", back_populates="comparisons")
    results = relationship("ComparisonResult", back_populates="session", cascade="all, delete-orphan")
    
    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "title": self.title,
            "prompt": self.prompt,
            "system_prompt": self.system_prompt,
            "models": self.models,
            "status": self.status,
            "is_saved": self.is_saved,
            "is_favorite": self.is_favorite,
            "tags": self.tags,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
            "results": [r.to_dict() for r in self.results] if self.results else []
        }


class ComparisonResult(Base):
    """
    Individual model response within a comparison session.
    
    Stores the response and metrics for each model in the comparison.
    """
    __tablename__ = "comparison_results"
    
    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("comparison_sessions.id"), nullable=False)
    
    # Model info
    model_id = Column(String(128), nullable=False)  # e.g., "gemini-2.5-flash"
    provider = Column(String(64), nullable=False)  # e.g., "google", "deepseek", "anthropic"
    
    # Response
    response = Column(Text, nullable=True)
    error = Column(Text, nullable=True)  # Error message if failed
    
    # Status
    status = Column(String(32), default="pending")  # pending, streaming, completed, failed
    
    # Performance metrics
    response_time_ms = Column(Integer, nullable=True)  # Time to first token
    total_time_ms = Column(Integer, nullable=True)  # Total generation time
    token_count = Column(Integer, nullable=True)  # Approximate token count
    
    # Quality metrics (can be user-rated or auto-calculated)
    user_rating = Column(Integer, nullable=True)  # 1-5 stars
    is_winner = Column(Boolean, default=False)  # User selected as best response
    
    # Timestamps
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    
    # Relationships
    session = relationship("ComparisonSession", back_populates="results")
    
    def to_dict(self):
        return {
            "id": self.id,
            "session_id": self.session_id,
            "model_id": self.model_id,
            "provider": self.provider,
            "response": self.response,
            "error": self.error,
            "status": self.status,
            "response_time_ms": self.response_time_ms,
            "total_time_ms": self.total_time_ms,
            "token_count": self.token_count,
            "user_rating": self.user_rating,
            "is_winner": self.is_winner,
            "started_at": self.started_at.isoformat() if self.started_at else None,
            "completed_at": self.completed_at.isoformat() if self.completed_at else None
        }


# Model metadata for UI display
MODEL_INFO = {
    # DeepSeek models
    "deepseek-chat": {
        "name": "DeepSeek V3",
        "provider": "deepseek",
        "color": "#0066FF",
        "icon": "brain",
        "description": "Fast and capable general-purpose model"
    },
    "deepseek-reasoner": {
        "name": "DeepSeek R1",
        "provider": "deepseek",
        "color": "#0066FF",
        "icon": "lightbulb",
        "description": "Advanced reasoning model"
    },
    # Anthropic models
    "claude-3-5-sonnet-20241022": {
        "name": "Claude 3.5 Sonnet",
        "provider": "anthropic",
        "color": "#FF6B35",
        "icon": "sparkles",
        "description": "Balanced performance and capability"
    },
    "claude-3-opus-20240229": {
        "name": "Claude 3 Opus",
        "provider": "anthropic",
        "color": "#FF6B35",
        "icon": "crown",
        "description": "Most capable Claude model"
    },
    # Google Gemini models
    "gemini-2.5-flash": {
        "name": "Gemini 2.5 Flash",
        "provider": "google",
        "color": "#34A853",
        "icon": "zap",
        "description": "Fast and efficient"
    },
    "gemini-2.5-flash-lite": {
        "name": "Gemini 2.5 Flash Lite",
        "provider": "google",
        "color": "#34A853",
        "icon": "feather",
        "description": "Lightweight and quick"
    },
    "gemini-2.5-pro": {
        "name": "Gemini 2.5 Pro",
        "provider": "google",
        "color": "#34A853",
        "icon": "star",
        "description": "Most capable Gemini model"
    },
    "gemini-2.0-flash": {
        "name": "Gemini 2.0 Flash",
        "provider": "google",
        "color": "#34A853",
        "icon": "bolt",
        "description": "Previous generation flash model"
    }
}


def get_model_info(model_id: str) -> dict:
    """Get model metadata by ID."""
    return MODEL_INFO.get(model_id, {
        "name": model_id,
        "provider": "unknown",
        "color": "#666666",
        "icon": "cpu",
        "description": "Unknown model"
    })
