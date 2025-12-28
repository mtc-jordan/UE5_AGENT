from sqlalchemy import Column, Integer, String, DateTime, Boolean, JSON, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
from typing import Set, List, Optional
from core.database import Base


class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(320), unique=True, index=True, nullable=False)
    username = Column(String(64), unique=True, index=True, nullable=False)
    hashed_password = Column(String(128), nullable=False)
    is_active = Column(Boolean, default=True)
    is_admin = Column(Boolean, default=False)  # Legacy field, use roles instead
    is_online = Column(Boolean, default=False)  # Real-time presence
    last_seen = Column(DateTime, default=datetime.utcnow)  # Last activity timestamp
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    projects = relationship("Project", back_populates="user", cascade="all, delete-orphan")
    chats = relationship("Chat", back_populates="user", cascade="all, delete-orphan")
    agents = relationship("Agent", back_populates="user", cascade="all, delete-orphan")
    mcp_connections = relationship("MCPConnection", back_populates="user", cascade="all, delete-orphan")
    preferences = relationship("UserPreferences", back_populates="user", uselist=False, cascade="all, delete-orphan")
    workspace_files = relationship("WorkspaceFile", back_populates="user", cascade="all, delete-orphan")
    plugins = relationship("Plugin", back_populates="author", cascade="all, delete-orphan")
    installed_plugins = relationship("PluginInstallation", back_populates="user", cascade="all, delete-orphan")
    comparisons = relationship("ComparisonSession", back_populates="user", cascade="all, delete-orphan")
    subscription = relationship("Subscription", back_populates="user", uselist=False, cascade="all, delete-orphan")
    
    # RBAC Relationships
    roles = relationship(
        "Role",
        secondary="user_roles",
        back_populates="users",
        lazy="selectin"
    )
    
    # Permission overrides relationship
    permission_overrides = relationship(
        "UserPermissionOverride",
        back_populates="user",
        cascade="all, delete-orphan",
        lazy="selectin"
    )
    
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        # Cached permissions (not a mapped column)
        self._cached_permissions = None
    
    def get_all_permissions(self) -> Set[str]:
        """
        Get all permissions for this user including:
        - Permissions from all assigned roles
        - Individual permission overrides
        """
        if self._cached_permissions is not None:
            return self._cached_permissions
        
        permissions = set()
        
        # Collect permissions from all roles
        for role in self.roles:
            for perm in role.permissions:
                permissions.add(perm.name)
        
        # Apply individual overrides
        for override in self.permission_overrides:
            if override.is_valid():
                if override.is_granted:
                    permissions.add(override.permission.name)
                else:
                    permissions.discard(override.permission.name)
        
        # Check for system.all (owner permission)
        if "system.all" in permissions:
            # Owner has all permissions - this is handled in has_permission
            pass
        
        self._cached_permissions = permissions
        return permissions
    
    def has_permission(self, permission_name: str) -> bool:
        """Check if user has a specific permission."""
        permissions = self.get_all_permissions()
        
        # Owner with system.all has all permissions
        if "system.all" in permissions:
            return True
        
        return permission_name in permissions
    
    def has_any_permission(self, permission_names: List[str]) -> bool:
        """Check if user has any of the specified permissions."""
        return any(self.has_permission(p) for p in permission_names)
    
    def has_all_permissions(self, permission_names: List[str]) -> bool:
        """Check if user has all of the specified permissions."""
        return all(self.has_permission(p) for p in permission_names)
    
    def has_role(self, role_name: str) -> bool:
        """Check if user has a specific role."""
        return any(r.name == role_name for r in self.roles)
    
    def has_any_role(self, role_names: List[str]) -> bool:
        """Check if user has any of the specified roles."""
        return any(self.has_role(r) for r in role_names)
    
    def get_highest_role(self) -> Optional["Role"]:
        """Get the user's highest level role (lowest level number)."""
        if not self.roles:
            return None
        return min(self.roles, key=lambda r: r.level)
    
    def get_role_names(self) -> List[str]:
        """Get list of role names."""
        return [r.name for r in self.roles]
    
    def clear_permission_cache(self):
        """Clear the cached permissions (call after role/permission changes)."""
        self._cached_permissions = None
    
    def to_dict(self, include_permissions: bool = False) -> dict:
        """Convert user to dictionary."""
        result = {
            "id": self.id,
            "email": self.email,
            "username": self.username,
            "is_active": self.is_active,
            "is_admin": self.is_admin,
            "is_online": self.is_online,
            "last_seen": self.last_seen.isoformat() if self.last_seen else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "roles": [r.name for r in self.roles] if self.roles else []
        }
        
        if include_permissions:
            result["permissions"] = list(self.get_all_permissions())
        
        return result


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
    
    # Plugin preferences
    auto_enable_installed_plugins = Column(Boolean, default=True)
    plugin_execution_timeout = Column(Integer, default=30)  # seconds
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    user = relationship("User", back_populates="preferences")
