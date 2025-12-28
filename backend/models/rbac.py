"""
Role-Based Access Control (RBAC) Database Models.

Provides comprehensive permission management for the platform.
"""

from sqlalchemy import (
    Column, Integer, String, Text, Boolean, DateTime, ForeignKey,
    Table, Enum as SQLEnum, JSON, UniqueConstraint, Index
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from datetime import datetime
from typing import List, Dict, Optional, Set
import enum

from core.database import Base


# Enums

class RoleLevel(enum.IntEnum):
    """Role hierarchy levels (lower = more permissions)."""
    OWNER = 0
    ADMIN = 10
    MANAGER = 20
    DEVELOPER = 30
    ANALYST = 30  # Same level as developer
    USER = 40
    GUEST = 50


class PermissionCategory(str, enum.Enum):
    """Permission categories for organization."""
    CHAT = "chat"
    PROJECT = "project"
    WORKSPACE = "workspace"
    PLUGIN = "plugin"
    COMPARISON = "comparison"
    MCP = "mcp"
    AGENT = "agent"
    ADMIN = "admin"
    SUBSCRIPTION = "subscription"
    SYSTEM = "system"


class AuditAction(str, enum.Enum):
    """Audit log action types."""
    ROLE_CREATED = "role_created"
    ROLE_UPDATED = "role_updated"
    ROLE_DELETED = "role_deleted"
    PERMISSION_GRANTED = "permission_granted"
    PERMISSION_REVOKED = "permission_revoked"
    USER_ROLE_ASSIGNED = "user_role_assigned"
    USER_ROLE_REMOVED = "user_role_removed"
    USER_PERMISSION_OVERRIDE = "user_permission_override"
    LOGIN = "login"
    LOGOUT = "logout"
    ACCESS_DENIED = "access_denied"


# Association Tables

role_permissions = Table(
    'role_permissions',
    Base.metadata,
    Column('role_id', Integer, ForeignKey('roles.id', ondelete='CASCADE'), primary_key=True),
    Column('permission_id', Integer, ForeignKey('permissions.id', ondelete='CASCADE'), primary_key=True),
    Column('granted_at', DateTime, default=func.now()),
    Column('granted_by', Integer, ForeignKey('users.id', ondelete='SET NULL'), nullable=True)
)

user_roles = Table(
    'user_roles',
    Base.metadata,
    Column('user_id', Integer, ForeignKey('users.id', ondelete='CASCADE'), primary_key=True),
    Column('role_id', Integer, ForeignKey('roles.id', ondelete='CASCADE'), primary_key=True),
    Column('assigned_at', DateTime, default=func.now()),
    Column('assigned_by_id', Integer, nullable=True),  # Removed FK to avoid ambiguity
    Column('expires_at', DateTime, nullable=True)
)


# Models

class Role(Base):
    """Role model for grouping permissions."""
    
    __tablename__ = 'roles'
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(50), unique=True, nullable=False, index=True)
    display_name = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    level = Column(Integer, nullable=False, default=RoleLevel.USER)
    color = Column(String(7), nullable=True)  # Hex color for UI
    icon = Column(String(50), nullable=True)  # Icon name for UI
    is_system = Column(Boolean, default=False)  # System roles cannot be deleted
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())
    
    # Relationships
    permissions = relationship(
        'Permission',
        secondary=role_permissions,
        back_populates='roles',
        lazy='selectin'
    )
    users = relationship(
        'User',
        secondary=user_roles,
        back_populates='roles',
        lazy='selectin'
    )
    
    def __repr__(self):
        return f"<Role {self.name}>"
    
    def to_dict(self) -> Dict:
        return {
            "id": self.id,
            "name": self.name,
            "display_name": self.display_name,
            "description": self.description,
            "level": self.level,
            "color": self.color,
            "icon": self.icon,
            "is_system": self.is_system,
            "is_active": self.is_active,
            "permissions": [p.name for p in self.permissions] if self.permissions else [],
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None
        }
    
    def has_permission(self, permission_name: str) -> bool:
        """Check if role has a specific permission."""
        return any(p.name == permission_name for p in self.permissions)
    
    def get_permission_names(self) -> Set[str]:
        """Get all permission names for this role."""
        return {p.name for p in self.permissions}


class Permission(Base):
    """Permission model for granular access control."""
    
    __tablename__ = 'permissions'
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, nullable=False, index=True)
    display_name = Column(String(150), nullable=False)
    description = Column(Text, nullable=True)
    category = Column(String(50), nullable=False, index=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=func.now())
    
    # Relationships
    roles = relationship(
        'Role',
        secondary=role_permissions,
        back_populates='permissions',
        lazy='selectin'
    )
    
    __table_args__ = (
        Index('ix_permissions_category_name', 'category', 'name'),
    )
    
    def __repr__(self):
        return f"<Permission {self.name}>"
    
    def to_dict(self) -> Dict:
        return {
            "id": self.id,
            "name": self.name,
            "display_name": self.display_name,
            "description": self.description,
            "category": self.category,
            "is_active": self.is_active,
            "created_at": self.created_at.isoformat() if self.created_at else None
        }


