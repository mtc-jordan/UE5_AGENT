"""
Analytics API Endpoints

REST API for dashboard analytics and KPIs.

Version: 2.4.0
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional

from core.database import get_db
from services.auth import get_current_user
from services.analytics import AnalyticsService, get_analytics_service
from models.user import User


router = APIRouter(prefix="/analytics", tags=["analytics"])


# =============================================================================
# MIDDLEWARE - Admin Only Access
# =============================================================================

async def require_admin(current_user: User = Depends(get_current_user)) -> User:
    """Require admin role for analytics access."""
    # Check if user has admin role
    is_admin = False
    
    if hasattr(current_user, 'primary_role') and current_user.primary_role:
        role_name = current_user.primary_role.name.lower()
        is_admin = role_name in ['owner', 'admin']
    
    # Also check is_superuser flag
    if hasattr(current_user, 'is_superuser') and current_user.is_superuser:
        is_admin = True
    
    if not is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required for analytics"
        )
    
    return current_user


# =============================================================================
# OVERVIEW ENDPOINTS
# =============================================================================

@router.get("/overview")
async def get_overview(
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    """
    Get dashboard overview with key KPIs.
    
    Returns high-level metrics including:
    - User statistics (total, active, new)
    - Subscription metrics
    - Revenue summary
    - Engagement metrics
    """
    service = get_analytics_service(db)
    return await service.get_overview_kpis()


@router.get("/summary")
async def get_summary(
    days: int = Query(default=30, ge=1, le=365),
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    """
    Get comprehensive analytics summary.
    
    Combines user, revenue, and engagement analytics.
    """
    service = get_analytics_service(db)
    
    overview = await service.get_overview_kpis()
    users = await service.get_user_analytics(days)
    revenue = await service.get_revenue_analytics(days)
    engagement = await service.get_engagement_analytics(days)
    system = await service.get_system_analytics()
    
    return {
        "overview": overview,
        "users": users,
        "revenue": revenue,
        "engagement": engagement,
        "system": system,
        "period_days": days
    }


# =============================================================================
# USER ANALYTICS
# =============================================================================

@router.get("/users")
async def get_user_analytics(
    days: int = Query(default=30, ge=1, le=365),
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    """
    Get detailed user analytics.
    
    Returns:
    - Daily signups
    - Cumulative user growth
    - Users by subscription tier
    - Retention rate
    """
    service = get_analytics_service(db)
    return await service.get_user_analytics(days)


# =============================================================================
# REVENUE ANALYTICS
# =============================================================================

@router.get("/revenue")
async def get_revenue_analytics(
    days: int = Query(default=30, ge=1, le=365),
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    """
    Get detailed revenue analytics.
    
    Returns:
    - Daily revenue
    - Revenue by plan
    - MRR trend
    - Payment statistics
    - ARPU and LTV
    """
    service = get_analytics_service(db)
    return await service.get_revenue_analytics(days)


# =============================================================================
# ENGAGEMENT ANALYTICS
# =============================================================================

@router.get("/engagement")
async def get_engagement_analytics(
    days: int = Query(default=30, ge=1, le=365),
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    """
    Get engagement analytics.
    
    Returns:
    - Daily active users
    - Chat activity
    - Feature usage
    - Top users
    """
    service = get_analytics_service(db)
    return await service.get_engagement_analytics(days)


# =============================================================================
# SYSTEM ANALYTICS
# =============================================================================

@router.get("/system")
async def get_system_analytics(
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    """
    Get system-level analytics.
    
    Returns database statistics and system health metrics.
    """
    service = get_analytics_service(db)
    return await service.get_system_analytics()


# =============================================================================
# EXPORT ENDPOINTS
# =============================================================================

@router.get("/export/csv")
async def export_analytics_csv(
    report_type: str = Query(..., regex="^(users|revenue|engagement)$"),
    days: int = Query(default=30, ge=1, le=365),
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    """
    Export analytics data as CSV.
    
    Supported report types:
    - users: User growth and signups
    - revenue: Revenue and payments
    - engagement: Activity metrics
    """
    from fastapi.responses import StreamingResponse
    import csv
    import io
    
    service = get_analytics_service(db)
    
    if report_type == "users":
        data = await service.get_user_analytics(days)
        rows = data.get("daily_signups", [])
        headers = ["date", "count"]
    elif report_type == "revenue":
        data = await service.get_revenue_analytics(days)
        rows = data.get("daily_revenue", [])
        headers = ["date", "amount"]
    else:  # engagement
        data = await service.get_engagement_analytics(days)
        rows = data.get("daily_active_users", [])
        headers = ["date", "count"]
    
    # Create CSV
    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=headers)
    writer.writeheader()
    writer.writerows(rows)
    
    output.seek(0)
    
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={
            "Content-Disposition": f"attachment; filename={report_type}_report.csv"
        }
    )
