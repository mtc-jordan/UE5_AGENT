"""
RBAC API Endpoints.

Provides role and permission management endpoints.
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime

from core.database import get_db
from services.auth import get_current_user
from core.permissions import (
    require_permission, require_role, can_manage_roles,
    can_read_users, can_update_users, can_read_audit
)
from services.rbac import rbac_service
from models.user import User
from models.rbac import RoleLevel

router = APIRouter(prefix="/rbac", tags=["RBAC"])


# ==================== Schemas ====================

class PermissionResponse(BaseModel):
    id: int
    name: str
    display_name: str
    description: Optional[str]
    category: str
    is_active: bool

    class Config:
        from_attributes = True


class RoleCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=50)
    display_name: str = Field(..., min_length=2, max_length=100)
    description: Optional[str] = None
    level: int = Field(default=40, ge=0, le=100)
    color: Optional[str] = Field(None, pattern=r'^#[0-9A-Fa-f]{6}$')
    icon: Optional[str] = None
    permissions: List[str] = []


class RoleUpdate(BaseModel):
    display_name: Optional[str] = Field(None, min_length=2, max_length=100)
    description: Optional[str] = None
    level: Optional[int] = Field(None, ge=0, le=100)
    color: Optional[str] = Field(None, pattern=r'^#[0-9A-Fa-f]{6}$')
    icon: Optional[str] = None
    is_active: Optional[bool] = None


class RoleResponse(BaseModel):
    id: int
    name: str
    display_name: str
    description: Optional[str]
    level: int
    color: Optional[str]
    icon: Optional[str]
    is_system: bool
    is_active: bool
    permissions: List[str]
    created_at: Optional[datetime]
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True


class RolePermissionsUpdate(BaseModel):
    permissions: List[str]


class UserRoleAssign(BaseModel):
    role_id: int
    expires_at: Optional[datetime] = None


class UserPermissionOverride(BaseModel):
    permission_name: str
    is_granted: bool
    expires_at: Optional[datetime] = None
    reason: Optional[str] = None


class UserRolesResponse(BaseModel):
    user_id: int
    username: str
    roles: List[RoleResponse]


class UserPermissionsResponse(BaseModel):
    user_id: int
    username: str
    permissions: List[str]
    role_permissions: List[str]
    overrides: List[dict]


class AuditLogResponse(BaseModel):
    id: int
    user_id: Optional[int]
    action: str
    target_type: str
    target_id: int
    target_name: Optional[str]
    old_value: Optional[dict]
    new_value: Optional[dict]
    ip_address: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class PaginatedAuditLogs(BaseModel):
    items: List[AuditLogResponse]
    total: int
    page: int
    page_size: int


# ==================== Role Endpoints ====================

@router.get("/roles", response_model=List[RoleResponse])
async def get_all_roles(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(can_manage_roles)
):
    """Get all roles."""
    roles = await rbac_service.get_all_roles(db)
    return [
        RoleResponse(
            id=r.id,
            name=r.name,
            display_name=r.display_name,
            description=r.description,
            level=r.level,
            color=r.color,
            icon=r.icon,
            is_system=r.is_system,
            is_active=r.is_active,
            permissions=[p.name for p in r.permissions],
            created_at=r.created_at,
            updated_at=r.updated_at
        )
        for r in roles
    ]


@router.post("/roles", response_model=RoleResponse, status_code=status.HTTP_201_CREATED)
async def create_role(
    role_data: RoleCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(can_manage_roles)
):
    """Create a new role."""
    # Check if role name exists
    existing = await rbac_service.get_role_by_name(db, role_data.name)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Role '{role_data.name}' already exists"
        )
    
    role = await rbac_service.create_role(
        db,
        name=role_data.name,
        display_name=role_data.display_name,
        description=role_data.description,
        level=role_data.level,
        color=role_data.color,
        icon=role_data.icon,
        permission_names=role_data.permissions,
        created_by=current_user.id
    )
    
    return RoleResponse(
        id=role.id,
        name=role.name,
        display_name=role.display_name,
        description=role.description,
        level=role.level,
        color=role.color,
        icon=role.icon,
        is_system=role.is_system,
        is_active=role.is_active,
        permissions=[p.name for p in role.permissions],
        created_at=role.created_at,
        updated_at=role.updated_at
    )


@router.get("/roles/{role_id}", response_model=RoleResponse)
async def get_role(
    role_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(can_manage_roles)
):
    """Get a specific role."""
    role = await rbac_service.get_role(db, role_id)
    if not role:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Role not found"
        )
    
    return RoleResponse(
        id=role.id,
        name=role.name,
        display_name=role.display_name,
        description=role.description,
        level=role.level,
        color=role.color,
        icon=role.icon,
        is_system=role.is_system,
        is_active=role.is_active,
        permissions=[p.name for p in role.permissions],
        created_at=role.created_at,
        updated_at=role.updated_at
    )


@router.put("/roles/{role_id}", response_model=RoleResponse)
async def update_role(
    role_id: int,
    role_data: RoleUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(can_manage_roles)
):
    """Update a role."""
    try:
        role = await rbac_service.update_role(
            db, role_id, current_user.id,
            **role_data.model_dump(exclude_unset=True)
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    
    if not role:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Role not found"
        )
    
    return RoleResponse(
        id=role.id,
        name=role.name,
        display_name=role.display_name,
        description=role.description,
        level=role.level,
        color=role.color,
        icon=role.icon,
        is_system=role.is_system,
        is_active=role.is_active,
        permissions=[p.name for p in role.permissions],
        created_at=role.created_at,
        updated_at=role.updated_at
    )


@router.delete("/roles/{role_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_role(
    role_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(can_manage_roles)
):
    """Delete a role (non-system roles only)."""
    try:
        deleted = await rbac_service.delete_role(db, role_id, current_user.id)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Role not found"
        )


@router.put("/roles/{role_id}/permissions")
async def update_role_permissions(
    role_id: int,
    data: RolePermissionsUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(can_manage_roles)
):
    """Update permissions for a role."""
    try:
        await rbac_service.set_role_permissions(
            db, role_id, data.permissions, current_user.id
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    
    return {"message": "Permissions updated successfully"}


# ==================== Permission Endpoints ====================

@router.get("/permissions", response_model=List[PermissionResponse])
async def get_all_permissions(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(can_manage_roles)
):
    """Get all permissions."""
    permissions = await rbac_service.get_all_permissions(db)
    return permissions


@router.get("/permissions/categories")
async def get_permission_categories(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(can_manage_roles)
):
    """Get all permission categories."""
    categories = await rbac_service.get_permission_categories(db)
    return {"categories": categories}


@router.get("/permissions/by-category/{category}", response_model=List[PermissionResponse])
async def get_permissions_by_category(
    category: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(can_manage_roles)
):
    """Get permissions by category."""
    permissions = await rbac_service.get_permissions_by_category(db, category)
    return permissions


# ==================== User Role Endpoints ====================

@router.get("/users/{user_id}/roles", response_model=UserRolesResponse)
async def get_user_roles(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(can_read_users)
):
    """Get roles for a specific user."""
    from sqlalchemy import select
    from models.user import User as UserModel
    
    # Get user
    result = await db.execute(select(UserModel).where(UserModel.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    roles = await rbac_service.get_user_roles(db, user_id)
    
    return UserRolesResponse(
        user_id=user_id,
        username=user.username,
        roles=[
            RoleResponse(
                id=r.id,
                name=r.name,
                display_name=r.display_name,
                description=r.description,
                level=r.level,
                color=r.color,
                icon=r.icon,
                is_system=r.is_system,
                is_active=r.is_active,
                permissions=[p.name for p in r.permissions],
                created_at=r.created_at,
                updated_at=r.updated_at
            )
            for r in roles
        ]
    )


@router.post("/users/{user_id}/roles")
async def assign_user_role(
    user_id: int,
    data: UserRoleAssign,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(can_update_users)
):
    """Assign a role to a user."""
    # Check if target user exists
    from sqlalchemy import select
    from models.user import User as UserModel
    
    result = await db.execute(select(UserModel).where(UserModel.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Check role level - can't assign higher level roles than your own
    target_role = await rbac_service.get_role(db, data.role_id)
    if not target_role:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Role not found"
        )
    
    # Get current user's highest role
    current_roles = await rbac_service.get_user_roles(db, current_user.id)
    if current_roles:
        current_highest = min(r.level for r in current_roles)
        if target_role.level < current_highest:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Cannot assign a role higher than your own"
            )
    
    assigned = await rbac_service.assign_role(
        db, user_id, data.role_id, current_user.id, data.expires_at
    )
    
    if not assigned:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Role already assigned to user"
        )
    
    return {"message": "Role assigned successfully"}


@router.delete("/users/{user_id}/roles/{role_id}")
async def remove_user_role(
    user_id: int,
    role_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(can_update_users)
):
    """Remove a role from a user."""
    removed = await rbac_service.remove_role(db, user_id, role_id, current_user.id)
    
    if not removed:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Role not assigned to user"
        )
    
    return {"message": "Role removed successfully"}


# ==================== User Permission Endpoints ====================

@router.get("/users/{user_id}/permissions", response_model=UserPermissionsResponse)
async def get_user_permissions(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(can_read_users)
):
    """Get all permissions for a user (including overrides)."""
    from sqlalchemy import select
    from sqlalchemy.orm import selectinload
    from models.user import User as UserModel
    
    # Get user with overrides
    result = await db.execute(
        select(UserModel)
        .options(selectinload(UserModel.permission_overrides))
        .where(UserModel.id == user_id)
    )
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Get all permissions
    all_permissions = await rbac_service.get_user_permissions(db, user_id)
    
    # Get role-based permissions
    roles = await rbac_service.get_user_roles(db, user_id)
    role_permissions = set()
    for role in roles:
        for perm in role.permissions:
            role_permissions.add(perm.name)
    
    # Get overrides
    overrides = [
        {
            "permission": o.permission.name if o.permission else None,
            "is_granted": o.is_granted,
            "expires_at": o.expires_at.isoformat() if o.expires_at else None,
            "reason": o.reason
        }
        for o in user.permission_overrides
    ]
    
    return UserPermissionsResponse(
        user_id=user_id,
        username=user.username,
        permissions=list(all_permissions),
        role_permissions=list(role_permissions),
        overrides=overrides
    )


@router.post("/users/{user_id}/permissions")
async def override_user_permission(
    user_id: int,
    data: UserPermissionOverride,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(can_update_users)
):
    """Grant or revoke a specific permission for a user."""
    try:
        if data.is_granted:
            await rbac_service.grant_permission(
                db, user_id, data.permission_name,
                current_user.id, data.expires_at, data.reason
            )
        else:
            await rbac_service.revoke_permission(
                db, user_id, data.permission_name,
                current_user.id, data.reason
            )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    
    action = "granted" if data.is_granted else "revoked"
    return {"message": f"Permission {action} successfully"}


# ==================== Current User Endpoints ====================

@router.get("/me/permissions")
async def get_my_permissions(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get permissions for the current user."""
    permissions = await rbac_service.get_user_permissions(db, current_user.id)
    return {"permissions": list(permissions)}


