"""
Subscription Management Service.

Handles subscription lifecycle, usage tracking, and feature access.

Version: 2.3.0
"""

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete, and_, or_, func
from sqlalchemy.orm import selectinload
from typing import Optional, Dict, Any, List, Tuple
from datetime import datetime, timedelta
import logging

from models.subscription import (
    Subscription, SubscriptionPlan, Payment, Invoice, UsageRecord,
    SubscriptionStatus, PaymentStatus, BillingInterval, SubscriptionTier,
    DEFAULT_PLANS
)
from models.user import User
from services.stripe_service import stripe_service

logger = logging.getLogger(__name__)


class SubscriptionService:
    """
    Service for subscription management.
    
    Handles:
    - Plan management
    - Subscription lifecycle
    - Usage tracking and limits
    - Feature access control
    """
    
    # =========================================================================
    # PLAN MANAGEMENT
    # =========================================================================
    
    async def get_plans(
        self,
        db: AsyncSession,
        active_only: bool = True
    ) -> List[SubscriptionPlan]:
        """Get all subscription plans."""
        query = select(SubscriptionPlan).order_by(SubscriptionPlan.sort_order)
        
        if active_only:
            query = query.where(SubscriptionPlan.is_active == True)
        
        result = await db.execute(query)
        return list(result.scalars().all())
    
    async def get_plan(
        self,
        db: AsyncSession,
        plan_id: int
    ) -> Optional[SubscriptionPlan]:
        """Get a specific plan by ID."""
        result = await db.execute(
            select(SubscriptionPlan)
            .where(SubscriptionPlan.id == plan_id)
        )
        return result.scalar_one_or_none()
    
    async def get_plan_by_name(
        self,
        db: AsyncSession,
        name: str
    ) -> Optional[SubscriptionPlan]:
        """Get a plan by name."""
        result = await db.execute(
            select(SubscriptionPlan)
            .where(SubscriptionPlan.name == name)
        )
        return result.scalar_one_or_none()
    
    async def get_plan_by_tier(
        self,
        db: AsyncSession,
        tier: SubscriptionTier
    ) -> Optional[SubscriptionPlan]:
        """Get a plan by tier."""
        result = await db.execute(
            select(SubscriptionPlan)
            .where(SubscriptionPlan.tier == tier)
            .where(SubscriptionPlan.is_active == True)
        )
        return result.scalar_one_or_none()
    
    async def initialize_default_plans(self, db: AsyncSession) -> int:
        """
        Initialize default subscription plans.
        
        Returns the number of plans created.
        """
        created = 0
        
        for plan_data in DEFAULT_PLANS:
            existing = await self.get_plan_by_name(db, plan_data["name"])
            
            if not existing:
                plan = SubscriptionPlan(
                    name=plan_data["name"],
                    tier=plan_data["tier"],
                    display_name=plan_data["display_name"],
                    description=plan_data.get("description"),
                    price_monthly=plan_data.get("price_monthly", 0),
                    price_yearly=plan_data.get("price_yearly", 0),
                    limits=plan_data.get("limits", {}),
                    features=plan_data.get("features", {}),
                    trial_days=plan_data.get("trial_days", 0),
                    sort_order=plan_data.get("sort_order", 0),
                    is_featured=plan_data.get("is_featured", False)
                )
                db.add(plan)
                created += 1
        
        if created > 0:
            await db.commit()
            logger.info(f"Created {created} default subscription plans")
        
        return created
    
    # =========================================================================
    # SUBSCRIPTION MANAGEMENT
    # =========================================================================
    
    async def get_user_subscription(
        self,
        db: AsyncSession,
        user_id: int
    ) -> Optional[Subscription]:
        """Get user's active subscription."""
        result = await db.execute(
            select(Subscription)
            .options(selectinload(Subscription.plan))
            .where(Subscription.user_id == user_id)
            .where(Subscription.status.in_([
                SubscriptionStatus.ACTIVE,
                SubscriptionStatus.TRIALING,
                SubscriptionStatus.PAST_DUE
            ]))
            .order_by(Subscription.created_at.desc())
        )
        return result.scalar_one_or_none()
    
    async def get_or_create_free_subscription(
        self,
        db: AsyncSession,
        user: User
    ) -> Subscription:
        """
        Get user's subscription or create a free one.
        
        Ensures every user has at least a free subscription.
        """
        subscription = await self.get_user_subscription(db, user.id)
        
        if subscription:
            return subscription
        
        # Get free plan
        free_plan = await self.get_plan_by_tier(db, SubscriptionTier.FREE)
        
        if not free_plan:
            # Initialize plans if not exists
            await self.initialize_default_plans(db)
            free_plan = await self.get_plan_by_tier(db, SubscriptionTier.FREE)
        
        # Create free subscription
        subscription = Subscription(
            user_id=user.id,
            plan_id=free_plan.id,
            status=SubscriptionStatus.ACTIVE,
            billing_interval=BillingInterval.MONTHLY,
            current_period_start=datetime.utcnow(),
            current_period_end=datetime.utcnow() + timedelta(days=36500)  # ~100 years
        )
        
        db.add(subscription)
        await db.commit()
        await db.refresh(subscription)
        
        logger.info(f"Created free subscription for user {user.id}")
        return subscription
    
    async def subscribe(
        self,
        db: AsyncSession,
        user: User,
        plan_id: int,
        billing_interval: BillingInterval = BillingInterval.MONTHLY,
        payment_method_id: Optional[str] = None
    ) -> Tuple[Optional[Subscription], Optional[str]]:
        """
        Subscribe user to a plan.
        
        Returns (Subscription, client_secret) tuple.
        """
        plan = await self.get_plan(db, plan_id)
        if not plan:
            raise ValueError("Plan not found")
        
        # Cancel existing subscription if any
        existing = await self.get_user_subscription(db, user.id)
        if existing and existing.plan_id != plan_id:
            await stripe_service.cancel_subscription(db, existing, immediately=True)
        
        # Create new subscription
        return await stripe_service.create_subscription(
            db, user, plan, billing_interval, payment_method_id
        )
    
    async def cancel_subscription(
        self,
        db: AsyncSession,
        user_id: int,
        immediately: bool = False
    ) -> bool:
        """Cancel user's subscription."""
        subscription = await self.get_user_subscription(db, user_id)
        
        if not subscription:
            return False
        
        return await stripe_service.cancel_subscription(db, subscription, immediately)
    
    async def reactivate_subscription(
        self,
        db: AsyncSession,
        user_id: int
    ) -> bool:
        """Reactivate a canceled subscription."""
        subscription = await self.get_user_subscription(db, user_id)
        
        if not subscription or not subscription.cancel_at_period_end:
            return False
        
        return await stripe_service.reactivate_subscription(db, subscription)
    
    async def change_plan(
        self,
        db: AsyncSession,
        user_id: int,
        new_plan_id: int,
        billing_interval: Optional[BillingInterval] = None
    ) -> bool:
        """Change user's subscription plan."""
        subscription = await self.get_user_subscription(db, user_id)
        
        if not subscription:
            return False
        
        new_plan = await self.get_plan(db, new_plan_id)
        if not new_plan:
            return False
        
        return await stripe_service.change_plan(db, subscription, new_plan, billing_interval)
    
    # =========================================================================
    # USAGE TRACKING
    # =========================================================================
    
    async def track_usage(
        self,
        db: AsyncSession,
        user_id: int,
        usage_type: str,
        quantity: int = 1,
        resource_type: Optional[str] = None,
        resource_id: Optional[int] = None,
        metadata: Optional[Dict] = None
    ):
        """
        Track usage for a user.
        
        Usage types: chat, token, comparison, storage, mcp_call, etc.
        """
        subscription = await self.get_user_subscription(db, user_id)
        
        # Create usage record
        usage = UsageRecord(
            user_id=user_id,
            subscription_id=subscription.id if subscription else None,
            usage_type=usage_type,
            quantity=quantity,
            resource_type=resource_type,
            resource_id=resource_id,
            metadata=metadata or {}
        )
        db.add(usage)
        
        # Update subscription usage counters
        if subscription:
            subscription.increment_usage(usage_type, quantity)
        
        await db.commit()
    
    async def get_usage_stats(
        self,
        db: AsyncSession,
        user_id: int,
        period_start: Optional[datetime] = None,
        period_end: Optional[datetime] = None
    ) -> Dict[str, int]:
        """Get usage statistics for a user."""
        subscription = await self.get_user_subscription(db, user_id)
        
        if subscription and subscription.usage_this_period:
            return subscription.usage_this_period
        
        # Calculate from usage records if no subscription
        if not period_start:
            period_start = datetime.utcnow().replace(day=1, hour=0, minute=0, second=0)
        if not period_end:
            period_end = datetime.utcnow()
        
        result = await db.execute(
            select(
                UsageRecord.usage_type,
                func.sum(UsageRecord.quantity).label("total")
            )
            .where(UsageRecord.user_id == user_id)
            .where(UsageRecord.recorded_at >= period_start)
            .where(UsageRecord.recorded_at <= period_end)
            .group_by(UsageRecord.usage_type)
        )
        
        return {row.usage_type: row.total for row in result.all()}
    
    async def check_usage_limit(
        self,
        db: AsyncSession,
        user_id: int,
        usage_type: str,
        additional: int = 1
    ) -> Tuple[bool, int, int]:
        """
        Check if user can perform an action within limits.
        
        Returns (allowed, current_usage, max_limit) tuple.
        """
        subscription = await self.get_or_create_free_subscription(
            db, 
            await db.get(User, user_id)
        )
        
        if not subscription.plan:
            return False, 0, 0
        
        limits = subscription.plan.limits or {}
        limit_key = f"max_{usage_type}"
        
        max_limit = limits.get(limit_key, 0)
        
        # -1 means unlimited
        if max_limit == -1:
            return True, 0, -1
        
        current_usage = (subscription.usage_this_period or {}).get(usage_type, 0)
        
        allowed = (current_usage + additional) <= max_limit
        return allowed, current_usage, max_limit
    
    # =========================================================================
    # FEATURE ACCESS
    # =========================================================================
    
    async def has_feature(
        self,
        db: AsyncSession,
        user_id: int,
        feature_name: str
    ) -> bool:
        """Check if user has access to a feature."""
        subscription = await self.get_user_subscription(db, user_id)
        
        if not subscription or not subscription.plan:
            return False
        
        return subscription.has_feature(feature_name)
    
    async def get_allowed_models(
        self,
        db: AsyncSession,
        user_id: int
    ) -> List[str]:
        """Get list of AI models user can access."""
        subscription = await self.get_user_subscription(db, user_id)
        
        if not subscription or not subscription.plan:
            return ["deepseek-chat"]  # Default free model
        
        features = subscription.plan.features or {}
        return features.get("ai_models", ["deepseek-chat"])
    
    async def get_subscription_summary(
        self,
        db: AsyncSession,
        user_id: int
    ) -> Dict[str, Any]:
        """Get comprehensive subscription summary for a user."""
        subscription = await self.get_or_create_free_subscription(
            db,
            await db.get(User, user_id)
        )
        
        plan = subscription.plan
        usage = subscription.usage_this_period or {}
        limits = plan.limits if plan else {}
        features = plan.features if plan else {}
        
        # Calculate usage percentages
        usage_percentages = {}
        for key, limit in limits.items():
            if limit > 0:
                usage_key = key.replace("max_", "")
                current = usage.get(usage_key, 0)
                usage_percentages[usage_key] = min(100, int((current / limit) * 100))
        
        return {
            "subscription": subscription.to_dict(),
            "plan": plan.to_dict() if plan else None,
            "usage": usage,
            "limits": limits,
            "usage_percentages": usage_percentages,
            "features": features,
            "is_active": subscription.is_active,
            "is_trialing": subscription.is_trialing,
            "days_remaining": subscription.days_remaining,
            "stripe_configured": stripe_service.is_configured
        }
    
    # =========================================================================
    # PAYMENT HISTORY
    # =========================================================================
    
    async def get_payment_history(
        self,
        db: AsyncSession,
        user_id: int,
        limit: int = 20
    ) -> List[Dict[str, Any]]:
        """Get user's payment history."""
        subscription = await self.get_user_subscription(db, user_id)
        
        if not subscription:
            return []
        
        result = await db.execute(
            select(Payment)
            .where(Payment.subscription_id == subscription.id)
            .order_by(Payment.created_at.desc())
            .limit(limit)
        )
        
        return [p.to_dict() for p in result.scalars().all()]
    
    async def get_invoices(
        self,
        db: AsyncSession,
        user_id: int,
        limit: int = 20
    ) -> List[Dict[str, Any]]:
        """Get user's invoices."""
        subscription = await self.get_user_subscription(db, user_id)
        
        if not subscription:
            return []
        
        # Try Stripe first
        if subscription.stripe_customer_id and stripe_service.is_configured:
            return await stripe_service.get_invoices(
                subscription.stripe_customer_id, limit
            )
        
        # Fall back to local invoices
        result = await db.execute(
            select(Invoice)
            .where(Invoice.subscription_id == subscription.id)
            .order_by(Invoice.created_at.desc())
            .limit(limit)
        )
        
        return [i.to_dict() for i in result.scalars().all()]


# Global service instance
subscription_service = SubscriptionService()
