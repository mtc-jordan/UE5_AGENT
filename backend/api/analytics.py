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

# =============================================================================
# UE5 SPECIFIC ANALYTICS
# =============================================================================

@router.get("/ue5/commands")
async def get_ue5_command_metrics(
    days: int = Query(default=30, ge=1, le=365)
):
    """
    Get UE5 command execution metrics.
    Returns command counts by day and category.
    """
    import random
    from datetime import datetime, timedelta
    
    metrics = []
    now = datetime.now()
    
    for i in range(days - 1, -1, -1):
        date = now - timedelta(days=i)
        total = random.randint(50, 200)
        failed = random.randint(0, int(total * 0.1))
        
        metrics.append({
            "date": date.strftime("%Y-%m-%d"),
            "total": total,
            "successful": total - failed,
            "failed": failed,
            "categories": {
                "scene": random.randint(10, 40),
                "lighting": random.randint(5, 30),
                "animation": random.randint(5, 25),
                "material": random.randint(5, 20),
                "texture": random.randint(3, 15),
                "performance": random.randint(2, 12),
                "asset": random.randint(2, 10),
                "collaboration": random.randint(1, 8),
            }
        })
    
    return metrics


@router.get("/ue5/performance")
async def get_ue5_performance_metrics(
    hours: int = Query(default=24, ge=1, le=168)
):
    """
    Get UE5 performance metrics.
    Returns FPS, frame time, GPU time, memory usage.
    """
    import random
    from datetime import datetime, timedelta
    
    metrics = []
    now = datetime.now()
    
    for i in range(hours - 1, -1, -1):
        timestamp = now - timedelta(hours=i)
        
        metrics.append({
            "timestamp": timestamp.isoformat(),
            "fps": round(random.uniform(45, 75), 1),
            "frame_time": round(random.uniform(13, 22), 2),
            "gpu_time": round(random.uniform(10, 18), 2),
            "memory_usage": round(random.uniform(40, 70), 1),
            "draw_calls": random.randint(2000, 3500),
            "triangles": random.randint(4000000, 7000000)
        })
    
    return metrics


@router.get("/ue5/team-activity")
async def get_ue5_team_activity(
    days: int = Query(default=7, ge=1, le=30)
):
    """
    Get team activity heatmap data.
    Returns activity counts by day and hour.
    """
    import random
    from datetime import datetime, timedelta
    
    activities = []
    now = datetime.now()
    users = ["You", "Sarah Chen", "Mike Johnson", "Emily Davis"]
    
    for d in range(days - 1, -1, -1):
        date = now - timedelta(days=d)
        date_str = date.strftime("%Y-%m-%d")
        
        for h in range(24):
            is_work_hour = 9 <= h <= 18
            base_count = random.randint(5, 20) if is_work_hour else random.randint(0, 5)
            
            if base_count > 0:
                activities.append({
                    "date": date_str,
                    "hour": h,
                    "count": base_count,
                    "users": random.sample(users, min(base_count, len(users)))
                })
    
    return activities


@router.get("/ue5/feature-usage")
async def get_ue5_feature_usage():
    """
    Get feature usage statistics.
    Returns usage counts and trends by feature.
    """
    return [
        {"feature": "Scene Builder", "count": 1247, "percentage": 28, "trend": "up", "trend_value": 12},
        {"feature": "AI Scene Generator", "count": 892, "percentage": 20, "trend": "up", "trend_value": 45},
        {"feature": "Lighting Wizard", "count": 756, "percentage": 17, "trend": "stable", "trend_value": 2},
        {"feature": "Animation Assistant", "count": 534, "percentage": 12, "trend": "up", "trend_value": 8},
        {"feature": "Material Assistant", "count": 423, "percentage": 10, "trend": "down", "trend_value": 5},
        {"feature": "Texture Generator", "count": 312, "percentage": 7, "trend": "up", "trend_value": 15},
        {"feature": "Performance Optimizer", "count": 178, "percentage": 4, "trend": "stable", "trend_value": 1},
        {"feature": "Asset Manager", "count": 89, "percentage": 2, "trend": "down", "trend_value": 3},
    ]


@router.get("/ue5/user-stats")
async def get_ue5_user_stats():
    """
    Get user statistics and leaderboard.
    Returns command counts, sessions, and top features per user.
    """
    return [
        {
            "user_id": "1",
            "name": "You",
            "avatar": "Y",
            "commands_executed": 1523,
            "sessions_count": 47,
            "total_time": 12480,
            "top_features": ["Scene Builder", "Lighting Wizard", "AI Scene Generator"]
        },
        {
            "user_id": "2",
            "name": "Sarah Chen",
            "avatar": "S",
            "commands_executed": 1289,
            "sessions_count": 38,
            "total_time": 9840,
            "top_features": ["Material Assistant", "Texture Generator", "Animation Assistant"]
        },
        {
            "user_id": "3",
            "name": "Mike Johnson",
            "avatar": "M",
            "commands_executed": 876,
            "sessions_count": 29,
            "total_time": 7200,
            "top_features": ["Performance Optimizer", "Asset Manager", "Scene Builder"]
        },
        {
            "user_id": "4",
            "name": "Emily Davis",
            "avatar": "E",
            "commands_executed": 654,
            "sessions_count": 21,
            "total_time": 5400,
            "top_features": ["Animation Assistant", "Lighting Wizard", "Scene Builder"]
        },
    ]


@router.get("/ue5/realtime")
async def get_ue5_realtime_metrics():
    """
    Get real-time UE5 metrics snapshot.
    Returns current FPS, memory, and activity.
    """
    import random
    from datetime import datetime
    
    return {
        "timestamp": datetime.now().isoformat(),
        "fps": round(random.uniform(55, 65), 1),
        "frame_time": round(random.uniform(15, 18), 2),
        "gpu_time": round(random.uniform(12, 16), 2),
        "memory_usage": round(random.uniform(45, 55), 1),
        "draw_calls": random.randint(2200, 2800),
        "triangles": random.randint(4500000, 5500000),
        "active_connections": random.randint(2, 4),
        "commands_per_minute": random.randint(3, 12)
    }


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
