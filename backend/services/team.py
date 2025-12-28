"""
Team Service

Handles team management, invitations, and collaboration features.

Version: 2.3.0
"""

from typing import Optional, List, Dict, Any
from datetime import datetime
from sqlalchemy import select, and_, or_, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
import re
import json

from models.team import (
    Team, TeamMember, TeamInvitation, TeamProject, TeamActivity,
    TeamRole, InvitationStatus, TeamActivityType
)
from models.user import User
from models.project import Project


class TeamService:
    """Service for team management operations."""
    
    def __init__(self, db: AsyncSession):
        self.db = db
    
    # =========================================================================
    # TEAM CRUD
    # =========================================================================
    
    async def create_team(
        self,
        name: str,
        owner_id: int,
        description: Optional[str] = None,
        is_public: bool = False
    ) -> Team:
        """Create a new team."""
        # Generate slug from name
        slug = self._generate_slug(name)
        
        # Ensure unique slug
        base_slug = slug
        counter = 1
        while await self._slug_exists(slug):
            slug = f"{base_slug}-{counter}"
            counter += 1
        
        # Create team
        team = Team(
            name=name,
            slug=slug,
            description=description,
            owner_id=owner_id,
            is_public=is_public
        )
        self.db.add(team)
        await self.db.flush()
        
        # Add owner as member
        owner_member = TeamMember(
            team_id=team.id,
            user_id=owner_id,
            role=TeamRole.OWNER
        )
        self.db.add(owner_member)
        
        # Log activity
        await self._log_activity(
            team_id=team.id,
            activity_type=TeamActivityType.TEAM_CREATED,
            description=f"Team '{name}' was created",
            actor_id=owner_id
        )
        
        await self.db.commit()
        await self.db.refresh(team)
        
        return team
    
    async def get_team(self, team_id: int) -> Optional[Team]:
        """Get team by ID."""
        result = await self.db.execute(
            select(Team)
            .options(selectinload(Team.members).selectinload(TeamMember.user))
            .options(selectinload(Team.projects))
            .where(Team.id == team_id)
        )
        return result.scalar_one_or_none()
    
    async def get_team_by_slug(self, slug: str) -> Optional[Team]:
        """Get team by slug."""
        result = await self.db.execute(
            select(Team)
            .options(selectinload(Team.members).selectinload(TeamMember.user))
            .where(Team.slug == slug)
        )
        return result.scalar_one_or_none()
    
    async def update_team(
        self,
        team_id: int,
        actor_id: int,
        **updates
    ) -> Optional[Team]:
        """Update team details."""
        team = await self.get_team(team_id)
        if not team:
            return None
        
        allowed_fields = [
            'name', 'description', 'avatar_url', 'is_public',
            'allow_member_invites', 'max_members'
        ]
        
        for field, value in updates.items():
            if field in allowed_fields:
                setattr(team, field, value)
        
        # Log activity
        await self._log_activity(
            team_id=team_id,
            activity_type=TeamActivityType.TEAM_UPDATED,
            description=f"Team settings were updated",
            actor_id=actor_id,
            metadata=json.dumps(updates)
        )
        
        await self.db.commit()
        await self.db.refresh(team)
        
        return team
    
    async def delete_team(self, team_id: int, actor_id: int) -> bool:
        """Delete a team."""
        team = await self.get_team(team_id)
        if not team:
            return False
        
        await self.db.delete(team)
        await self.db.commit()
        
        return True
    
    async def list_user_teams(self, user_id: int) -> List[Team]:
        """List all teams a user belongs to."""
        result = await self.db.execute(
            select(Team)
            .join(TeamMember)
            .options(selectinload(Team.members))
            .where(
                and_(
                    TeamMember.user_id == user_id,
                    TeamMember.is_active == True,
                    Team.is_active == True
                )
            )
            .order_by(Team.name)
        )
        return list(result.scalars().all())
    
    async def search_public_teams(
        self,
        query: str,
        limit: int = 20,
        offset: int = 0
    ) -> List[Team]:
        """Search public teams."""
        result = await self.db.execute(
            select(Team)
            .where(
                and_(
                    Team.is_public == True,
                    Team.is_active == True,
                    or_(
                        Team.name.ilike(f"%{query}%"),
                        Team.description.ilike(f"%{query}%")
                    )
                )
            )
            .order_by(Team.name)
            .limit(limit)
            .offset(offset)
        )
        return list(result.scalars().all())
    
    # =========================================================================
    # MEMBER MANAGEMENT
    # =========================================================================
    
    async def add_member(
        self,
        team_id: int,
        user_id: int,
        role: TeamRole = TeamRole.MEMBER,
        actor_id: Optional[int] = None
    ) -> Optional[TeamMember]:
        """Add a member to a team."""
        # Check if already a member
        existing = await self._get_member(team_id, user_id)
        if existing:
            return existing
        
        # Check team capacity
        team = await self.get_team(team_id)
        if not team:
            return None
        
        if team.max_members != -1 and len(team.members) >= team.max_members:
            raise ValueError("Team has reached maximum member capacity")
        
        # Add member
        member = TeamMember(
            team_id=team_id,
            user_id=user_id,
            role=role
        )
        self.db.add(member)
        
        # Log activity
        await self._log_activity(
            team_id=team_id,
            activity_type=TeamActivityType.MEMBER_JOINED,
            description=f"New member joined the team",
            actor_id=actor_id,
            target_user_id=user_id
        )
        
        await self.db.commit()
        await self.db.refresh(member)
        
        return member
    
    async def remove_member(
        self,
        team_id: int,
        user_id: int,
        actor_id: int,
        is_leaving: bool = False
    ) -> bool:
        """Remove a member from a team."""
        member = await self._get_member(team_id, user_id)
        if not member:
            return False
        
        # Cannot remove owner
        if member.role == TeamRole.OWNER:
            raise ValueError("Cannot remove team owner")
        
        await self.db.delete(member)
        
        # Log activity
        activity_type = TeamActivityType.MEMBER_LEFT if is_leaving else TeamActivityType.MEMBER_REMOVED
        description = "Member left the team" if is_leaving else "Member was removed from the team"
        
        await self._log_activity(
            team_id=team_id,
            activity_type=activity_type,
            description=description,
            actor_id=actor_id,
            target_user_id=user_id
        )
        
        await self.db.commit()
        
        return True
    
    async def update_member_role(
        self,
        team_id: int,
        user_id: int,
        new_role: TeamRole,
        actor_id: int
    ) -> Optional[TeamMember]:
        """Update a member's role."""
        member = await self._get_member(team_id, user_id)
        if not member:
            return None
        
        # Cannot change owner role
        if member.role == TeamRole.OWNER:
            raise ValueError("Cannot change owner role")
        
        # Cannot promote to owner
        if new_role == TeamRole.OWNER:
            raise ValueError("Cannot promote to owner")
        
        old_role = member.role
        member.role = new_role
        
        # Log activity
        await self._log_activity(
            team_id=team_id,
            activity_type=TeamActivityType.MEMBER_ROLE_CHANGED,
            description=f"Member role changed from {old_role.value} to {new_role.value}",
            actor_id=actor_id,
            target_user_id=user_id
        )
        
        await self.db.commit()
        await self.db.refresh(member)
        
        return member
    
    async def get_member(self, team_id: int, user_id: int) -> Optional[TeamMember]:
        """Get a team member."""
        return await self._get_member(team_id, user_id)
    
    async def list_members(self, team_id: int) -> List[TeamMember]:
        """List all team members."""
        result = await self.db.execute(
            select(TeamMember)
            .options(selectinload(TeamMember.user))
            .where(TeamMember.team_id == team_id)
            .order_by(TeamMember.role, TeamMember.joined_at)
        )
        return list(result.scalars().all())
    
    # =========================================================================
    # INVITATIONS
    # =========================================================================
    
    async def create_invitation(
        self,
        team_id: int,
        invited_by_id: int,
        email: Optional[str] = None,
        role: TeamRole = TeamRole.MEMBER,
        message: Optional[str] = None,
        expires_days: int = 7
    ) -> TeamInvitation:
        """Create a team invitation."""
        invitation = TeamInvitation(
            team_id=team_id,
            email=email,
            token=TeamInvitation.generate_token(),
            role=role,
            message=message,
            invited_by_id=invited_by_id,
            expires_at=datetime.utcnow() + timedelta(days=expires_days)
        )
        self.db.add(invitation)
        
        # Log activity
        await self._log_activity(
            team_id=team_id,
            activity_type=TeamActivityType.MEMBER_INVITED,
            description=f"Invitation sent to {email or 'link'}",
            actor_id=invited_by_id
        )
        
        await self.db.commit()
        await self.db.refresh(invitation)
        
        return invitation
    
    async def get_invitation(self, token: str) -> Optional[TeamInvitation]:
        """Get invitation by token."""
        result = await self.db.execute(
            select(TeamInvitation)
            .options(selectinload(TeamInvitation.team))
            .options(selectinload(TeamInvitation.invited_by))
            .where(TeamInvitation.token == token)
        )
        return result.scalar_one_or_none()
    
    async def accept_invitation(
        self,
        token: str,
        user_id: int
    ) -> Optional[TeamMember]:
        """Accept a team invitation."""
        invitation = await self.get_invitation(token)
        if not invitation or not invitation.is_valid():
            return None
        
        # Add member
        member = await self.add_member(
            team_id=invitation.team_id,
            user_id=user_id,
            role=invitation.role,
            actor_id=user_id
        )
        
        # Update invitation
        invitation.status = InvitationStatus.ACCEPTED
        invitation.accepted_by_id = user_id
        invitation.accepted_at = datetime.utcnow()
        
        await self.db.commit()
        
        return member
    
    async def decline_invitation(self, token: str) -> bool:
        """Decline a team invitation."""
        invitation = await self.get_invitation(token)
        if not invitation or not invitation.is_valid():
            return False
        
        invitation.status = InvitationStatus.DECLINED
        await self.db.commit()
        
        return True
    
    async def revoke_invitation(self, invitation_id: int, actor_id: int) -> bool:
        """Revoke a team invitation."""
        result = await self.db.execute(
            select(TeamInvitation).where(TeamInvitation.id == invitation_id)
        )
        invitation = result.scalar_one_or_none()
        
        if not invitation:
            return False
        
        invitation.status = InvitationStatus.REVOKED
        await self.db.commit()
        
        return True
    
    async def list_team_invitations(
        self,
        team_id: int,
        status: Optional[InvitationStatus] = None
    ) -> List[TeamInvitation]:
        """List team invitations."""
        query = select(TeamInvitation).where(TeamInvitation.team_id == team_id)
        
        if status:
            query = query.where(TeamInvitation.status == status)
        
        result = await self.db.execute(
            query.order_by(TeamInvitation.created_at.desc())
        )
        return list(result.scalars().all())
    
    async def list_user_invitations(self, email: str) -> List[TeamInvitation]:
        """List pending invitations for a user email."""
        result = await self.db.execute(
            select(TeamInvitation)
            .options(selectinload(TeamInvitation.team))
            .where(
                and_(
                    TeamInvitation.email == email,
                    TeamInvitation.status == InvitationStatus.PENDING
                )
            )
            .order_by(TeamInvitation.created_at.desc())
        )
        return list(result.scalars().all())
    
    # =========================================================================
    # PROJECT SHARING
    # =========================================================================
    
    async def share_project(
        self,
        team_id: int,
        project_id: int,
        shared_by_id: int,
        allow_edit: bool = True,
        allow_delete: bool = False
    ) -> TeamProject:
        """Share a project with a team."""
        # Check if already shared
        result = await self.db.execute(
            select(TeamProject).where(
                and_(
                    TeamProject.team_id == team_id,
                    TeamProject.project_id == project_id
                )
            )
        )
        existing = result.scalar_one_or_none()
        if existing:
            return existing
        
        team_project = TeamProject(
            team_id=team_id,
            project_id=project_id,
            shared_by_id=shared_by_id,
            allow_edit=allow_edit,
            allow_delete=allow_delete
        )
        self.db.add(team_project)
        
        # Log activity
        await self._log_activity(
            team_id=team_id,
            activity_type=TeamActivityType.PROJECT_ADDED,
            description="Project was shared with the team",
            actor_id=shared_by_id,
            target_project_id=project_id
        )
        
        await self.db.commit()
        await self.db.refresh(team_project)
        
        return team_project
    
    async def unshare_project(
        self,
        team_id: int,
        project_id: int,
        actor_id: int
    ) -> bool:
        """Remove project from team."""
        result = await self.db.execute(
            select(TeamProject).where(
                and_(
                    TeamProject.team_id == team_id,
                    TeamProject.project_id == project_id
                )
            )
        )
        team_project = result.scalar_one_or_none()
        
        if not team_project:
            return False
        
        await self.db.delete(team_project)
        
        # Log activity
        await self._log_activity(
            team_id=team_id,
            activity_type=TeamActivityType.PROJECT_REMOVED,
            description="Project was removed from the team",
            actor_id=actor_id,
            target_project_id=project_id
        )
        
        await self.db.commit()
        
        return True
    
    async def list_team_projects(self, team_id: int) -> List[TeamProject]:
        """List all projects shared with a team."""
        result = await self.db.execute(
            select(TeamProject)
            .options(selectinload(TeamProject.project))
            .where(TeamProject.team_id == team_id)
            .order_by(TeamProject.shared_at.desc())
        )
        return list(result.scalars().all())
    
    # =========================================================================
    # ACTIVITY LOG
    # =========================================================================
    
    async def list_activities(
        self,
        team_id: int,
        limit: int = 50,
        offset: int = 0
    ) -> List[TeamActivity]:
        """List team activities."""
        result = await self.db.execute(
            select(TeamActivity)
            .options(selectinload(TeamActivity.actor))
            .options(selectinload(TeamActivity.target_user))
            .where(TeamActivity.team_id == team_id)
            .order_by(TeamActivity.created_at.desc())
            .limit(limit)
            .offset(offset)
        )
        return list(result.scalars().all())
    
    # =========================================================================
    # PERMISSION CHECKS
    # =========================================================================
    
    async def check_permission(
        self,
        team_id: int,
        user_id: int,
        permission: str
    ) -> bool:
        """Check if user has permission in team."""
        member = await self._get_member(team_id, user_id)
        if not member:
            return False
        return member.has_permission(permission)
    
    async def is_member(self, team_id: int, user_id: int) -> bool:
        """Check if user is a team member."""
        member = await self._get_member(team_id, user_id)
        return member is not None and member.is_active
    
    async def is_owner(self, team_id: int, user_id: int) -> bool:
        """Check if user is team owner."""
        member = await self._get_member(team_id, user_id)
        return member is not None and member.role == TeamRole.OWNER
    
    # =========================================================================
    # PRIVATE HELPERS
    # =========================================================================
    
    def _generate_slug(self, name: str) -> str:
        """Generate URL-friendly slug from name."""
        slug = name.lower()
        slug = re.sub(r'[^a-z0-9]+', '-', slug)
        slug = slug.strip('-')
        return slug[:64]
    
    async def _slug_exists(self, slug: str) -> bool:
        """Check if slug already exists."""
        result = await self.db.execute(
            select(func.count(Team.id)).where(Team.slug == slug)
        )
        return result.scalar() > 0
    
    async def _get_member(self, team_id: int, user_id: int) -> Optional[TeamMember]:
        """Get team member."""
        result = await self.db.execute(
            select(TeamMember)
            .options(selectinload(TeamMember.user))
            .where(
                and_(
                    TeamMember.team_id == team_id,
                    TeamMember.user_id == user_id
                )
            )
        )
        return result.scalar_one_or_none()
    
    async def _log_activity(
        self,
        team_id: int,
        activity_type: TeamActivityType,
        description: str,
        actor_id: Optional[int] = None,
        target_user_id: Optional[int] = None,
        target_project_id: Optional[int] = None,
        metadata: Optional[str] = None
    ):
        """Log team activity."""
        activity = TeamActivity(
            team_id=team_id,
            activity_type=activity_type,
            description=description,
            actor_id=actor_id,
            target_user_id=target_user_id,
            target_project_id=target_project_id,
            metadata=metadata
        )
        self.db.add(activity)


# Import for timedelta
from datetime import timedelta


# Singleton instance
def get_team_service(db: AsyncSession) -> TeamService:
    """Get team service instance."""
    return TeamService(db)
