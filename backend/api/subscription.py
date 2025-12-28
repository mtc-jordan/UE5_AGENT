"""
Subscription API Endpoints.

REST API for subscription management, payments, and billing.

Version: 2.3.0
"""

from fastapi import APIRouter, Depends, HTTPException, status, Request, Header
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel, Field
from typing import Optional, List, Any
from datetime import datetime

from core.database import get_db
from services.auth import get_current_user
from services.subscription import subscription_service
from services.stripe_service import stripe_service
from models.user import User
from models.subscription import BillingInterval, SubscriptionTier

router = APIRouter(prefix="/subscription", tags=["Subscription"])


# =============================================================================
# SCHEMAS
# =============================================================================

class PlanResponse(BaseModel):
    """Subscription plan response."""
    id: int
    name: str
    tier: str
    display_name: str
    description: Optional[str]
    price_monthly: float
    price_yearly: float
    currency: str = "USD"
    limits: dict
    features: dict
    is_featured: bool
    trial_days: int


class SubscriptionResponse(BaseModel):
    """Subscription response."""
    id: int
    user_id: int
    plan: Optional[PlanResponse]
    status: str
    billing_interval: str
    current_period_start: Optional[str]
    current_period_end: Optional[str]
    trial_end: Optional[str]
    cancel_at_period_end: bool
    is_active: bool
    is_trialing: bool
    days_remaining: int
    usage: dict


class SubscribeRequest(BaseModel):
    """Subscribe to a plan request."""
    plan_id: int
    billing_interval: str = Field(default="monthly", pattern="^(monthly|yearly)$")
    payment_method_id: Optional[str] = None


class ChangePlanRequest(BaseModel):
    """Change plan request."""
    plan_id: int
    billing_interval: Optional[str] = Field(default=None, pattern="^(monthly|yearly)$")


class CheckoutRequest(BaseModel):
    """Create checkout session request."""
    plan_id: int
    billing_interval: str = Field(default="monthly", pattern="^(monthly|yearly)$")
    success_url: str
    cancel_url: str


class UsageLimitResponse(BaseModel):
    """Usage limit check response."""
    allowed: bool
    current_usage: int
    max_limit: int
    usage_type: str


class SubscriptionSummaryResponse(BaseModel):
    """Comprehensive subscription summary."""
    subscription: Optional[dict]
    plan: Optional[dict]
    usage: dict
    limits: dict
    usage_percentages: dict
    features: dict
    is_active: bool
    is_trialing: bool
    days_remaining: int
    stripe_configured: bool


# =============================================================================
# PLAN ENDPOINTS
# =============================================================================

@router.get("/plans", response_model=List[PlanResponse])
async def get_plans(
    db: AsyncSession = Depends(get_db)
):
    """Get all available subscription plans."""
    plans = await subscription_service.get_plans(db)
    return [
        PlanResponse(
            id=p.id,
            name=p.name,
            tier=p.tier.value,
            display_name=p.display_name,
            description=p.description,
            price_monthly=float(p.price_monthly or 0),
            price_yearly=float(p.price_yearly or 0),
            currency=p.currency,
            limits=p.limits or {},
            features=p.features or {},
            is_featured=p.is_featured,
            trial_days=p.trial_days
        )
        for p in plans
    ]


@router.get("/plans/{plan_id}", response_model=PlanResponse)
async def get_plan(
    plan_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Get a specific subscription plan."""
    plan = await subscription_service.get_plan(db, plan_id)
    
    if not plan:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Plan not found"
        )
    
    return PlanResponse(
        id=plan.id,
        name=plan.name,
        tier=plan.tier.value,
        display_name=plan.display_name,
        description=plan.description,
        price_monthly=float(plan.price_monthly or 0),
        price_yearly=float(plan.price_yearly or 0),
        currency=plan.currency,
        limits=plan.limits or {},
        features=plan.features or {},
        is_featured=plan.is_featured,
        trial_days=plan.trial_days
    )


@router.post("/plans/initialize")
async def initialize_plans(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Initialize default subscription plans (admin only)."""
    # Check if user is admin
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )
    
    count = await subscription_service.initialize_default_plans(db)
    return {"message": f"Initialized {count} plans", "count": count}


# =============================================================================
# SUBSCRIPTION ENDPOINTS
# =============================================================================

