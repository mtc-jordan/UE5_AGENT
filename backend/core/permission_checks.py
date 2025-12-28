"""
Permission Checks Module.

Provides pre-built permission check dependencies for common operations.
These can be used directly in route definitions.

Version: 2.2.0
"""

from fastapi import Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from services.auth import get_current_user
from services.rbac import rbac_service
from models.user import User


# =============================================================================
# CHAT PERMISSIONS
# =============================================================================

async def can_create_chat(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> User:
    """Check if user can create chats."""
    if not await rbac_service.has_permission(db, current_user.id, "chat.create"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have permission to create chats"
        )
    return current_user


async def can_read_chats(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> User:
    """Check if user can read chats."""
    if not await rbac_service.has_permission(db, current_user.id, "chat.read"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have permission to view chats"
        )
    return current_user


async def can_delete_chats(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> User:
    """Check if user can delete chats."""
    if not await rbac_service.has_permission(db, current_user.id, "chat.delete"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have permission to delete chats"
        )
    return current_user


# =============================================================================
# PROJECT PERMISSIONS
# =============================================================================

async def can_create_project(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> User:
    """Check if user can create projects."""
    if not await rbac_service.has_permission(db, current_user.id, "project.create"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have permission to create projects"
        )
    return current_user


async def can_read_projects(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> User:
    """Check if user can read projects."""
    if not await rbac_service.has_permission(db, current_user.id, "project.read"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have permission to view projects"
        )
    return current_user


async def can_update_project(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> User:
    """Check if user can update projects."""
    if not await rbac_service.has_permission(db, current_user.id, "project.update"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have permission to update projects"
        )
    return current_user


async def can_delete_project(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> User:
    """Check if user can delete projects."""
    if not await rbac_service.has_permission(db, current_user.id, "project.delete"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have permission to delete projects"
        )
    return current_user


# =============================================================================
# WORKSPACE PERMISSIONS
# =============================================================================

async def can_create_files(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> User:
    """Check if user can create files."""
    if not await rbac_service.has_permission(db, current_user.id, "workspace.create"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have permission to create files"
        )
    return current_user


async def can_read_files(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> User:
    """Check if user can read files."""
    if not await rbac_service.has_permission(db, current_user.id, "workspace.read"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have permission to view files"
        )
    return current_user


async def can_update_files(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> User:
    """Check if user can update files."""
    if not await rbac_service.has_permission(db, current_user.id, "workspace.update"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have permission to update files"
        )
    return current_user


async def can_delete_files(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> User:
    """Check if user can delete files."""
    if not await rbac_service.has_permission(db, current_user.id, "workspace.delete"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have permission to delete files"
        )
    return current_user


async def can_upload_files(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> User:
    """Check if user can upload files."""
    if not await rbac_service.has_permission(db, current_user.id, "workspace.upload"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have permission to upload files"
        )
    return current_user


# =============================================================================
# PLUGIN PERMISSIONS
# =============================================================================

async def can_create_plugin(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> User:
    """Check if user can create plugins."""
    if not await rbac_service.has_permission(db, current_user.id, "plugin.create"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have permission to create plugins"
        )
    return current_user


async def can_execute_plugin(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> User:
    """Check if user can execute plugins."""
    if not await rbac_service.has_permission(db, current_user.id, "plugin.execute"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have permission to execute plugins"
        )
    return current_user


async def can_publish_plugin(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> User:
    """Check if user can publish plugins."""
    if not await rbac_service.has_permission(db, current_user.id, "plugin.publish"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have permission to publish plugins"
        )
    return current_user


# =============================================================================
# COMPARISON PERMISSIONS
# =============================================================================

async def can_create_comparison(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> User:
    """Check if user can create comparisons."""
    if not await rbac_service.has_permission(db, current_user.id, "comparison.create"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have permission to create comparisons"
        )
    return current_user


async def can_read_comparisons(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> User:
    """Check if user can read comparisons."""
    if not await rbac_service.has_permission(db, current_user.id, "comparison.read"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have permission to view comparisons"
        )
    return current_user


# =============================================================================
# MCP PERMISSIONS
# =============================================================================

async def can_connect_mcp(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> User:
    """Check if user can connect to MCP."""
    if not await rbac_service.has_permission(db, current_user.id, "mcp.connect"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have permission to connect to UE5"
        )
    return current_user


async def can_execute_mcp_tools(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> User:
    """Check if user can execute MCP tools."""
    if not await rbac_service.has_permission(db, current_user.id, "mcp.execute"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have permission to execute UE5 tools"
        )
    return current_user


# =============================================================================
# AGENT PERMISSIONS
# =============================================================================

async def can_create_agent(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> User:
    """Check if user can create agents."""
    if not await rbac_service.has_permission(db, current_user.id, "agent.create"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have permission to create agents"
        )
    return current_user


async def can_configure_agent(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> User:
    """Check if user can configure agents."""
    if not await rbac_service.has_permission(db, current_user.id, "agent.configure"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have permission to configure agents"
        )
    return current_user


# =============================================================================
# ADMIN PERMISSIONS
# =============================================================================

async def can_manage_users(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> User:
    """Check if user can manage users."""
    if not await rbac_service.has_permission(db, current_user.id, "admin.users"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have permission to manage users"
        )
    return current_user


async def can_manage_roles(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> User:
    """Check if user can manage roles."""
    if not await rbac_service.has_permission(db, current_user.id, "admin.roles"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have permission to manage roles"
        )
    return current_user


async def can_view_analytics(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> User:
    """Check if user can view analytics."""
    if not await rbac_service.has_permission(db, current_user.id, "admin.analytics"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have permission to view analytics"
        )
    return current_user


async def can_view_audit(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> User:
    """Check if user can view audit logs."""
    if not await rbac_service.has_permission(db, current_user.id, "admin.audit"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have permission to view audit logs"
        )
    return current_user


# =============================================================================
# SUBSCRIPTION PERMISSIONS
# =============================================================================

async def can_access_premium_models(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> User:
    """Check if user can access premium AI models."""
    if not await rbac_service.has_permission(db, current_user.id, "subscription.premium_models"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Premium models require a subscription upgrade"
        )
    return current_user


async def can_access_unlimited_usage(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> User:
    """Check if user has unlimited usage."""
    if not await rbac_service.has_permission(db, current_user.id, "subscription.unlimited"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Unlimited usage requires a subscription upgrade"
        )
    return current_user


async def can_access_priority_support(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> User:
    """Check if user has priority support."""
    if not await rbac_service.has_permission(db, current_user.id, "subscription.priority_support"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Priority support requires a subscription upgrade"
        )
    return current_user


# =============================================================================
# SYSTEM PERMISSIONS
# =============================================================================

async def is_system_admin(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> User:
    """Check if user is a system admin (has system.all permission)."""
    if not await rbac_service.has_permission(db, current_user.id, "system.all"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This action requires system administrator privileges"
        )
    return current_user