class UserPermission(Base):
    """User-specific permission overrides."""
    
    __tablename__ = 'user_permissions'
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    permission_id = Column(Integer, ForeignKey('permissions.id', ondelete='CASCADE'), nullable=False)
    is_granted = Column(Boolean, nullable=False)  # True=grant, False=revoke
    granted_at = Column(DateTime, default=func.now())
    granted_by = Column(Integer, ForeignKey('users.id', ondelete='SET NULL'), nullable=True)
    expires_at = Column(DateTime, nullable=True)
    reason = Column(Text, nullable=True)
    
    # Relationships
    user = relationship('User', foreign_keys=[user_id], back_populates='permission_overrides')
    permission = relationship('Permission')
    granter = relationship('User', foreign_keys=[granted_by], overlaps='permission_overrides,user')
    
    __table_args__ = (
        UniqueConstraint('user_id', 'permission_id', name='uq_user_permission'),
        Index('ix_user_permissions_user', 'user_id'),
    )
    
    def __repr__(self):
        action = "granted" if self.is_granted else "revoked"
        return f"<UserPermission {self.user_id}:{self.permission.name} {action}>"
    
    def to_dict(self) -> Dict:
        return {
            "id": self.id,
            "user_id": self.user_id,
            "permission_id": self.permission_id,
            "permission_name": self.permission.name if self.permission else None,
            "is_granted": self.is_granted,
            "granted_at": self.granted_at.isoformat() if self.granted_at else None,
            "granted_by": self.granted_by,
            "expires_at": self.expires_at.isoformat() if self.expires_at else None,
            "reason": self.reason
        }
    
    def is_valid(self) -> bool:
        """Check if the override is still valid (not expired)."""
        if self.expires_at is None:
            return True
        return datetime.utcnow() < self.expires_at


class PermissionAuditLog(Base):
    """Audit log for permission-related actions."""
    
    __tablename__ = 'permission_audit_log'
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey('users.id', ondelete='SET NULL'), nullable=True)
    action = Column(String(50), nullable=False, index=True)
    target_type = Column(String(50), nullable=False)  # 'role', 'permission', 'user'
    target_id = Column(Integer, nullable=False)
    target_name = Column(String(100), nullable=True)
    old_value = Column(JSON, nullable=True)
    new_value = Column(JSON, nullable=True)
    ip_address = Column(String(45), nullable=True)
    user_agent = Column(Text, nullable=True)
    created_at = Column(DateTime, default=func.now(), index=True)
    
    # Relationships
    user = relationship('User', backref='audit_logs')
    
    __table_args__ = (
        Index('ix_audit_log_user_action', 'user_id', 'action'),
        Index('ix_audit_log_target', 'target_type', 'target_id'),
    )
    
    def __repr__(self):
        return f"<AuditLog {self.action} by user {self.user_id}>"
    
    def to_dict(self) -> Dict:
        return {
            "id": self.id,
            "user_id": self.user_id,
            "action": self.action,
            "target_type": self.target_type,
            "target_id": self.target_id,
            "target_name": self.target_name,
            "old_value": self.old_value,
            "new_value": self.new_value,
            "ip_address": self.ip_address,
            "created_at": self.created_at.isoformat() if self.created_at else None
        }


# Default Permissions Definition