@router.get("/me", response_model=SubscriptionSummaryResponse)
async def get_my_subscription(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get current user's subscription summary."""
    summary = await subscription_service.get_subscription_summary(db, current_user.id)
    return SubscriptionSummaryResponse(**summary)


@router.post("/subscribe")
async def subscribe(
    request: SubscribeRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Subscribe to a plan."""
    try:
        billing_interval = BillingInterval(request.billing_interval)
        
        subscription, client_secret = await subscription_service.subscribe(
            db,
            current_user,
            request.plan_id,
            billing_interval,
            request.payment_method_id
        )
        
        if not subscription:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to create subscription"
            )
        
        return {
            "subscription": subscription.to_dict(),
            "client_secret": client_secret,
            "requires_payment": client_secret is not None
        }
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.post("/cancel")
async def cancel_subscription(
    immediately: bool = False,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Cancel current subscription."""
    success = await subscription_service.cancel_subscription(
        db, current_user.id, immediately
    )
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Failed to cancel subscription"
        )
    
    return {
        "message": "Subscription canceled" if immediately else "Subscription will cancel at period end",
        "immediately": immediately
    }


@router.post("/reactivate")
async def reactivate_subscription(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Reactivate a canceled subscription."""
    success = await subscription_service.reactivate_subscription(db, current_user.id)
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Failed to reactivate subscription"
        )
    
    return {"message": "Subscription reactivated"}


@router.post("/change-plan")
async def change_plan(
    request: ChangePlanRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Change to a different subscription plan."""
    billing_interval = None
    if request.billing_interval:
        billing_interval = BillingInterval(request.billing_interval)
    
    success = await subscription_service.change_plan(
        db, current_user.id, request.plan_id, billing_interval
    )
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Failed to change plan"
        )
    
    return {"message": "Plan changed successfully"}


# =============================================================================
# USAGE ENDPOINTS
# =============================================================================

@router.get("/usage")
async def get_usage(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get current usage statistics."""
    usage = await subscription_service.get_usage_stats(db, current_user.id)
    summary = await subscription_service.get_subscription_summary(db, current_user.id)
    
    return {
        "usage": usage,
        "limits": summary.get("limits", {}),
        "percentages": summary.get("usage_percentages", {})
    }


@router.get("/usage/check/{usage_type}", response_model=UsageLimitResponse)
async def check_usage_limit(
    usage_type: str,
    additional: int = 1,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Check if an action is allowed within usage limits."""
    allowed, current, limit = await subscription_service.check_usage_limit(
        db, current_user.id, usage_type, additional
    )
    
    return UsageLimitResponse(
        allowed=allowed,
        current_usage=current,
        max_limit=limit,
        usage_type=usage_type
    )


# =============================================================================
# FEATURE ACCESS ENDPOINTS
# =============================================================================

@router.get("/features/{feature_name}")
async def check_feature(
    feature_name: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Check if user has access to a feature."""
    has_access = await subscription_service.has_feature(db, current_user.id, feature_name)
    
    return {
        "feature": feature_name,
        "has_access": has_access
    }


@router.get("/models")
async def get_allowed_models(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get list of AI models user can access."""
    models = await subscription_service.get_allowed_models(db, current_user.id)
    
    return {"models": models}


# =============================================================================
# PAYMENT ENDPOINTS
# =============================================================================

@router.post("/checkout")
async def create_checkout_session(
    request: CheckoutRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a Stripe Checkout session."""
    plan = await subscription_service.get_plan(db, request.plan_id)
    
    if not plan:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Plan not found"
        )
    
    billing_interval = BillingInterval(request.billing_interval)
    
    checkout_url = await stripe_service.create_checkout_session(
        db,
        current_user,
        plan,
        billing_interval,
        request.success_url,
        request.cancel_url
    )
    
    if not checkout_url:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Failed to create checkout session. Stripe may not be configured."
        )
    
    return {"checkout_url": checkout_url}


@router.get("/billing-portal")
async def get_billing_portal(
    return_url: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get Stripe Billing Portal URL."""
    subscription = await subscription_service.get_user_subscription(db, current_user.id)
    
    if not subscription or not subscription.stripe_customer_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No billing account found"
        )
    
    portal_url = await stripe_service.create_billing_portal_session(
        subscription.stripe_customer_id,
        return_url
    )
    
    if not portal_url:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Failed to create billing portal session"
        )
    
    return {"portal_url": portal_url}


@router.get("/payment-methods")
async def get_payment_methods(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get user's payment methods."""
    subscription = await subscription_service.get_user_subscription(db, current_user.id)
    
    if not subscription or not subscription.stripe_customer_id:
        return {"payment_methods": []}
    
    methods = await stripe_service.get_payment_methods(subscription.stripe_customer_id)
    return {"payment_methods": methods}


@router.post("/setup-intent")
async def create_setup_intent(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a SetupIntent for adding a payment method."""
    subscription = await subscription_service.get_user_subscription(db, current_user.id)
    
    if not subscription or not subscription.stripe_customer_id:
        # Create customer first
        customer_id = await stripe_service.create_customer(db, current_user)
    else:
        customer_id = subscription.stripe_customer_id
    
    if not customer_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Failed to create customer"
        )
    
    client_secret = await stripe_service.create_setup_intent(customer_id)
    
    if not client_secret:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Failed to create setup intent"
        )
    
    return {"client_secret": client_secret}


@router.get("/payments")
async def get_payment_history(
    limit: int = 20,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get payment history."""
    payments = await subscription_service.get_payment_history(db, current_user.id, limit)
    return {"payments": payments}


@router.get("/invoices")
async def get_invoices(
    limit: int = 20,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get invoices."""
    invoices = await subscription_service.get_invoices(db, current_user.id, limit)
    return {"invoices": invoices}


# =============================================================================
# WEBHOOK ENDPOINT
# =============================================================================

@router.post("/webhook")
async def stripe_webhook(
    request: Request,
    stripe_signature: str = Header(None, alias="Stripe-Signature"),
    db: AsyncSession = Depends(get_db)
):
    """Handle Stripe webhook events."""
    if not stripe_signature:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing Stripe signature"
        )
    
    payload = await request.body()
    
    event = stripe_service.verify_webhook(payload, stripe_signature)
    
    if not event:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid webhook signature"
        )
    
    success = await stripe_service.handle_webhook_event(db, event)
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to process webhook"
        )
    
    return {"received": True}


# =============================================================================
# STRIPE CONFIG ENDPOINT
# =============================================================================

@router.get("/config")
async def get_stripe_config():
    """Get Stripe publishable key for frontend."""
    return {
        "publishable_key": stripe_service.publishable_key,
        "is_configured": stripe_service.is_configured
    }
