"""
Permission Decorators and Middleware for FastAPI.

Provides decorators and dependencies for permission checking.
"""

from functools import wraps
from typing import List, Optional, Callable, Union
from fastapi import Depends, HTTPException, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
import logging

from core.database import get_db
from core.auth import get_current_user
from services.rbac import rbac_service
from models.user import User
from models.rbac import RoleLevel

logger = logging.getLogger(__name__)

security = HTTPBearer()


class PermissionDenied(HTTPException):
    """Exception raised when permission is denied."""
    
    def __init__(self, detail: str = "Permission denied"):
        super().__init__(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=detail
        )


class InsufficientRole(HTTPException):
    """Exception raised when user doesn't have required role level."""
    
    def __init__(self, detail: str = "Insufficient role level"):
        super().__init__(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=detail
        )


# ==================== Dependency Factories ====================

def require_permission(permission: str):
    """
    Dependency that requires a specific permission.
    
    Usage:
        @router.get("/items", dependencies=[Depends(require_permission("items.read"))])
        async def get_items():
            ...
    """
    async def permission_checker(
        request: Request,
        db: AsyncSession = Depends(get_db),
        current_user: User = Depends(get_current_user)
    ):
        has_perm = await rbac_service.has_permission(db, current_user.id, permission)
        if not has_perm:
            logger.warning(
                f"Permission denied: user {current_user.id} lacks '{permission}'"
            )
            # Log access denied
            from models.rbac import AuditAction
            await rbac_service._log_action(
                db, current_user.id, AuditAction.ACCESS_DENIED,
                "permission", 0, permission,
                new_value={"path": str(request.url.path), "method": request.method},
                ip_address=request.client.host if request.client else None
            )
            await db.commit()
            raise PermissionDenied(f"Missing permission: {permission}")
        return current_user
    
    return permission_checker


def require_any_permission(permissions: List[str]):
    """
    Dependency that requires any of the specified permissions.
    
    Usage:
        @router.get("/items", dependencies=[Depends(require_any_permission(["items.read", "items.admin"]))])
        async def get_items():
            ...
    """
    async def permission_checker(
        request: Request,
        db: AsyncSession = Depends(get_db),
        current_user: User = Depends(get_current_user)
    ):
        has_perm = await rbac_service.has_any_permission(db, current_user.id, permissions)
        if not has_perm:
            logger.warning(
                f"Permission denied: user {current_user.id} lacks any of {permissions}"
            )
            raise PermissionDenied(f"Missing permissions: {', '.join(permissions)}")
        return current_user
    
    return permission_checker


def require_all_permissions(permissions: List[str]):
    """
    Dependency that requires all of the specified permissions.
    
    Usage:
        @router.post("/items", dependencies=[Depends(require_all_permissions(["items.create", "items.publish"]))])
        async def create_item():
            ...
    """
    async def permission_checker(
        request: Request,
        db: AsyncSession = Depends(get_db),
        current_user: User = Depends(get_current_user)
    ):
        has_perm = await rbac_service.has_all_permissions(db, current_user.id, permissions)
        if not has_perm:
            logger.warning(
                f"Permission denied: user {current_user.id} lacks all of {permissions}"
            )
            raise PermissionDenied(f"Missing permissions: {', '.join(permissions)}")
        return current_user
    
    return permission_checker


def require_role(role_name: str):
    """
    Dependency that requires a specific role.
    
    Usage:
        @router.get("/admin", dependencies=[Depends(require_role("admin"))])
        async def admin_panel():
            ...
    """
    async def role_checker(
        db: AsyncSession = Depends(get_db),
        current_user: User = Depends(get_current_user)
    ):
        has_role = await rbac_service.has_role(db, current_user.id, role_name)
        if not has_role:
            logger.warning(
                f"Role denied: user {current_user.id} lacks role '{role_name}'"
            )
            raise InsufficientRole(f"Required role: {role_name}")
        return current_user
    
    return role_checker


