"""
Admin API Endpoints.

REST API for administrative functions including user management,
role assignment, and system configuration.

Version: 1.0.0
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import datetime

from core.database import get_db
from services.auth import get_current_user
from services.rbac import rbac_service
from models.user import User
from models.rbac import Role

router = APIRouter(prefix="/admin", tags=["Admin"])


# =============================================================================
# SCHEMAS
# =============================================================================

class UserResponse(BaseModel):
    """User response schema."""
    id: int
    email: str
    username: str
    is_active: bool
    is_admin: bool
    is_online: bool
    roles: List[str]
    created_at: str
    last_seen: Optional[str]


class AssignRoleRequest(BaseModel):
    """Assign role to user request."""
    user_id: int
    role_name: str


class RemoveRoleRequest(BaseModel):
    """Remove role from user request."""
    user_id: int
    role_name: str


class UpdateUserRequest(BaseModel):
    """Update user request."""
    is_active: Optional[bool] = None
    is_admin: Optional[bool] = None


class RoleResponse(BaseModel):
    """Role response schema."""
    id: int
    name: str
    display_name: str
    description: Optional[str]
    level: int
    is_system: bool
    permission_count: int


# =============================================================================
# PERMISSION CHECKS
# =============================================================================

async def require_admin(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Require admin permissions."""
    # Check if user is admin (legacy) or has admin.users permission
    if not current_user.is_admin and not await rbac_service.has_permission(
        db, current_user.id, "admin.users"
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )
    return current_user


# =============================================================================
# USER MANAGEMENT ENDPOINTS
# =============================================================================

@router.get("/users", response_model=List[UserResponse])
async def list_users(
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin)
):
    """List all users (admin only)."""
    result = await db.execute(
        select(User).offset(skip).limit(limit)
    )
    users = result.scalars().all()
    
    return [
        UserResponse(
            id=u.id,
            email=u.email,
            username=u.username,
            is_active=u.is_active,
            is_admin=u.is_admin,
            is_online=u.is_online,
            roles=u.get_role_names(),
            created_at=u.created_at.isoformat() if u.created_at else None,
            last_seen=u.last_seen.isoformat() if u.last_seen else None
        )
        for u in users
    ]


@router.get("/users/{user_id}", response_model=UserResponse)
async def get_user(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin)
):
    """Get user details (admin only)."""
    result = await db.execute(
        select(User).where(User.id == user_id)
    )
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    return UserResponse(
        id=user.id,
        email=user.email,
        username=user.username,
        is_active=user.is_active,
        is_admin=user.is_admin,
        is_online=user.is_online,
        roles=user.get_role_names(),
        created_at=user.created_at.isoformat() if user.created_at else None,
        last_seen=user.last_seen.isoformat() if user.last_seen else None
    )


@router.patch("/users/{user_id}")
async def update_user(
    user_id: int,
    request: UpdateUserRequest,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin)
):
    """Update user (admin only)."""
    # Get user
    result = await db.execute(
        select(User).where(User.id == user_id)
    )
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Update fields
    if request.is_active is not None:
        user.is_active = request.is_active
    
    if request.is_admin is not None:
        user.is_admin = request.is_admin
    
    user.updated_at = datetime.utcnow()
    
    await db.commit()
    await db.refresh(user)
    
    return {
        "message": "User updated successfully",
        "user": UserResponse(
            id=user.id,
            email=user.email,
            username=user.username,
            is_active=user.is_active,
            is_admin=user.is_admin,
            is_online=user.is_online,
            roles=user.get_role_names(),
            created_at=user.created_at.isoformat() if user.created_at else None,
            last_seen=user.last_seen.isoformat() if user.last_seen else None
        )
    }


@router.delete("/users/{user_id}")
async def delete_user(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin)
):
    """Delete user (admin only)."""
    # Prevent self-deletion
    if user_id == admin.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete your own account"
        )
    
    # Get user
    result = await db.execute(
        select(User).where(User.id == user_id)
    )
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    await db.delete(user)
    await db.commit()
    
    return {"message": "User deleted successfully"}


# =============================================================================
# ROLE MANAGEMENT ENDPOINTS
# =============================================================================

@router.get("/roles", response_model=List[RoleResponse])
async def list_roles(
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin)
):
    """List all roles (admin only)."""
    result = await db.execute(select(Role))
    roles = result.scalars().all()
    
    return [
        RoleResponse(
            id=r.id,
            name=r.name,
            display_name=r.display_name,
            description=r.description,
            level=r.level,
            is_system=r.is_system,
            permission_count=len(r.permissions) if r.permissions else 0
        )
        for r in roles
    ]


@router.post("/users/assign-role")
async def assign_role(
    request: AssignRoleRequest,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin)
):
    """Assign role to user (admin only)."""
    success = await rbac_service.assign_role_to_user(
        db, request.user_id, request.role_name
    )
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Failed to assign role. User or role may not exist."
        )
    
    return {"message": f"Role '{request.role_name}' assigned successfully"}


@router.post("/users/remove-role")
async def remove_role(
    request: RemoveRoleRequest,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin)
):
    """Remove role from user (admin only)."""
    success = await rbac_service.remove_role_from_user(
        db, request.user_id, request.role_name
    )
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Failed to remove role"
        )
    
    return {"message": f"Role '{request.role_name}' removed successfully"}


@router.post("/users/{user_id}/make-admin")
async def make_admin(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin)
):
    """Make user an admin (admin only)."""
    # Get user
    result = await db.execute(
        select(User).where(User.id == user_id)
    )
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Set admin flag
    user.is_admin = True
    user.updated_at = datetime.utcnow()
    
    # Also assign admin role if it exists
    await rbac_service.assign_role_to_user(db, user_id, "admin")
    
    await db.commit()
    
    return {
        "message": f"User '{user.username}' is now an admin",
        "user_id": user_id,
        "username": user.username
    }


@router.post("/users/{user_id}/remove-admin")
async def remove_admin(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin)
):
    """Remove admin privileges from user (admin only)."""
    # Prevent self-demotion
    if user_id == admin.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot remove your own admin privileges"
        )
    
    # Get user
    result = await db.execute(
        select(User).where(User.id == user_id)
    )
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Remove admin flag
    user.is_admin = False
    user.updated_at = datetime.utcnow()
    
    # Also remove admin role if assigned
    await rbac_service.remove_role_from_user(db, user_id, "admin")
    
    await db.commit()
    
    return {
        "message": f"Admin privileges removed from user '{user.username}'",
        "user_id": user_id,
        "username": user.username
    }


# =============================================================================
# SYSTEM STATUS ENDPOINTS
# =============================================================================

@router.get("/stats")
async def get_admin_stats(
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin)
):
    """Get admin statistics (admin only)."""
    # Count users
    result = await db.execute(select(User))
    total_users = len(result.scalars().all())
    
    # Count active users
    result = await db.execute(select(User).where(User.is_active == True))
    active_users = len(result.scalars().all())
    
    # Count admins
    result = await db.execute(select(User).where(User.is_admin == True))
    admin_users = len(result.scalars().all())
    
    # Count online users
    result = await db.execute(select(User).where(User.is_online == True))
    online_users = len(result.scalars().all())
    
    return {
        "total_users": total_users,
        "active_users": active_users,
        "admin_users": admin_users,
        "online_users": online_users,
        "inactive_users": total_users - active_users
    }
