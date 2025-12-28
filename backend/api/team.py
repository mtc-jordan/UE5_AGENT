"""
Team API Endpoints

REST API for team management, invitations, and collaboration.

Version: 2.3.0
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import datetime

from core.database import get_db
from services.auth import get_current_user
from services.team import TeamService, get_team_service
from models.user import User
from models.team import TeamRole, InvitationStatus


router = APIRouter(prefix="/teams", tags=["teams"])


# =============================================================================
# SCHEMAS
# =============================================================================

class TeamCreate(BaseModel):
    name: str
    description: Optional[str] = None
    is_public: bool = False


class TeamUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    avatar_url: Optional[str] = None
    is_public: Optional[bool] = None
    allow_member_invites: Optional[bool] = None
    max_members: Optional[int] = None


class InvitationCreate(BaseModel):
    email: Optional[EmailStr] = None
    role: str = "member"
    message: Optional[str] = None
    expires_days: int = 7


class MemberRoleUpdate(BaseModel):
    role: str


class ProjectShare(BaseModel):
    project_id: int
    allow_edit: bool = True
    allow_delete: bool = False


# =============================================================================
# TEAM ENDPOINTS
# =============================================================================

@router.post("")
async def create_team(
    data: TeamCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Create a new team."""
    service = get_team_service(db)
    
    try:
        team = await service.create_team(
            name=data.name,
            owner_id=current_user.id,
            description=data.description,
            is_public=data.is_public
        )
        return team.to_dict(include_members=True)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.get("")
async def list_my_teams(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """List teams the current user belongs to."""
    service = get_team_service(db)
    teams = await service.list_user_teams(current_user.id)
    return [t.to_dict() for t in teams]


@router.get("/search")
async def search_teams(
    q: str = Query(..., min_length=1),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db)
):
    """Search public teams."""
    service = get_team_service(db)
    teams = await service.search_public_teams(q, limit, offset)
    return [t.to_dict() for t in teams]


@router.get("/{team_id}")
async def get_team(
    team_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get team details."""
    service = get_team_service(db)
    team = await service.get_team(team_id)
    
    if not team:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Team not found"
        )
    
    # Check if user is member or team is public
    is_member = await service.is_member(team_id, current_user.id)
    if not is_member and not team.is_public:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to view this team"
        )
    
    return team.to_dict(include_members=is_member)


@router.put("/{team_id}")
async def update_team(
    team_id: int,
    data: TeamUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Update team details."""
    service = get_team_service(db)
    
    # Check permission
    if not await service.check_permission(team_id, current_user.id, "manage_members"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to update this team"
        )
    
    updates = data.dict(exclude_unset=True)
    team = await service.update_team(team_id, current_user.id, **updates)
    
    if not team:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Team not found"
        )
    
    return team.to_dict()


@router.delete("/{team_id}")
async def delete_team(
    team_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Delete a team (owner only)."""
    service = get_team_service(db)
    
    # Only owner can delete
    if not await service.is_owner(team_id, current_user.id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only team owner can delete the team"
        )
    
    success = await service.delete_team(team_id, current_user.id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Team not found"
        )
    
    return {"message": "Team deleted successfully"}


# =============================================================================
# MEMBER ENDPOINTS
# =============================================================================

@router.get("/{team_id}/members")
async def list_members(
    team_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """List team members."""
    service = get_team_service(db)
    
    if not await service.is_member(team_id, current_user.id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not a team member"
        )
    
    members = await service.list_members(team_id)
    return [m.to_dict() for m in members]


@router.put("/{team_id}/members/{user_id}/role")
async def update_member_role(
    team_id: int,
    user_id: int,
    data: MemberRoleUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Update a member's role."""
    service = get_team_service(db)
    
    if not await service.check_permission(team_id, current_user.id, "manage_members"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to manage members"
        )
    
    try:
        role = TeamRole(data.role)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid role: {data.role}"
        )
    
    try:
        member = await service.update_member_role(team_id, user_id, role, current_user.id)
        if not member:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Member not found"
            )
        return member.to_dict()
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.delete("/{team_id}/members/{user_id}")
async def remove_member(
    team_id: int,
    user_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Remove a member from the team."""
    service = get_team_service(db)
    
    # Can remove self or need permission
    is_self = user_id == current_user.id
    if not is_self and not await service.check_permission(team_id, current_user.id, "manage_members"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to remove members"
        )
    
    try:
        success = await service.remove_member(team_id, user_id, current_user.id, is_leaving=is_self)
        if not success:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Member not found"
            )
        return {"message": "Member removed successfully"}
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.post("/{team_id}/leave")
async def leave_team(
    team_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Leave a team."""
    service = get_team_service(db)
    
    try:
        success = await service.remove_member(team_id, current_user.id, current_user.id, is_leaving=True)
        if not success:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Not a team member"
            )
        return {"message": "Left team successfully"}
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


