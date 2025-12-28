"""
Role-Based Access Control (RBAC) Service.

Provides permission checking, role management, and audit logging.
"""

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete, and_, or_
from sqlalchemy.orm import selectinload
from typing import List, Dict, Optional, Set, Tuple
from datetime import datetime, timedelta
from functools import lru_cache
import asyncio
import logging

from models.rbac import (
    Role, Permission, UserPermission, PermissionAuditLog,
    RoleLevel, AuditAction, role_permissions, user_roles,
    DEFAULT_PERMISSIONS, DEFAULT_ROLES, expand_wildcard_permissions
)
from models.user import User

logger = logging.getLogger(__name__)


class PermissionCache:
    """In-memory cache for permissions with TTL."""
    
    def __init__(self, ttl_seconds: int = 300):
        self._cache: Dict[int, Tuple[Set[str], datetime]] = {}
        self._ttl = timedelta(seconds=ttl_seconds)
        self._lock = asyncio.Lock()
    
    async def get(self, user_id: int) -> Optional[Set[str]]:
        """Get cached permissions for a user."""
        async with self._lock:
            if user_id in self._cache:
                permissions, cached_at = self._cache[user_id]
                if datetime.utcnow() - cached_at < self._ttl:
                    return permissions
                else:
                    del self._cache[user_id]
            return None
    
    async def set(self, user_id: int, permissions: Set[str]):
        """Cache permissions for a user."""
        async with self._lock:
            self._cache[user_id] = (permissions, datetime.utcnow())
    
    async def invalidate(self, user_id: int):
        """Invalidate cache for a user."""
        async with self._lock:
            self._cache.pop(user_id, None)
    
    async def invalidate_all(self):
        """Invalidate all cached permissions."""
        async with self._lock:
            self._cache.clear()