DEFAULT_PERMISSIONS = [
    # Chat permissions
    {"name": "chat.create", "display_name": "Create Chats", "category": "chat", "description": "Create new chat sessions"},
    {"name": "chat.read", "display_name": "View Chats", "category": "chat", "description": "View chat history"},
    {"name": "chat.update", "display_name": "Edit Chats", "category": "chat", "description": "Edit chat messages and settings"},
    {"name": "chat.delete", "display_name": "Delete Chats", "category": "chat", "description": "Delete chat sessions"},
    {"name": "chat.share", "display_name": "Share Chats", "category": "chat", "description": "Share chats with other users"},
    {"name": "chat.export", "display_name": "Export Chats", "category": "chat", "description": "Export chat history"},
    
    # Project permissions
    {"name": "project.create", "display_name": "Create Projects", "category": "project", "description": "Create new projects"},
    {"name": "project.read", "display_name": "View Projects", "category": "project", "description": "View project details"},
    {"name": "project.update", "display_name": "Edit Projects", "category": "project", "description": "Edit project settings"},
    {"name": "project.delete", "display_name": "Delete Projects", "category": "project", "description": "Delete projects"},
    {"name": "project.manage_members", "display_name": "Manage Members", "category": "project", "description": "Add/remove project members"},
    {"name": "project.transfer", "display_name": "Transfer Ownership", "category": "project", "description": "Transfer project ownership"},
    
    # Workspace permissions
    {"name": "workspace.create", "display_name": "Create Files", "category": "workspace", "description": "Create files and folders"},
    {"name": "workspace.read", "display_name": "View Files", "category": "workspace", "description": "View workspace files"},
    {"name": "workspace.update", "display_name": "Edit Files", "category": "workspace", "description": "Edit files"},
    {"name": "workspace.delete", "display_name": "Delete Files", "category": "workspace", "description": "Delete files and folders"},
    {"name": "workspace.upload", "display_name": "Upload Files", "category": "workspace", "description": "Upload files"},
    {"name": "workspace.download", "display_name": "Download Files", "category": "workspace", "description": "Download files"},
    {"name": "workspace.share", "display_name": "Share Files", "category": "workspace", "description": "Share workspace items"},
    
    # Plugin permissions
    {"name": "plugin.create", "display_name": "Create Plugins", "category": "plugin", "description": "Create new plugins"},
    {"name": "plugin.read", "display_name": "View Plugins", "category": "plugin", "description": "View plugins"},
    {"name": "plugin.update", "display_name": "Edit Plugins", "category": "plugin", "description": "Edit plugins"},
    {"name": "plugin.delete", "display_name": "Delete Plugins", "category": "plugin", "description": "Delete plugins"},
    {"name": "plugin.execute", "display_name": "Execute Plugins", "category": "plugin", "description": "Run plugins"},
    {"name": "plugin.publish", "display_name": "Publish Plugins", "category": "plugin", "description": "Publish to marketplace"},
    {"name": "plugin.install", "display_name": "Install Plugins", "category": "plugin", "description": "Install plugins"},
    {"name": "plugin.manage", "display_name": "Manage All Plugins", "category": "plugin", "description": "Admin plugin management"},
    
    # Comparison permissions
    {"name": "comparison.create", "display_name": "Create Comparisons", "category": "comparison", "description": "Create model comparisons"},
    {"name": "comparison.read", "display_name": "View Comparisons", "category": "comparison", "description": "View comparisons"},
    {"name": "comparison.delete", "display_name": "Delete Comparisons", "category": "comparison", "description": "Delete comparisons"},
    {"name": "comparison.rate", "display_name": "Rate Responses", "category": "comparison", "description": "Rate model responses"},
    
    # MCP permissions
    {"name": "mcp.connect", "display_name": "Connect to UE5", "category": "mcp", "description": "Connect to UE5 editor"},
    {"name": "mcp.execute", "display_name": "Execute Tools", "category": "mcp", "description": "Execute MCP tools"},
    {"name": "mcp.manage", "display_name": "Manage Connections", "category": "mcp", "description": "Manage MCP connections"},
    
    # Agent permissions
    {"name": "agent.create", "display_name": "Create Agents", "category": "agent", "description": "Create custom agents"},
    {"name": "agent.read", "display_name": "View Agents", "category": "agent", "description": "View agents"},
    {"name": "agent.update", "display_name": "Edit Agents", "category": "agent", "description": "Edit agents"},
    {"name": "agent.delete", "display_name": "Delete Agents", "category": "agent", "description": "Delete agents"},
    {"name": "agent.use", "display_name": "Use Agents", "category": "agent", "description": "Use agents in chat"},
    
    # Admin permissions
    {"name": "admin.users.read", "display_name": "View Users", "category": "admin", "description": "View all users"},
    {"name": "admin.users.create", "display_name": "Create Users", "category": "admin", "description": "Create new users"},
    {"name": "admin.users.update", "display_name": "Edit Users", "category": "admin", "description": "Edit user details"},
    {"name": "admin.users.delete", "display_name": "Delete Users", "category": "admin", "description": "Delete users"},
    {"name": "admin.roles.manage", "display_name": "Manage Roles", "category": "admin", "description": "Manage roles and permissions"},
    {"name": "admin.settings.manage", "display_name": "Manage Settings", "category": "admin", "description": "Manage system settings"},
    {"name": "admin.audit.read", "display_name": "View Audit Logs", "category": "admin", "description": "View audit logs"},
    {"name": "admin.billing.manage", "display_name": "Manage Billing", "category": "admin", "description": "Manage billing and subscriptions"},
    
    # Subscription permissions
    {"name": "subscription.view", "display_name": "View Subscription", "category": "subscription", "description": "View subscription status"},
    {"name": "subscription.upgrade", "display_name": "Upgrade Plan", "category": "subscription", "description": "Upgrade subscription"},
    {"name": "subscription.cancel", "display_name": "Cancel Plan", "category": "subscription", "description": "Cancel subscription"},
    {"name": "subscription.manage", "display_name": "Manage Subscriptions", "category": "subscription", "description": "Manage all subscriptions"},
    
    # System permissions
    {"name": "system.all", "display_name": "Full System Access", "category": "system", "description": "Complete system access (owner only)"},
]