# =============================================================================
# INVITATION ENDPOINTS
# =============================================================================

@router.post("/{team_id}/invitations")
async def create_invitation(
    team_id: int,
    data: InvitationCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Create a team invitation."""
    service = get_team_service(db)
    
    if not await service.check_permission(team_id, current_user.id, "invite"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to invite members"
        )
    
    try:
        role = TeamRole(data.role)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid role: {data.role}"
        )
    
    invitation = await service.create_invitation(
        team_id=team_id,
        invited_by_id=current_user.id,
        email=data.email,
        role=role,
        message=data.message,
        expires_days=data.expires_days
    )
    
    return invitation.to_dict()


@router.get("/{team_id}/invitations")
async def list_invitations(
    team_id: int,
    status: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """List team invitations."""
    service = get_team_service(db)
    
    if not await service.check_permission(team_id, current_user.id, "invite"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to view invitations"
        )
    
    inv_status = None
    if status:
        try:
            inv_status = InvitationStatus(status)
        except ValueError:
            pass
    
    invitations = await service.list_team_invitations(team_id, inv_status)
    return [i.to_dict() for i in invitations]


@router.delete("/{team_id}/invitations/{invitation_id}")
async def revoke_invitation(
    team_id: int,
    invitation_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Revoke a team invitation."""
    service = get_team_service(db)
    
    if not await service.check_permission(team_id, current_user.id, "invite"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to revoke invitations"
        )
    
    success = await service.revoke_invitation(invitation_id, current_user.id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invitation not found"
        )
    
    return {"message": "Invitation revoked"}


@router.get("/invitations/pending")
async def list_my_invitations(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """List pending invitations for current user."""
    service = get_team_service(db)
    invitations = await service.list_user_invitations(current_user.email)
    return [i.to_dict() for i in invitations]


@router.post("/invitations/{token}/accept")
async def accept_invitation(
    token: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Accept a team invitation."""
    service = get_team_service(db)
    
    member = await service.accept_invitation(token, current_user.id)
    if not member:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired invitation"
        )
    
    return {
        "message": "Invitation accepted",
        "team_id": member.team_id,
        "role": member.role.value
    }


@router.post("/invitations/{token}/decline")
async def decline_invitation(
    token: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Decline a team invitation."""
    service = get_team_service(db)
    
    success = await service.decline_invitation(token)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired invitation"
        )
    
    return {"message": "Invitation declined"}


# =============================================================================
# PROJECT SHARING ENDPOINTS
# =============================================================================

@router.post("/{team_id}/projects")
async def share_project(
    team_id: int,
    data: ProjectShare,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Share a project with the team."""
    service = get_team_service(db)
    
    if not await service.check_permission(team_id, current_user.id, "manage_projects"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to share projects"
        )
    
    team_project = await service.share_project(
        team_id=team_id,
        project_id=data.project_id,
        shared_by_id=current_user.id,
        allow_edit=data.allow_edit,
        allow_delete=data.allow_delete
    )
    
    return team_project.to_dict()


@router.get("/{team_id}/projects")
async def list_team_projects(
    team_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """List projects shared with the team."""
    service = get_team_service(db)
    
    if not await service.is_member(team_id, current_user.id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not a team member"
        )
    
    projects = await service.list_team_projects(team_id)
    return [p.to_dict() for p in projects]


@router.delete("/{team_id}/projects/{project_id}")
async def unshare_project(
    team_id: int,
    project_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Remove a project from the team."""
    service = get_team_service(db)
    
    if not await service.check_permission(team_id, current_user.id, "manage_projects"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to manage projects"
        )
    
    success = await service.unshare_project(team_id, project_id, current_user.id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found in team"
        )
    
    return {"message": "Project removed from team"}


# =============================================================================
# ACTIVITY ENDPOINTS
# =============================================================================

@router.get("/{team_id}/activities")
async def list_activities(
    team_id: int,
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """List team activities."""
    service = get_team_service(db)
    
    if not await service.is_member(team_id, current_user.id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not a team member"
        )
    
    activities = await service.list_activities(team_id, limit, offset)
    return [a.to_dict() for a in activities]