class RBACService:
    """Service for Role-Based Access Control operations."""
    
    def __init__(self):
        self.cache = PermissionCache(ttl_seconds=300)
    
    # ==================== Permission Checking ====================
    
    async def get_user_permissions(
        self,
        db: AsyncSession,
        user_id: int,
        use_cache: bool = True
    ) -> Set[str]:
        """
        Get all permissions for a user.
        
        Combines:
        - Permissions from all assigned roles
        - Individual permission overrides
        """
        # Check cache first
        if use_cache:
            cached = await self.cache.get(user_id)
            if cached is not None:
                return cached
        
        permissions = set()
        
        # Get user with roles and permissions
        result = await db.execute(
            select(User)
            .options(
                selectinload(User.roles).selectinload(Role.permissions),
                selectinload(User.permission_overrides).selectinload(UserPermission.permission)
            )
            .where(User.id == user_id)
        )
        user = result.scalar_one_or_none()
        
        if not user:
            return permissions
        
        # Collect permissions from all roles
        for role in user.roles:
            for perm in role.permissions:
                if perm.is_active:
                    permissions.add(perm.name)
        
        # Apply individual overrides
        for override in user.permission_overrides:
            if override.is_valid():
                if override.is_granted:
                    permissions.add(override.permission.name)
                else:
                    permissions.discard(override.permission.name)
        
        # Cache the result
        if use_cache:
            await self.cache.set(user_id, permissions)
        
        return permissions
    
    async def has_permission(
        self,
        db: AsyncSession,
        user_id: int,
        permission_name: str
    ) -> bool:
        """Check if a user has a specific permission."""
        permissions = await self.get_user_permissions(db, user_id)
        
        # Owner with system.all has all permissions
        if "system.all" in permissions:
            return True
        
        return permission_name in permissions
    
    async def has_any_permission(
        self,
        db: AsyncSession,
        user_id: int,
        permission_names: List[str]
    ) -> bool:
        """Check if a user has any of the specified permissions."""
        permissions = await self.get_user_permissions(db, user_id)
        
        if "system.all" in permissions:
            return True
        
        return any(p in permissions for p in permission_names)
    
    async def has_all_permissions(
        self,
        db: AsyncSession,
        user_id: int,
        permission_names: List[str]
    ) -> bool:
        """Check if a user has all of the specified permissions."""
        permissions = await self.get_user_permissions(db, user_id)
        
        if "system.all" in permissions:
            return True
        
        return all(p in permissions for p in permission_names)
    
    async def has_role(
        self,
        db: AsyncSession,
        user_id: int,
        role_name: str
    ) -> bool:
        """Check if a user has a specific role."""
        result = await db.execute(
            select(User)
            .options(selectinload(User.roles))
            .where(User.id == user_id)
        )
        user = result.scalar_one_or_none()
        
        if not user:
            return False
        
        return any(r.name == role_name for r in user.roles)
    
    async def has_role_level(
        self,
        db: AsyncSession,
        user_id: int,
        max_level: int
    ) -> bool:
        """Check if user has a role at or above the specified level."""
        result = await db.execute(
            select(User)
            .options(selectinload(User.roles))
            .where(User.id == user_id)
        )
        user = result.scalar_one_or_none()
        
        if not user or not user.roles:
            return False
        
        return any(r.level <= max_level for r in user.roles)
    
    # ==================== Role Management ====================
    
    async def get_all_roles(self, db: AsyncSession) -> List[Role]:
        """Get all roles."""
        result = await db.execute(
            select(Role)
            .options(selectinload(Role.permissions))
            .order_by(Role.level, Role.name)
        )
        return list(result.scalars().all())
    
    async def get_role(self, db: AsyncSession, role_id: int) -> Optional[Role]:
        """Get a role by ID."""
        result = await db.execute(
            select(Role)
            .options(selectinload(Role.permissions))
            .where(Role.id == role_id)
        )
        return result.scalar_one_or_none()
    
    async def get_role_by_name(self, db: AsyncSession, name: str) -> Optional[Role]:
        """Get a role by name."""
        result = await db.execute(
            select(Role)
            .options(selectinload(Role.permissions))
            .where(Role.name == name)
        )
        return result.scalar_one_or_none()
    
    async def create_role(
        self,
        db: AsyncSession,
        name: str,
        display_name: str,
        description: str = None,
        level: int = RoleLevel.USER,
        color: str = None,
        icon: str = None,
        permission_names: List[str] = None,
        created_by: int = None
    ) -> Role:
        """Create a new role."""
        role = Role(
            name=name,
            display_name=display_name,
            description=description,
            level=level,
            color=color,
            icon=icon,
            is_system=False
        )
        
        db.add(role)
        await db.flush()
        
        # Add permissions
        if permission_names:
            await self.set_role_permissions(db, role.id, permission_names, created_by)
        
        # Audit log
        await self._log_action(
            db, created_by, AuditAction.ROLE_CREATED,
            "role", role.id, role.name,
            new_value=role.to_dict()
        )
        
        await db.commit()
        await db.refresh(role)
        
        return role
    
    async def update_role(
        self,
        db: AsyncSession,
        role_id: int,
        updated_by: int,
        **kwargs
    ) -> Optional[Role]:
        """Update a role."""
        role = await self.get_role(db, role_id)
        if not role:
            return None
        
        # Don't allow modifying system roles' core properties
        if role.is_system and any(k in kwargs for k in ['name', 'level', 'is_system']):
            raise ValueError("Cannot modify core properties of system roles")
        
        old_value = role.to_dict()
        
        for key, value in kwargs.items():
            if hasattr(role, key):
                setattr(role, key, value)
        
        # Audit log
        await self._log_action(
            db, updated_by, AuditAction.ROLE_UPDATED,
            "role", role.id, role.name,
            old_value=old_value, new_value=role.to_dict()
        )
        
        await db.commit()
        await db.refresh(role)
        
        # Invalidate cache for all users with this role
        await self._invalidate_role_users_cache(db, role_id)
        
        return role
    
    async def delete_role(
        self,
        db: AsyncSession,
        role_id: int,
        deleted_by: int
    ) -> bool:
        """Delete a role (only non-system roles)."""
        role = await self.get_role(db, role_id)
        if not role:
            return False
        
        if role.is_system:
            raise ValueError("Cannot delete system roles")
        
        # Audit log
        await self._log_action(
            db, deleted_by, AuditAction.ROLE_DELETED,
            "role", role.id, role.name,
            old_value=role.to_dict()
        )
        
        # Invalidate cache for all users with this role
        await self._invalidate_role_users_cache(db, role_id)
        
        await db.delete(role)
        await db.commit()
        
        return True
    
    async def set_role_permissions(
        self,
        db: AsyncSession,
        role_id: int,
        permission_names: List[str],
        updated_by: int = None
    ):
        """Set permissions for a role (replaces existing)."""
        role = await self.get_role(db, role_id)
        if not role:
            raise ValueError(f"Role {role_id} not found")
        
        # Get permission objects
        result = await db.execute(
            select(Permission).where(Permission.name.in_(permission_names))
        )
        permissions = list(result.scalars().all())
        
        old_permissions = [p.name for p in role.permissions]
        role.permissions = permissions
        
        # Audit log
        await self._log_action(
            db, updated_by, AuditAction.PERMISSION_GRANTED,
            "role", role.id, role.name,
            old_value={"permissions": old_permissions},
            new_value={"permissions": permission_names}
        )
        
        await db.commit()
        
        # Invalidate cache
        await self._invalidate_role_users_cache(db, role_id)
    
    # ==================== User Role Assignment ====================
    
    async def get_user_roles(self, db: AsyncSession, user_id: int) -> List[Role]:
        """Get all roles for a user."""
        result = await db.execute(
            select(User)
            .options(selectinload(User.roles).selectinload(Role.permissions))
            .where(User.id == user_id)
        )
        user = result.scalar_one_or_none()
        return user.roles if user else []
    
    async def assign_role(
        self,
        db: AsyncSession,
        user_id: int,
        role_id: int,
        assigned_by: int = None,
        expires_at: datetime = None
    ) -> bool:
        """Assign a role to a user."""
        # Check if already assigned
        result = await db.execute(
            select(user_roles).where(
                and_(
                    user_roles.c.user_id == user_id,
                    user_roles.c.role_id == role_id
                )
            )
        )
        if result.first():
            return False  # Already assigned
        
        # Get role for audit
        role = await self.get_role(db, role_id)
        if not role:
            raise ValueError(f"Role {role_id} not found")
        
        # Insert assignment
        await db.execute(
            user_roles.insert().values(
                user_id=user_id,
                role_id=role_id,
                assigned_by=assigned_by,
                expires_at=expires_at
            )
        )
        
        # Audit log
        await self._log_action(
            db, assigned_by, AuditAction.USER_ROLE_ASSIGNED,
            "user", user_id, None,
            new_value={"role": role.name, "expires_at": expires_at.isoformat() if expires_at else None}
        )
        
        await db.commit()
        
        # Invalidate cache
        await self.cache.invalidate(user_id)
        
        return True
    
    async def remove_role(
        self,
        db: AsyncSession,
        user_id: int,
        role_id: int,
        removed_by: int = None
    ) -> bool:
        """Remove a role from a user."""
        # Get role for audit
        role = await self.get_role(db, role_id)
        if not role:
            return False
        
        result = await db.execute(
            delete(user_roles).where(
                and_(
                    user_roles.c.user_id == user_id,
                    user_roles.c.role_id == role_id
                )
            )
        )
        
        if result.rowcount == 0:
            return False
        
        # Audit log
        await self._log_action(
            db, removed_by, AuditAction.USER_ROLE_REMOVED,
            "user", user_id, None,
            old_value={"role": role.name}
        )
        
        await db.commit()
        
        # Invalidate cache
        await self.cache.invalidate(user_id)
        
        return True
    
    # ==================== User Permission Overrides ====================
    
    async def grant_permission(
        self,
        db: AsyncSession,
        user_id: int,
        permission_name: str,
        granted_by: int = None,
        expires_at: datetime = None,
        reason: str = None
    ) -> UserPermission:
        """Grant a specific permission to a user."""
        # Get permission
        result = await db.execute(
            select(Permission).where(Permission.name == permission_name)
        )
        permission = result.scalar_one_or_none()
        if not permission:
            raise ValueError(f"Permission {permission_name} not found")
        
        # Check for existing override
        result = await db.execute(
            select(UserPermission).where(
                and_(
                    UserPermission.user_id == user_id,
                    UserPermission.permission_id == permission.id
                )
            )
        )
        existing = result.scalar_one_or_none()
        
        if existing:
            existing.is_granted = True
            existing.granted_by = granted_by
            existing.expires_at = expires_at
            existing.reason = reason
            override = existing
        else:
            override = UserPermission(
                user_id=user_id,
                permission_id=permission.id,
                is_granted=True,
                granted_by=granted_by,
                expires_at=expires_at,
                reason=reason
            )
            db.add(override)
        
        # Audit log
        await self._log_action(
            db, granted_by, AuditAction.USER_PERMISSION_OVERRIDE,
            "user", user_id, None,
            new_value={"permission": permission_name, "granted": True, "reason": reason}
        )
        
        await db.commit()
        
        # Invalidate cache
        await self.cache.invalidate(user_id)
        
        return override
    
    async def revoke_permission(
        self,
        db: AsyncSession,
        user_id: int,
        permission_name: str,
        revoked_by: int = None,
        reason: str = None
    ) -> UserPermission:
        """Revoke a specific permission from a user."""
        # Get permission
        result = await db.execute(
            select(Permission).where(Permission.name == permission_name)
        )
        permission = result.scalar_one_or_none()
        if not permission:
            raise ValueError(f"Permission {permission_name} not found")
        
        # Check for existing override
        result = await db.execute(
            select(UserPermission).where(
                and_(
                    UserPermission.user_id == user_id,
                    UserPermission.permission_id == permission.id
                )
            )
        )
        existing = result.scalar_one_or_none()
        
        if existing:
            existing.is_granted = False
            existing.granted_by = revoked_by
            existing.reason = reason
            override = existing
        else:
            override = UserPermission(
                user_id=user_id,
                permission_id=permission.id,
                is_granted=False,
                granted_by=revoked_by,
                reason=reason
            )
            db.add(override)
        
        # Audit log
        await self._log_action(
            db, revoked_by, AuditAction.USER_PERMISSION_OVERRIDE,
            "user", user_id, None,
            new_value={"permission": permission_name, "granted": False, "reason": reason}
        )
        
        await db.commit()
        
        # Invalidate cache
        await self.cache.invalidate(user_id)
        
        return override
    
    # ==================== Permission Management ====================
    
    async def get_all_permissions(self, db: AsyncSession) -> List[Permission]:
        """Get all permissions."""
        result = await db.execute(
            select(Permission).order_by(Permission.category, Permission.name)
        )
        return list(result.scalars().all())
    
    async def get_permissions_by_category(
        self,
        db: AsyncSession,
        category: str
    ) -> List[Permission]:
        """Get permissions by category."""
        result = await db.execute(
            select(Permission)
            .where(Permission.category == category)
            .order_by(Permission.name)
        )
        return list(result.scalars().all())
    
    async def get_permission_categories(self, db: AsyncSession) -> List[str]:
        """Get all unique permission categories."""
        result = await db.execute(
            select(Permission.category).distinct().order_by(Permission.category)
        )
        return [row[0] for row in result.all()]
    
    # ==================== Audit Logging ====================
    
    async def _log_action(
        self,
        db: AsyncSession,
        user_id: int,
        action: AuditAction,
        target_type: str,
        target_id: int,
        target_name: str = None,
        old_value: dict = None,
        new_value: dict = None,
        ip_address: str = None,
        user_agent: str = None
    ):
        """Log an audit action."""
        log = PermissionAuditLog(
            user_id=user_id,
            action=action.value if isinstance(action, AuditAction) else action,
            target_type=target_type,
            target_id=target_id,
            target_name=target_name,
            old_value=old_value,
            new_value=new_value,
            ip_address=ip_address,
            user_agent=user_agent
        )
        db.add(log)
    
    async def get_audit_logs(
        self,
        db: AsyncSession,
        user_id: int = None,
        action: str = None,
        target_type: str = None,
        target_id: int = None,
        limit: int = 100,
        offset: int = 0
    ) -> Tuple[List[PermissionAuditLog], int]:
        """Get audit logs with filtering."""
        query = select(PermissionAuditLog)
        count_query = select(PermissionAuditLog)
        
        filters = []
        if user_id:
            filters.append(PermissionAuditLog.user_id == user_id)
        if action:
            filters.append(PermissionAuditLog.action == action)
        if target_type:
            filters.append(PermissionAuditLog.target_type == target_type)
        if target_id:
            filters.append(PermissionAuditLog.target_id == target_id)
        
        if filters:
            query = query.where(and_(*filters))
            count_query = count_query.where(and_(*filters))
        
        # Get total count
        from sqlalchemy import func
        count_result = await db.execute(
            select(func.count()).select_from(count_query.subquery())
        )
        total = count_result.scalar()
        
        # Get logs
        result = await db.execute(
            query.order_by(PermissionAuditLog.created_at.desc())
            .offset(offset)
            .limit(limit)
        )
        logs = list(result.scalars().all())
        
        return logs, total
    
    # ==================== Initialization ====================
    
    async def initialize_defaults(self, db: AsyncSession):
        """Initialize default permissions and roles."""
        logger.info("Initializing default permissions and roles...")
        
        # Create default permissions
        all_permission_names = []
        for perm_data in DEFAULT_PERMISSIONS:
            result = await db.execute(
                select(Permission).where(Permission.name == perm_data["name"])
            )
            if not result.scalar_one_or_none():
                permission = Permission(**perm_data)
                db.add(permission)
            all_permission_names.append(perm_data["name"])
        
        await db.flush()
        
        # Create default roles
        for role_data in DEFAULT_ROLES:
            result = await db.execute(
                select(Role).where(Role.name == role_data["name"])
            )
            existing_role = result.scalar_one_or_none()
            
            if not existing_role:
                # Expand wildcard permissions
                permission_patterns = role_data.pop("permissions", [])
                expanded_permissions = []
                for pattern in permission_patterns:
                    expanded_permissions.extend(
                        expand_wildcard_permissions(pattern, all_permission_names)
                    )
                
                role = Role(**role_data)
                db.add(role)
                await db.flush()
                
                # Assign permissions
                if expanded_permissions:
                    result = await db.execute(
                        select(Permission).where(Permission.name.in_(expanded_permissions))
                    )
                    permissions = list(result.scalars().all())
                    role.permissions = permissions
        
        await db.commit()
        logger.info("Default permissions and roles initialized successfully")
    
    # ==================== Helper Methods ====================
    
    async def _invalidate_role_users_cache(self, db: AsyncSession, role_id: int):
        """Invalidate cache for all users with a specific role."""
        result = await db.execute(
            select(user_roles.c.user_id).where(user_roles.c.role_id == role_id)
        )
        user_ids = [row[0] for row in result.all()]
        
        for user_id in user_ids:
            await self.cache.invalidate(user_id)


# Global service instance
rbac_service = RBACService()
