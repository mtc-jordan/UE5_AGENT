"""
Team Workspace Database Models

Multi-user project collaboration with teams, invitations, and shared resources.

Version: 2.3.0
"""

from sqlalchemy import (
    Column, Integer, String, DateTime, Boolean, Text, 
    ForeignKey, Enum as SQLEnum, UniqueConstraint, Index
)
from sqlalchemy.orm import relationship
from datetime import datetime, timedelta
from typing import Optional, List
import enum
import secrets

from core.database import Base


# =============================================================================
# ENUMS
# =============================================================================

class TeamRole(str, enum.Enum):
    """Team member roles with different permission levels."""
    OWNER = "owner"           # Full control, can delete team
    ADMIN = "admin"           # Can manage members and settings
    MANAGER = "manager"       # Can manage projects and resources
    MEMBER = "member"         # Standard access
    VIEWER = "viewer"         # Read-only access


class InvitationStatus(str, enum.Enum):
    """Status of team invitations."""
    PENDING = "pending"
    ACCEPTED = "accepted"
    DECLINED = "declined"
    EXPIRED = "expired"
    REVOKED = "revoked"


class TeamActivityType(str, enum.Enum):
    """Types of team activities for audit log."""
    TEAM_CREATED = "team_created"
    TEAM_UPDATED = "team_updated"
    TEAM_DELETED = "team_deleted"
    MEMBER_INVITED = "member_invited"
    MEMBER_JOINED = "member_joined"
    MEMBER_LEFT = "member_left"
    MEMBER_REMOVED = "member_removed"
    MEMBER_ROLE_CHANGED = "member_role_changed"
    PROJECT_ADDED = "project_added"
    PROJECT_REMOVED = "project_removed"
    RESOURCE_SHARED = "resource_shared"
    SETTINGS_CHANGED = "settings_changed"


# =============================================================================
# MODELS
# =============================================================================

class Team(Base):
    """
    Team model for multi-user collaboration.
    
    Teams can have multiple members with different roles and share
    projects, chats, and other resources.
    """
    __tablename__ = "teams"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(128), nullable=False)
    slug = Column(String(128), unique=True, nullable=False, index=True)
    description = Column(Text, nullable=True)
    avatar_url = Column(String(512), nullable=True)
    
    # Team settings
    is_active = Column(Boolean, default=True)
    is_public = Column(Boolean, default=False)  # Public teams can be discovered
    allow_member_invites = Column(Boolean, default=False)  # Members can invite others
    max_members = Column(Integer, default=10)  # -1 for unlimited
    
    # Subscription tier limits
    max_projects = Column(Integer, default=5)
    max_storage_mb = Column(Integer, default=1000)
    
    # Owner (creator)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    owner = relationship("User", foreign_keys=[owner_id])
    members = relationship("TeamMember", back_populates="team", cascade="all, delete-orphan")
    invitations = relationship("TeamInvitation", back_populates="team", cascade="all, delete-orphan")
    projects = relationship("TeamProject", back_populates="team", cascade="all, delete-orphan")
    activities = relationship("TeamActivity", back_populates="team", cascade="all, delete-orphan")
    
    def __repr__(self):
        return f"<Team {self.name} ({self.slug})>"
    
    def to_dict(self, include_members: bool = False) -> dict:
        """Convert team to dictionary."""
        result = {
            "id": self.id,
            "name": self.name,
            "slug": self.slug,
            "description": self.description,
            "avatar_url": self.avatar_url,
            "is_active": self.is_active,
            "is_public": self.is_public,
            "allow_member_invites": self.allow_member_invites,
            "max_members": self.max_members,
            "max_projects": self.max_projects,
            "max_storage_mb": self.max_storage_mb,
            "owner_id": self.owner_id,
            "member_count": len(self.members) if self.members else 0,
            "project_count": len(self.projects) if self.projects else 0,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None
        }
        
        if include_members:
            result["members"] = [m.to_dict() for m in self.members]
        
        return result