@router.get("/me/roles")
async def get_my_roles(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get roles for the current user."""
    roles = await rbac_service.get_user_roles(db, current_user.id)
    return {
        "roles": [
            {
                "id": r.id,
                "name": r.name,
                "display_name": r.display_name,
                "level": r.level,
                "color": r.color,
                "icon": r.icon
            }
            for r in roles
        ]
    }


@router.get("/me/check/{permission}")
async def check_my_permission(
    permission: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Check if current user has a specific permission."""
    has_perm = await rbac_service.has_permission(db, current_user.id, permission)
    return {"permission": permission, "granted": has_perm}


# ==================== Audit Log Endpoints ====================

@router.get("/audit", response_model=PaginatedAuditLogs)
async def get_audit_logs(
    user_id: Optional[int] = None,
    action: Optional[str] = None,
    target_type: Optional[str] = None,
    target_id: Optional[int] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(can_read_audit)
):
    """Get audit logs with filtering."""
    offset = (page - 1) * page_size
    
    logs, total = await rbac_service.get_audit_logs(
        db,
        user_id=user_id,
        action=action,
        target_type=target_type,
        target_id=target_id,
        limit=page_size,
        offset=offset
    )
    
    return PaginatedAuditLogs(
        items=[AuditLogResponse.model_validate(log) for log in logs],
        total=total,
        page=page,
        page_size=page_size
    )


# ==================== Initialization Endpoint ====================

@router.post("/initialize", status_code=status.HTTP_201_CREATED)
async def initialize_rbac(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("owner"))
):
    """Initialize default roles and permissions (owner only)."""
    await rbac_service.initialize_defaults(db)
    return {"message": "RBAC initialized successfully"}