def require_any_role(role_names: List[str]):
    """
    Dependency that requires any of the specified roles.
    
    Usage:
        @router.get("/manage", dependencies=[Depends(require_any_role(["admin", "manager"]))])
        async def manage():
            ...
    """
    async def role_checker(
        db: AsyncSession = Depends(get_db),
        current_user: User = Depends(get_current_user)
    ):
        for role_name in role_names:
            if await rbac_service.has_role(db, current_user.id, role_name):
                return current_user
        
        logger.warning(
            f"Role denied: user {current_user.id} lacks any of {role_names}"
        )
        raise InsufficientRole(f"Required roles: {', '.join(role_names)}")
    
    return role_checker


def require_role_level(max_level: int):
    """
    Dependency that requires a role at or above a certain level.
    
    Usage:
        @router.get("/admin", dependencies=[Depends(require_role_level(RoleLevel.ADMIN))])
        async def admin_panel():
            ...
    """
    async def level_checker(
        db: AsyncSession = Depends(get_db),
        current_user: User = Depends(get_current_user)
    ):
        has_level = await rbac_service.has_role_level(db, current_user.id, max_level)
        if not has_level:
            logger.warning(
                f"Level denied: user {current_user.id} lacks role level {max_level}"
            )
            raise InsufficientRole(f"Required role level: {max_level}")
        return current_user
    
    return level_checker


# ==================== Permission Checker Class ====================

class PermissionChecker:
    """
    Reusable permission checker that can be used as a dependency.
    
    Usage:
        items_read = PermissionChecker("items.read")
        
        @router.get("/items")
        async def get_items(user: User = Depends(items_read)):
            ...
    """
    
    def __init__(
        self,
        permission: Optional[str] = None,
        permissions: Optional[List[str]] = None,
        require_all: bool = False,
        role: Optional[str] = None,
        roles: Optional[List[str]] = None,
        min_level: Optional[int] = None
    ):
        self.permission = permission
        self.permissions = permissions or []
        self.require_all = require_all
        self.role = role
        self.roles = roles or []
        self.min_level = min_level
    
    async def __call__(
        self,
        request: Request,
        db: AsyncSession = Depends(get_db),
        current_user: User = Depends(get_current_user)
    ) -> User:
        # Check role level first
        if self.min_level is not None:
            has_level = await rbac_service.has_role_level(db, current_user.id, self.min_level)
            if not has_level:
                raise InsufficientRole(f"Required role level: {self.min_level}")
        
        # Check specific role
        if self.role:
            has_role = await rbac_service.has_role(db, current_user.id, self.role)
            if not has_role:
                raise InsufficientRole(f"Required role: {self.role}")
        
        # Check any of roles
        if self.roles:
            has_any = False
            for role_name in self.roles:
                if await rbac_service.has_role(db, current_user.id, role_name):
                    has_any = True
                    break
            if not has_any:
                raise InsufficientRole(f"Required roles: {', '.join(self.roles)}")
        
        # Check single permission
        if self.permission:
            has_perm = await rbac_service.has_permission(db, current_user.id, self.permission)
            if not has_perm:
                raise PermissionDenied(f"Missing permission: {self.permission}")
        
        # Check multiple permissions
        if self.permissions:
            if self.require_all:
                has_perm = await rbac_service.has_all_permissions(
                    db, current_user.id, self.permissions
                )
            else:
                has_perm = await rbac_service.has_any_permission(
                    db, current_user.id, self.permissions
                )
            
            if not has_perm:
                raise PermissionDenied(f"Missing permissions: {', '.join(self.permissions)}")
        
        return current_user


# ==================== Decorator Factories ====================

