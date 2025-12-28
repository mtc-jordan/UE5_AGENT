"""
Agent Token Model for UE5 AI Studio Agent Authentication.

Stores tokens used by the desktop agent to connect to the cloud platform.
"""

from sqlalchemy import Column, Integer, String, DateTime, Boolean, ForeignKey, Text
from sqlalchemy.orm import relationship
from datetime import datetime, timedelta
from core.database import Base
import secrets


class AgentToken(Base):
    """
    Agent authentication token for desktop agent connections.
    
    Each user can have multiple tokens for different machines/agents.
    Tokens are used for WebSocket authentication to the Agent Relay.
    """
    __tablename__ = "agent_tokens"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    
    # Token identification
    name = Column(String(128), nullable=False)  # User-friendly name (e.g., "Home PC", "Work Laptop")
    token_hash = Column(String(256), nullable=False, unique=True, index=True)  # Hashed token for lookup
    token_prefix = Column(String(16), nullable=False)  # First 8 chars for identification
    
    # Token metadata
    description = Column(Text, nullable=True)
    last_used_at = Column(DateTime, nullable=True)
    last_ip = Column(String(64), nullable=True)
    last_user_agent = Column(String(256), nullable=True)
    
    # Status
    is_active = Column(Boolean, default=True)
    is_revoked = Column(Boolean, default=False)
    revoked_at = Column(DateTime, nullable=True)
    
    # Expiration
    expires_at = Column(DateTime, nullable=True)  # None = never expires
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    user = relationship("User", backref="agent_tokens")
    
    @classmethod
    def generate_token(cls) -> str:
        """Generate a secure random token."""
        return secrets.token_urlsafe(48)  # 64 characters
    
    @classmethod
    def get_token_prefix(cls, token: str) -> str:
        """Get the prefix of a token for identification."""
        return token[:8] if len(token) >= 8 else token
    
    def is_valid(self) -> bool:
        """Check if the token is valid (active, not revoked, not expired)."""
        if not self.is_active or self.is_revoked:
            return False
        if self.expires_at and datetime.utcnow() > self.expires_at:
            return False
        return True
    
    def update_usage(self, ip: str = None, user_agent: str = None):
        """Update last usage information."""
        self.last_used_at = datetime.utcnow()
        if ip:
            self.last_ip = ip
        if user_agent:
            self.last_user_agent = user_agent
    
    def revoke(self):
        """Revoke this token."""
        self.is_revoked = True
        self.revoked_at = datetime.utcnow()
    
    def to_dict(self) -> dict:
        """Convert to dictionary (excludes sensitive data)."""
        return {
            "id": self.id,
            "name": self.name,
            "token_prefix": self.token_prefix,
            "description": self.description,
            "is_active": self.is_active,
            "is_revoked": self.is_revoked,
            "last_used_at": self.last_used_at.isoformat() if self.last_used_at else None,
            "last_ip": self.last_ip,
            "expires_at": self.expires_at.isoformat() if self.expires_at else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class AgentConnection(Base):
    """
    Tracks active agent connections to the platform.
    
    Records when agents connect/disconnect and their current status.
    """
    __tablename__ = "agent_connections"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    token_id = Column(Integer, ForeignKey("agent_tokens.id"), nullable=True, index=True)
    
    # Connection identification
    connection_id = Column(String(64), nullable=False, unique=True, index=True)
    
    # Agent information
    agent_version = Column(String(32), nullable=True)
    agent_platform = Column(String(64), nullable=True)  # Windows, macOS, Linux
    agent_hostname = Column(String(256), nullable=True)
    
    # Connection status
    status = Column(String(32), default="connected")  # connected, disconnected, mcp_connected, mcp_disconnected
    connected_at = Column(DateTime, default=datetime.utcnow)
    disconnected_at = Column(DateTime, nullable=True)
    
    # MCP connection status
    mcp_connected = Column(Boolean, default=False)
    mcp_host = Column(String(256), nullable=True)  # localhost:55557
    mcp_connected_at = Column(DateTime, nullable=True)
    mcp_project_name = Column(String(256), nullable=True)
    mcp_engine_version = Column(String(32), nullable=True)
    
    # Network info
    ip_address = Column(String(64), nullable=True)
    user_agent = Column(String(256), nullable=True)
    
    # Statistics
    commands_executed = Column(Integer, default=0)
    last_command_at = Column(DateTime, nullable=True)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    user = relationship("User", backref="active_agent_connections")
    token = relationship("AgentToken", backref="connections")
    
    def update_mcp_status(
        self,
        connected: bool,
        host: str = None,
        project_name: str = None,
        engine_version: str = None
    ):
        """Update MCP connection status."""
        self.mcp_connected = connected
        if connected:
            self.mcp_host = host
            self.mcp_connected_at = datetime.utcnow()
            self.mcp_project_name = project_name
            self.mcp_engine_version = engine_version
            self.status = "mcp_connected"
        else:
            self.mcp_connected_at = None
            self.status = "connected"
    
    def disconnect(self):
        """Mark connection as disconnected."""
        self.status = "disconnected"
        self.disconnected_at = datetime.utcnow()
        self.mcp_connected = False
    
    def increment_commands(self):
        """Increment command execution counter."""
        self.commands_executed += 1
        self.last_command_at = datetime.utcnow()
    
    def to_dict(self) -> dict:
        """Convert to dictionary."""
        return {
            "id": self.id,
            "connection_id": self.connection_id,
            "status": self.status,
            "agent_version": self.agent_version,
            "agent_platform": self.agent_platform,
            "agent_hostname": self.agent_hostname,
            "connected_at": self.connected_at.isoformat() if self.connected_at else None,
            "mcp_connected": self.mcp_connected,
            "mcp_host": self.mcp_host,
            "mcp_project_name": self.mcp_project_name,
            "mcp_engine_version": self.mcp_engine_version,
            "mcp_connected_at": self.mcp_connected_at.isoformat() if self.mcp_connected_at else None,
            "commands_executed": self.commands_executed,
            "last_command_at": self.last_command_at.isoformat() if self.last_command_at else None,
        }
