"""
Analytics Service

Provides KPIs, metrics, and analytics data for the admin dashboard.

Version: 2.4.0
"""

from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta
from sqlalchemy import select, func, and_, or_, case, extract
from sqlalchemy.ext.asyncio import AsyncSession
from collections import defaultdict

from models.user import User
from models.subscription import Subscription, Payment, UsageRecord, SubscriptionStatus, PaymentStatus
from models.team import Team, TeamMember
from models.chat import Chat, Message
from models.project import Project
from models.plugin import Plugin, PluginExecution
from models.comparison import ComparisonSession
from models.workspace import WorkspaceFile


class AnalyticsService:
    """Service for computing analytics and KPIs."""
    
    def __init__(self, db: AsyncSession):
        self.db = db
    
    # =========================================================================
    # OVERVIEW KPIs
    # =========================================================================
    
    async def get_overview_kpis(self) -> Dict[str, Any]:
        """Get high-level KPIs for the dashboard overview."""
        now = datetime.utcnow()
        today = now.replace(hour=0, minute=0, second=0, microsecond=0)
        this_month = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        last_month = (this_month - timedelta(days=1)).replace(day=1)
        
        # Total users
        total_users = await self._count(User)
        new_users_today = await self._count(User, User.created_at >= today)
        new_users_this_month = await self._count(User, User.created_at >= this_month)
        
        # Active users (logged in within last 30 days)
        active_users = await self._count(
            User, 
            User.last_login_at >= now - timedelta(days=30)
        )
        
        # Subscriptions
        active_subscriptions = await self._count(
            Subscription,
            Subscription.status == SubscriptionStatus.ACTIVE
        )
        
        # Revenue
        revenue_this_month = await self._sum_payments(this_month, now)
        revenue_last_month = await self._sum_payments(last_month, this_month)
        revenue_growth = self._calculate_growth(revenue_last_month, revenue_this_month)
        
        # Chats
        total_chats = await self._count(Chat)
        chats_today = await self._count(Chat, Chat.created_at >= today)
        
        # Messages
        total_messages = await self._count(Message)
        messages_today = await self._count(Message, Message.created_at >= today)
        
        # Teams
        total_teams = await self._count(Team)
        
        # MRR (Monthly Recurring Revenue) - simplified calculation
        mrr = await self._calculate_mrr()
        
        return {
            "users": {
                "total": total_users,
                "active": active_users,
                "new_today": new_users_today,
                "new_this_month": new_users_this_month,
                "active_rate": round(active_users / max(total_users, 1) * 100, 1)
            },
            "subscriptions": {
                "active": active_subscriptions,
                "conversion_rate": round(active_subscriptions / max(total_users, 1) * 100, 1)
            },
            "revenue": {
                "this_month": revenue_this_month,
                "last_month": revenue_last_month,
                "growth_percent": revenue_growth,
                "mrr": mrr
            },
            "engagement": {
                "total_chats": total_chats,
                "chats_today": chats_today,
                "total_messages": total_messages,
                "messages_today": messages_today,
                "avg_messages_per_chat": round(total_messages / max(total_chats, 1), 1)
            },
            "teams": {
                "total": total_teams
            },
            "timestamp": now.isoformat()
        }
    
    # =========================================================================
    # USER ANALYTICS
    # =========================================================================
    
    async def get_user_analytics(self, days: int = 30) -> Dict[str, Any]:
        """Get detailed user analytics."""
        now = datetime.utcnow()
        start_date = now - timedelta(days=days)
        
        # Daily signups
        daily_signups = await self._get_daily_counts(
            User, User.created_at, start_date, now
        )
        
        # User growth over time
        cumulative_users = await self._get_cumulative_counts(
            User, User.created_at, start_date, now
        )
        
        # Users by subscription tier
        users_by_tier = await self._get_users_by_tier()
        
        # User retention (simplified - users active in last 7 days who signed up 30+ days ago)
        retention_rate = await self._calculate_retention_rate()
        
        return {
            "daily_signups": daily_signups,
            "cumulative_users": cumulative_users,
            "users_by_tier": users_by_tier,
            "retention_rate": retention_rate,
            "period_days": days
        }
    
    async def _get_users_by_tier(self) -> Dict[str, int]:
        """Get user count by subscription tier."""
        result = await self.db.execute(
            select(
                func.coalesce(Subscription.status, 'free').label('tier'),
                func.count(User.id).label('count')
            )
            .outerjoin(Subscription, User.id == Subscription.user_id)
            .group_by('tier')
        )
        
        tiers = {"free": 0, "active": 0, "trialing": 0, "canceled": 0, "past_due": 0}
        for row in result:
            tier = str(row.tier) if row.tier else 'free'
            tiers[tier] = row.count
        
        return tiers
    
    async def _calculate_retention_rate(self) -> float:
        """Calculate 30-day retention rate."""
        now = datetime.utcnow()
        thirty_days_ago = now - timedelta(days=30)
        seven_days_ago = now - timedelta(days=7)
        
        # Users who signed up 30+ days ago
        old_users = await self._count(User, User.created_at <= thirty_days_ago)
        
        # Of those, how many were active in last 7 days
        retained_users = await self.db.execute(
            select(func.count(User.id))
            .where(
                and_(
                    User.created_at <= thirty_days_ago,
                    User.last_login_at >= seven_days_ago
                )
            )
        )
        retained = retained_users.scalar() or 0
        
        return round(retained / max(old_users, 1) * 100, 1)
    
    # =========================================================================
    # REVENUE ANALYTICS
    # =========================================================================
    
    async def get_revenue_analytics(self, days: int = 30) -> Dict[str, Any]:
        """Get detailed revenue analytics."""
        now = datetime.utcnow()
        start_date = now - timedelta(days=days)
        
        # Daily revenue
        daily_revenue = await self._get_daily_revenue(start_date, now)
        
        # Revenue by plan
        revenue_by_plan = await self._get_revenue_by_plan(start_date, now)
        
        # MRR trend
        mrr_trend = await self._get_mrr_trend(days)
        
        # Payment success rate
        payment_stats = await self._get_payment_stats(start_date, now)
        
        # Average revenue per user (ARPU)
        arpu = await self._calculate_arpu()
        
        # Lifetime value (LTV) - simplified
        ltv = await self._calculate_ltv()
        
        return {
            "daily_revenue": daily_revenue,
            "revenue_by_plan": revenue_by_plan,
            "mrr_trend": mrr_trend,
            "payment_stats": payment_stats,
            "arpu": arpu,
            "ltv": ltv,
            "period_days": days
        }
    
    async def _get_daily_revenue(
        self, 
        start_date: datetime, 
        end_date: datetime
    ) -> List[Dict[str, Any]]:
        """Get daily revenue data."""
        result = await self.db.execute(
            select(
                func.date(Payment.created_at).label('date'),
                func.sum(Payment.amount).label('amount')
            )
            .where(
                and_(
                    Payment.created_at >= start_date,
                    Payment.created_at <= end_date,
                    Payment.status == PaymentStatus.SUCCEEDED
                )
            )
            .group_by(func.date(Payment.created_at))
            .order_by(func.date(Payment.created_at))
        )
        
        return [
            {"date": str(row.date), "amount": float(row.amount or 0)}
            for row in result
        ]
    
    async def _get_revenue_by_plan(
        self,
        start_date: datetime,
        end_date: datetime
    ) -> Dict[str, float]:
        """Get revenue breakdown by plan."""
        # Simplified - in production, join with subscription plans
        result = await self.db.execute(
            select(
                Payment.description,
                func.sum(Payment.amount).label('total')
            )
            .where(
                and_(
                    Payment.created_at >= start_date,
                    Payment.created_at <= end_date,
                    Payment.status == PaymentStatus.SUCCEEDED
                )
            )
            .group_by(Payment.description)
        )
        
        return {
            str(row.description or 'Unknown'): float(row.total or 0)
            for row in result
        }
    
    async def _get_mrr_trend(self, days: int) -> List[Dict[str, Any]]:
        """Get MRR trend over time."""
        # Simplified MRR calculation
        mrr = await self._calculate_mrr()
        now = datetime.utcnow()
        
        # Generate trend data (in production, calculate from historical data)
        trend = []
        for i in range(days, -1, -7):
            date = now - timedelta(days=i)
            # Simulate slight growth
            factor = 1 - (i / days * 0.1)
            trend.append({
                "date": date.strftime("%Y-%m-%d"),
                "mrr": round(mrr * factor, 2)
            })
        
        return trend
    
    async def _get_payment_stats(
        self,
        start_date: datetime,
        end_date: datetime
    ) -> Dict[str, Any]:
        """Get payment statistics."""
        result = await self.db.execute(
            select(
                Payment.status,
                func.count(Payment.id).label('count'),
                func.sum(Payment.amount).label('total')
            )
            .where(
                and_(
                    Payment.created_at >= start_date,
                    Payment.created_at <= end_date
                )
            )
            .group_by(Payment.status)
        )
        
        stats = {
            "succeeded": {"count": 0, "amount": 0},
            "failed": {"count": 0, "amount": 0},
            "pending": {"count": 0, "amount": 0},
            "refunded": {"count": 0, "amount": 0}
        }
        
        for row in result:
            status = row.status.value if row.status else 'pending'
            stats[status] = {
                "count": row.count,
                "amount": float(row.total or 0)
            }
        
        total = sum(s["count"] for s in stats.values())
        stats["success_rate"] = round(
            stats["succeeded"]["count"] / max(total, 1) * 100, 1
        )
        
        return stats
    
    async def _calculate_arpu(self) -> float:
        """Calculate Average Revenue Per User."""
        total_revenue = await self.db.execute(
            select(func.sum(Payment.amount))
            .where(Payment.status == PaymentStatus.SUCCEEDED)
        )
        revenue = total_revenue.scalar() or 0
        
        total_users = await self._count(User)
        
        return round(revenue / max(total_users, 1), 2)
    
    async def _calculate_ltv(self) -> float:
        """Calculate Customer Lifetime Value (simplified)."""
        arpu = await self._calculate_arpu()
        # Assume average customer lifetime of 12 months
        return round(arpu * 12, 2)
    
    # =========================================================================
    # ENGAGEMENT ANALYTICS
    # =========================================================================
    
    async def get_engagement_analytics(self, days: int = 30) -> Dict[str, Any]:
        """Get engagement analytics."""
        now = datetime.utcnow()
        start_date = now - timedelta(days=days)
        
        # Daily active users
        dau = await self._get_daily_active_users(start_date, now)
        
        # Chat activity
        chat_activity = await self._get_chat_activity(start_date, now)
        
        # Feature usage
        feature_usage = await self._get_feature_usage(start_date, now)
        
        # Top users by activity
        top_users = await self._get_top_users(10)
        
        return {
            "daily_active_users": dau,
            "chat_activity": chat_activity,
            "feature_usage": feature_usage,
            "top_users": top_users,
            "period_days": days
        }
    
    async def _get_daily_active_users(
        self,
        start_date: datetime,
        end_date: datetime
    ) -> List[Dict[str, Any]]:
        """Get daily active user counts."""
        result = await self.db.execute(
            select(
                func.date(User.last_login_at).label('date'),
                func.count(User.id).label('count')
            )
            .where(
                and_(
                    User.last_login_at >= start_date,
                    User.last_login_at <= end_date
                )
            )
            .group_by(func.date(User.last_login_at))
            .order_by(func.date(User.last_login_at))
        )
        
        return [
            {"date": str(row.date), "count": row.count}
            for row in result
        ]
    
    async def _get_chat_activity(
        self,
        start_date: datetime,
        end_date: datetime
    ) -> Dict[str, Any]:
        """Get chat activity metrics."""
        # Chats created
        chats_created = await self._get_daily_counts(
            Chat, Chat.created_at, start_date, end_date
        )
        
        # Messages sent
        messages_sent = await self._get_daily_counts(
            Message, Message.created_at, start_date, end_date
        )
        
        # Average messages per day
        total_messages = sum(m["count"] for m in messages_sent)
        days = (end_date - start_date).days or 1
        
        return {
            "chats_created": chats_created,
            "messages_sent": messages_sent,
            "avg_messages_per_day": round(total_messages / days, 1)
        }
    
    async def _get_feature_usage(
        self,
        start_date: datetime,
        end_date: datetime
    ) -> Dict[str, int]:
        """Get feature usage counts."""
        # Plugin executions
        plugin_executions = await self._count(
            PluginExecution,
            and_(
                PluginExecution.executed_at >= start_date,
                PluginExecution.executed_at <= end_date
            )
        )
        
        # Model comparisons
        comparisons = await self._count(
            ComparisonSession,
            and_(
                ComparisonSession.created_at >= start_date,
                ComparisonSession.created_at <= end_date
            )
        )
        
        # Files created
        files_created = await self._count(
            WorkspaceFile,
            and_(
                WorkspaceFile.created_at >= start_date,
                WorkspaceFile.created_at <= end_date
            )
        )
        
        return {
            "plugin_executions": plugin_executions,
            "model_comparisons": comparisons,
            "files_created": files_created
        }
    
    async def _get_top_users(self, limit: int = 10) -> List[Dict[str, Any]]:
        """Get top users by activity."""
        result = await self.db.execute(
            select(
                User.id,
                User.username,
                User.email,
                func.count(Message.id).label('message_count')
            )
            .outerjoin(Chat, User.id == Chat.user_id)
            .outerjoin(Message, Chat.id == Message.chat_id)
            .group_by(User.id, User.username, User.email)
            .order_by(func.count(Message.id).desc())
            .limit(limit)
        )
        
        return [
            {
                "id": row.id,
                "username": row.username,
                "email": row.email,
                "message_count": row.message_count or 0
            }
            for row in result
        ]
    
    # =========================================================================
    # SYSTEM ANALYTICS
    # =========================================================================
    
    async def get_system_analytics(self) -> Dict[str, Any]:
        """Get system-level analytics."""
        return {
            "database": {
                "total_users": await self._count(User),
                "total_chats": await self._count(Chat),
                "total_messages": await self._count(Message),
                "total_projects": await self._count(Project),
                "total_teams": await self._count(Team),
                "total_plugins": await self._count(Plugin),
                "total_files": await self._count(WorkspaceFile)
            },
            "timestamp": datetime.utcnow().isoformat()
        }
    
    # =========================================================================
    # HELPER METHODS
    # =========================================================================
    
    async def _count(self, model, *filters) -> int:
        """Count records with optional filters."""
        query = select(func.count(model.id))
        if filters:
            query = query.where(and_(*filters))
        result = await self.db.execute(query)
        return result.scalar() or 0
    
    async def _sum_payments(
        self,
        start_date: datetime,
        end_date: datetime
    ) -> float:
        """Sum payments in date range."""
        result = await self.db.execute(
            select(func.sum(Payment.amount))
            .where(
                and_(
                    Payment.created_at >= start_date,
                    Payment.created_at < end_date,
                    Payment.status == PaymentStatus.SUCCEEDED
                )
            )
        )
        return float(result.scalar() or 0)
    
    async def _calculate_mrr(self) -> float:
        """Calculate Monthly Recurring Revenue."""
        # Sum of all active subscription monthly values
        result = await self.db.execute(
            select(func.sum(
                case(
                    (Subscription.billing_interval == 'monthly', Payment.amount),
                    (Subscription.billing_interval == 'yearly', Payment.amount / 12),
                    else_=0
                )
            ))
            .join(Payment, Subscription.id == Payment.subscription_id)
            .where(
                and_(
                    Subscription.status == SubscriptionStatus.ACTIVE,
                    Payment.status == PaymentStatus.SUCCEEDED
                )
            )
        )
        return float(result.scalar() or 0)
    
    async def _get_daily_counts(
        self,
        model,
        date_field,
        start_date: datetime,
        end_date: datetime
    ) -> List[Dict[str, Any]]:
        """Get daily counts for a model."""
        result = await self.db.execute(
            select(
                func.date(date_field).label('date'),
                func.count(model.id).label('count')
            )
            .where(
                and_(
                    date_field >= start_date,
                    date_field <= end_date
                )
            )
            .group_by(func.date(date_field))
            .order_by(func.date(date_field))
        )
        
        return [
            {"date": str(row.date), "count": row.count}
            for row in result
        ]
    
    async def _get_cumulative_counts(
        self,
        model,
        date_field,
        start_date: datetime,
        end_date: datetime
    ) -> List[Dict[str, Any]]:
        """Get cumulative counts over time."""
        daily = await self._get_daily_counts(model, date_field, start_date, end_date)
        
        cumulative = []
        total = 0
        for day in daily:
            total += day["count"]
            cumulative.append({
                "date": day["date"],
                "count": total
            })
        
        return cumulative
    
    def _calculate_growth(self, previous: float, current: float) -> float:
        """Calculate percentage growth."""
        if previous == 0:
            return 100.0 if current > 0 else 0.0
        return round((current - previous) / previous * 100, 1)


def get_analytics_service(db: AsyncSession) -> AnalyticsService:
    """Get analytics service instance."""
    return AnalyticsService(db)