def permission_required(permission: str):
    """
    Decorator that requires a specific permission.
    
    Usage:
        @permission_required("items.read")
        async def get_items(db: AsyncSession, current_user: User):
            ...
    """
    def decorator(func: Callable):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Extract db and current_user from kwargs
            db = kwargs.get('db')
            current_user = kwargs.get('current_user')
            
            if not db or not current_user:
                raise ValueError("Function must have 'db' and 'current_user' parameters")
            
            has_perm = await rbac_service.has_permission(db, current_user.id, permission)
            if not has_perm:
                raise PermissionDenied(f"Missing permission: {permission}")
            
            return await func(*args, **kwargs)
        return wrapper
    return decorator


def role_required(role_name: str):
    """
    Decorator that requires a specific role.
    
    Usage:
        @role_required("admin")
        async def admin_action(db: AsyncSession, current_user: User):
            ...
    """
    def decorator(func: Callable):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            db = kwargs.get('db')
            current_user = kwargs.get('current_user')
            
            if not db or not current_user:
                raise ValueError("Function must have 'db' and 'current_user' parameters")
            
            has_role = await rbac_service.has_role(db, current_user.id, role_name)
            if not has_role:
                raise InsufficientRole(f"Required role: {role_name}")
            
            return await func(*args, **kwargs)
        return wrapper
    return decorator


# ==================== Helper Functions ====================

async def get_user_permissions(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> List[str]:
    """Get all permissions for the current user."""
    permissions = await rbac_service.get_user_permissions(db, current_user.id)
    return list(permissions)


async def get_user_roles(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> List[dict]:
    """Get all roles for the current user."""
    roles = await rbac_service.get_user_roles(db, current_user.id)
    return [r.to_dict() for r in roles]


# ==================== Common Permission Checkers ====================

# Chat permissions
can_create_chat = PermissionChecker(permission="chat.create")
can_read_chat = PermissionChecker(permission="chat.read")
can_update_chat = PermissionChecker(permission="chat.update")
can_delete_chat = PermissionChecker(permission="chat.delete")
can_share_chat = PermissionChecker(permission="chat.share")

# Project permissions
can_create_project = PermissionChecker(permission="project.create")
can_read_project = PermissionChecker(permission="project.read")
can_update_project = PermissionChecker(permission="project.update")
can_delete_project = PermissionChecker(permission="project.delete")
can_manage_project_members = PermissionChecker(permission="project.manage_members")

# Workspace permissions
can_create_file = PermissionChecker(permission="workspace.create")
can_read_file = PermissionChecker(permission="workspace.read")
can_update_file = PermissionChecker(permission="workspace.update")
can_delete_file = PermissionChecker(permission="workspace.delete")
can_upload_file = PermissionChecker(permission="workspace.upload")
can_download_file = PermissionChecker(permission="workspace.download")

# Plugin permissions
can_create_plugin = PermissionChecker(permission="plugin.create")
can_read_plugin = PermissionChecker(permission="plugin.read")
can_execute_plugin = PermissionChecker(permission="plugin.execute")
can_publish_plugin = PermissionChecker(permission="plugin.publish")
can_manage_plugins = PermissionChecker(permission="plugin.manage")

# MCP permissions
can_connect_mcp = PermissionChecker(permission="mcp.connect")
can_execute_mcp = PermissionChecker(permission="mcp.execute")
can_manage_mcp = PermissionChecker(permission="mcp.manage")

# Admin permissions
can_read_users = PermissionChecker(permission="admin.users.read")
can_create_users = PermissionChecker(permission="admin.users.create")
can_update_users = PermissionChecker(permission="admin.users.update")
can_delete_users = PermissionChecker(permission="admin.users.delete")
can_manage_roles = PermissionChecker(permission="admin.roles.manage")
can_read_audit = PermissionChecker(permission="admin.audit.read")

# Role-based checkers
is_admin = PermissionChecker(role="admin")
is_manager = PermissionChecker(roles=["admin", "manager"])
is_developer = PermissionChecker(roles=["admin", "manager", "developer"])
is_owner = PermissionChecker(role="owner")