# Default Roles Definition

DEFAULT_ROLES = [
    {
        "name": "owner",
        "display_name": "Owner",
        "description": "Full system control with all permissions",
        "level": RoleLevel.OWNER,
        "color": "#9333EA",
        "icon": "crown",
        "is_system": True,
        "permissions": ["system.all"]  # Owner has all permissions
    },
    {
        "name": "admin",
        "display_name": "Administrator",
        "description": "User and system management",
        "level": RoleLevel.ADMIN,
        "color": "#DC2626",
        "icon": "shield",
        "is_system": True,
        "permissions": [
            "chat.*", "project.*", "workspace.*", "plugin.*", "comparison.*",
            "mcp.*", "agent.*", "admin.users.*", "admin.roles.manage",
            "admin.settings.manage", "admin.audit.read", "subscription.manage"
        ]
    },
    {
        "name": "manager",
        "display_name": "Manager",
        "description": "Team and project management",
        "level": RoleLevel.MANAGER,
        "color": "#EA580C",
        "icon": "users",
        "is_system": True,
        "permissions": [
            "chat.*", "project.*", "workspace.*", "plugin.create", "plugin.read",
            "plugin.update", "plugin.delete", "plugin.execute", "plugin.publish",
            "plugin.install", "comparison.*", "mcp.connect", "mcp.execute",
            "agent.*", "admin.users.read", "admin.audit.read", "subscription.view"
        ]
    },
    {
        "name": "developer",
        "display_name": "Developer",
        "description": "Development and plugin creation",
        "level": RoleLevel.DEVELOPER,
        "color": "#2563EB",
        "icon": "code",
        "is_system": True,
        "permissions": [
            "chat.create", "chat.read", "chat.update", "chat.delete", "chat.export",
            "project.create", "project.read", "project.update", "project.delete",
            "workspace.*", "plugin.create", "plugin.read", "plugin.update",
            "plugin.delete", "plugin.execute", "plugin.publish", "plugin.install",
            "comparison.create", "comparison.read", "comparison.delete", "comparison.rate",
            "mcp.connect", "mcp.execute", "agent.*", "subscription.view"
        ]
    },
    {
        "name": "analyst",
        "display_name": "Analyst",
        "description": "Analysis and reporting",
        "level": RoleLevel.ANALYST,
        "color": "#059669",
        "icon": "chart",
        "is_system": True,
        "permissions": [
            "chat.create", "chat.read", "chat.update", "chat.delete", "chat.share", "chat.export",
            "project.create", "project.read", "project.update", "project.manage_members",
            "workspace.create", "workspace.read", "workspace.update", "workspace.delete",
            "workspace.upload", "workspace.download",
            "plugin.read", "plugin.execute", "plugin.install",
            "comparison.*", "mcp.connect", "mcp.execute",
            "agent.read", "agent.use", "subscription.view"
        ]
    },
    {
        "name": "user",
        "display_name": "User",
        "description": "Standard user access",
        "level": RoleLevel.USER,
        "color": "#6B7280",
        "icon": "user",
        "is_system": True,
        "permissions": [
            "chat.create", "chat.read", "chat.update", "chat.delete", "chat.export",
            "project.create", "project.read", "project.update",
            "workspace.create", "workspace.read", "workspace.update", "workspace.delete",
            "workspace.upload", "workspace.download",
            "plugin.read", "plugin.execute", "plugin.install",
            "comparison.create", "comparison.read", "comparison.delete", "comparison.rate",
            "mcp.connect", "mcp.execute",
            "agent.read", "agent.use", "subscription.view"
        ]
    },
    {
        "name": "guest",
        "display_name": "Guest",
        "description": "Read-only access",
        "level": RoleLevel.GUEST,
        "color": "#9CA3AF",
        "icon": "eye",
        "is_system": True,
        "permissions": [
            "chat.read", "project.read", "workspace.read",
            "plugin.read", "comparison.read", "agent.read"
        ]
    }
]


def expand_wildcard_permissions(permission_pattern: str, all_permissions: List[str]) -> List[str]:
    """Expand wildcard permission patterns like 'chat.*' to actual permissions."""
    if '*' not in permission_pattern:
        return [permission_pattern]
    
    prefix = permission_pattern.replace('*', '')
    return [p for p in all_permissions if p.startswith(prefix)]
