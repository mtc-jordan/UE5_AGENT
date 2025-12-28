"""
Rate Limit API Endpoints

REST API for viewing and managing rate limits.

Version: 2.3.0
"""

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from typing import Dict, Any, Optional

from services.auth import get_current_user
from services.rate_limiter import (
    rate_limiter, 
    RateLimitConfig,
    DEFAULT_RATE_LIMITS,
    TIER_MULTIPLIERS
)
from models.user import User


router = APIRouter(prefix="/rate-limits", tags=["rate-limits"])


# =============================================================================
# SCHEMAS
# =============================================================================

class CustomLimitCreate(BaseModel):
    role: str
    category: str
    requests: int
    window_seconds: int
    burst_multiplier: float = 1.5


# =============================================================================
# ENDPOINTS
# =============================================================================

@router.get("/usage")
async def get_my_usage(
    current_user: User = Depends(get_current_user)
):
    """Get current rate limit usage for the authenticated user."""
    # Get user's role and tier
    role = "user"  # Default, should come from RBAC
    tier = "free"  # Default, should come from subscription
    
    # Try to get from user attributes
    if hasattr(current_user, 'primary_role') and current_user.primary_role:
        role = current_user.primary_role.name.lower()
    
    if hasattr(current_user, 'subscription') and current_user.subscription:
        tier = current_user.subscription.plan.tier.value
    
    usage = await rate_limiter.get_usage(current_user.id, role, tier)
    
    return {
        "user_id": current_user.id,
        "role": role,
        "tier": tier,
        "usage": usage
    }


@router.get("/limits")
async def get_rate_limits():
    """Get all rate limit configurations."""
    return {
        "role_limits": {
            role: {
                category: {
                    "requests": config.requests,
                    "window_seconds": config.window_seconds,
                    "burst_limit": config.burst_limit
                }
                for category, config in categories.items()
            }
            for role, categories in DEFAULT_RATE_LIMITS.items()
        },
        "tier_multipliers": TIER_MULTIPLIERS
    }


@router.get("/limits/{role}")
async def get_role_limits(role: str):
    """Get rate limits for a specific role."""
    if role not in DEFAULT_RATE_LIMITS:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Role '{role}' not found"
        )
    
    return {
        "role": role,
        "limits": {
            category: {
                "requests": config.requests,
                "window_seconds": config.window_seconds,
                "burst_limit": config.burst_limit
            }
            for category, config in DEFAULT_RATE_LIMITS[role].items()
        }
    }


@router.post("/custom")
async def set_custom_limit(
    data: CustomLimitCreate,
    current_user: User = Depends(get_current_user)
):
    """Set a custom rate limit (admin only)."""
    # Check if user is admin
    is_admin = False
    if hasattr(current_user, 'primary_role') and current_user.primary_role:
        is_admin = current_user.primary_role.name.lower() in ['owner', 'admin']
    
    if not is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can set custom rate limits"
        )
    
    config = RateLimitConfig(
        requests=data.requests,
        window_seconds=data.window_seconds,
        burst_multiplier=data.burst_multiplier
    )
    
    rate_limiter.set_custom_limit(data.role, data.category, config)
    
    return {
        "message": "Custom rate limit set",
        "role": data.role,
        "category": data.category,
        "config": {
            "requests": config.requests,
            "window_seconds": config.window_seconds,
            "burst_limit": config.burst_limit
        }
    }


@router.post("/reset")
async def reset_my_limits(
    current_user: User = Depends(get_current_user)
):
    """Reset rate limits for the current user (for testing)."""
    await rate_limiter.reset_user_limits(current_user.id)
    return {"message": "Rate limits reset"}


@router.post("/reset/{user_id}")
async def reset_user_limits(
    user_id: int,
    current_user: User = Depends(get_current_user)
):
    """Reset rate limits for a specific user (admin only)."""
    # Check if user is admin
    is_admin = False
    if hasattr(current_user, 'primary_role') and current_user.primary_role:
        is_admin = current_user.primary_role.name.lower() in ['owner', 'admin']
    
    if not is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can reset other users' rate limits"
        )
    
    await rate_limiter.reset_user_limits(user_id)
    return {"message": f"Rate limits reset for user {user_id}"}


@router.post("/cleanup")
async def cleanup_expired(
    current_user: User = Depends(get_current_user)
):
    """Cleanup expired rate limit counters (admin only)."""
    # Check if user is admin
    is_admin = False
    if hasattr(current_user, 'primary_role') and current_user.primary_role:
        is_admin = current_user.primary_role.name.lower() in ['owner', 'admin']
    
    if not is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can trigger cleanup"
        )
    
    await rate_limiter.cleanup_expired()
    return {"message": "Expired counters cleaned up"}