class TeamMember(Base):
    """
    Team membership with role-based access.
    
    Links users to teams with specific roles and permissions.
    """
    __tablename__ = "team_members"
    __table_args__ = (
        UniqueConstraint('team_id', 'user_id', name='uq_team_member'),
        Index('ix_team_members_user', 'user_id'),
    )
    
    id = Column(Integer, primary_key=True, index=True)
    team_id = Column(Integer, ForeignKey("teams.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    
    # Role and permissions
    role = Column(SQLEnum(TeamRole), default=TeamRole.MEMBER, nullable=False)
    
    # Custom permissions (override role defaults)
    can_invite = Column(Boolean, nullable=True)  # None = use role default
    can_manage_projects = Column(Boolean, nullable=True)
    can_manage_members = Column(Boolean, nullable=True)
    can_view_analytics = Column(Boolean, nullable=True)
    
    # Status
    is_active = Column(Boolean, default=True)
    
    # Timestamps
    joined_at = Column(DateTime, default=datetime.utcnow)
    last_active_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    team = relationship("Team", back_populates="members")
    user = relationship("User")
    
    def __repr__(self):
        return f"<TeamMember {self.user_id} in {self.team_id} as {self.role}>"
    
    def has_permission(self, permission: str) -> bool:
        """Check if member has a specific permission."""
        # Owner has all permissions
        if self.role == TeamRole.OWNER:
            return True
        
        # Check custom override first
        custom_perm = getattr(self, f"can_{permission}", None)
        if custom_perm is not None:
            return custom_perm
        
        # Role-based defaults
        role_permissions = {
            TeamRole.ADMIN: ["invite", "manage_projects", "manage_members", "view_analytics"],
            TeamRole.MANAGER: ["invite", "manage_projects", "view_analytics"],
            TeamRole.MEMBER: ["view_analytics"],
            TeamRole.VIEWER: []
        }
        
        return permission in role_permissions.get(self.role, [])
    
    def to_dict(self) -> dict:
        """Convert member to dictionary."""
        return {
            "id": self.id,
            "team_id": self.team_id,
            "user_id": self.user_id,
            "user": {
                "id": self.user.id,
                "username": self.user.username,
                "email": self.user.email
            } if self.user else None,
            "role": self.role.value,
            "is_active": self.is_active,
            "joined_at": self.joined_at.isoformat() if self.joined_at else None,
            "last_active_at": self.last_active_at.isoformat() if self.last_active_at else None,
            "permissions": {
                "can_invite": self.has_permission("invite"),
                "can_manage_projects": self.has_permission("manage_projects"),
                "can_manage_members": self.has_permission("manage_members"),
                "can_view_analytics": self.has_permission("view_analytics")
            }
        }


class TeamInvitation(Base):
    """
    Team invitation for adding new members.
    
    Supports both email-based invitations and invite links.
    """
    __tablename__ = "team_invitations"
    __table_args__ = (
        Index('ix_team_invitations_token', 'token'),
        Index('ix_team_invitations_email', 'email'),
    )
    
    id = Column(Integer, primary_key=True, index=True)
    team_id = Column(Integer, ForeignKey("teams.id", ondelete="CASCADE"), nullable=False)
    
    # Invitation details
    email = Column(String(320), nullable=True)  # Null for link-based invitations
    token = Column(String(64), unique=True, nullable=False)  # Index defined in __table_args__
    role = Column(SQLEnum(TeamRole), default=TeamRole.MEMBER, nullable=False)
    message = Column(Text, nullable=True)  # Personal message from inviter
    
    # Status
    status = Column(SQLEnum(InvitationStatus), default=InvitationStatus.PENDING, nullable=False)
    
    # Inviter
    invited_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    # Accepted by (if different from email recipient)
    accepted_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    expires_at = Column(DateTime, nullable=False)
    accepted_at = Column(DateTime, nullable=True)
    
    # Relationships
    team = relationship("Team", back_populates="invitations")
    invited_by = relationship("User", foreign_keys=[invited_by_id])
    accepted_by = relationship("User", foreign_keys=[accepted_by_id])
    
    @classmethod
    def generate_token(cls) -> str:
        """Generate a secure invitation token."""
        return secrets.token_urlsafe(32)
    
    @classmethod
    def default_expiry(cls) -> datetime:
        """Get default expiry time (7 days from now)."""
        return datetime.utcnow() + timedelta(days=7)
    
    def is_valid(self) -> bool:
        """Check if invitation is still valid."""
        if self.status != InvitationStatus.PENDING:
            return False
        if datetime.utcnow() > self.expires_at:
            return False
        return True
    
    def to_dict(self) -> dict:
        """Convert invitation to dictionary."""
        return {
            "id": self.id,
            "team_id": self.team_id,
            "team_name": self.team.name if self.team else None,
            "email": self.email,
            "token": self.token,
            "role": self.role.value,
            "message": self.message,
            "status": self.status.value,
            "invited_by": {
                "id": self.invited_by.id,
                "username": self.invited_by.username
            } if self.invited_by else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "expires_at": self.expires_at.isoformat() if self.expires_at else None,
            "is_valid": self.is_valid()
        }


class TeamProject(Base):
    """
    Links projects to teams for shared access.
    
    Projects can be shared with teams while maintaining
    individual ownership.
    """
    __tablename__ = "team_projects"
    __table_args__ = (
        UniqueConstraint('team_id', 'project_id', name='uq_team_project'),
    )
    
    id = Column(Integer, primary_key=True, index=True)
    team_id = Column(Integer, ForeignKey("teams.id", ondelete="CASCADE"), nullable=False)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    
    # Access level
    is_primary = Column(Boolean, default=False)  # Primary team for this project
    allow_edit = Column(Boolean, default=True)
    allow_delete = Column(Boolean, default=False)
    
    # Who shared it
    shared_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    # Timestamps
    shared_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    team = relationship("Team", back_populates="projects")
    project = relationship("Project")
    shared_by = relationship("User")
    
    def to_dict(self) -> dict:
        """Convert to dictionary."""
        return {
            "id": self.id,
            "team_id": self.team_id,
            "project_id": self.project_id,
            "project": {
                "id": self.project.id,
                "name": self.project.name,
                "ue_version": self.project.ue_version
            } if self.project else None,
            "is_primary": self.is_primary,
            "allow_edit": self.allow_edit,
            "allow_delete": self.allow_delete,
            "shared_by": {
                "id": self.shared_by.id,
                "username": self.shared_by.username
            } if self.shared_by else None,
            "shared_at": self.shared_at.isoformat() if self.shared_at else None
        }


class TeamActivity(Base):
    """
    Activity log for team actions.
    
    Tracks all significant team events for audit and activity feeds.
    """
    __tablename__ = "team_activities"
    __table_args__ = (
        Index('ix_team_activities_team_created', 'team_id', 'created_at'),
    )
    
    id = Column(Integer, primary_key=True, index=True)
    team_id = Column(Integer, ForeignKey("teams.id", ondelete="CASCADE"), nullable=False)
    
    # Activity details
    activity_type = Column(SQLEnum(TeamActivityType), nullable=False)
    description = Column(Text, nullable=False)
    
    # Actor
    actor_id = Column(Integer, ForeignKey("users.id"), nullable=True)  # Null for system actions
    
    # Target (optional, for member/project actions)
    target_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    target_project_id = Column(Integer, ForeignKey("projects.id"), nullable=True)
    
    # Additional data
    activity_data = Column(Text, nullable=True)  # JSON string for extra data
    
    # Timestamp
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    
    # Relationships
    team = relationship("Team", back_populates="activities")
    actor = relationship("User", foreign_keys=[actor_id])
    target_user = relationship("User", foreign_keys=[target_user_id])
    
    def to_dict(self) -> dict:
        """Convert to dictionary."""
        return {
            "id": self.id,
            "team_id": self.team_id,
            "activity_type": self.activity_type.value,
            "description": self.description,
            "actor": {
                "id": self.actor.id,
                "username": self.actor.username
            } if self.actor else None,
            "target_user": {
                "id": self.target_user.id,
                "username": self.target_user.username
            } if self.target_user else None,
            "created_at": self.created_at.isoformat() if self.created_at else None
        }
