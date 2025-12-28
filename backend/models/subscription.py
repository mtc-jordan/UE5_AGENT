"""
Subscription and Payment Database Models.

Provides subscription tiers, payment tracking, and Stripe integration.

Version: 2.3.0
"""

from sqlalchemy import (
    Column, Integer, String, Text, Boolean, DateTime, ForeignKey,
    Numeric, JSON, Enum as SQLEnum, UniqueConstraint, Index
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from datetime import datetime, timedelta
from typing import Optional, Dict, Any
import enum

from core.database import Base


# =============================================================================
# ENUMS
# =============================================================================

class SubscriptionTier(str, enum.Enum):
    """Available subscription tiers."""
    FREE = "free"
    STARTER = "starter"
    PROFESSIONAL = "professional"
    TEAM = "team"
    ENTERPRISE = "enterprise"


class SubscriptionStatus(str, enum.Enum):
    """Subscription status states."""
    ACTIVE = "active"
    TRIALING = "trialing"
    PAST_DUE = "past_due"
    CANCELED = "canceled"
    UNPAID = "unpaid"
    PAUSED = "paused"


class PaymentStatus(str, enum.Enum):
    """Payment transaction status."""
    PENDING = "pending"
    SUCCEEDED = "succeeded"
    FAILED = "failed"
    REFUNDED = "refunded"
    DISPUTED = "disputed"


class BillingInterval(str, enum.Enum):
    """Billing interval options."""
    MONTHLY = "monthly"
    YEARLY = "yearly"
    LIFETIME = "lifetime"


# =============================================================================
# MODELS
# =============================================================================

class SubscriptionPlan(Base):
    """
    Subscription plan definitions.
    
    Defines the features, limits, and pricing for each tier.
    """
    __tablename__ = "subscription_plans"
    
    id = Column(Integer, primary_key=True, index=True)
    
    # Plan identification
    name = Column(String(64), unique=True, nullable=False)
    tier = Column(SQLEnum(SubscriptionTier), nullable=False)
    display_name = Column(String(128), nullable=False)
    description = Column(Text, nullable=True)
    
    # Pricing
    price_monthly = Column(Numeric(10, 2), default=0)
    price_yearly = Column(Numeric(10, 2), default=0)
    currency = Column(String(3), default="USD")
    
    # Stripe integration
    stripe_price_id_monthly = Column(String(128), nullable=True)
    stripe_price_id_yearly = Column(String(128), nullable=True)
    stripe_product_id = Column(String(128), nullable=True)
    
    # Feature limits
    limits = Column(JSON, default={
        "max_projects": 3,
        "max_chats_per_day": 50,
        "max_tokens_per_month": 100000,
        "max_file_storage_mb": 100,
        "max_team_members": 1,
        "max_plugins": 5,
        "max_comparisons_per_day": 10,
        "max_mcp_connections": 1
    })
    
    # Feature flags
    features = Column(JSON, default={
        "ai_models": ["deepseek-chat"],
        "chat_modes": ["solo"],
        "workspace_enabled": True,
        "plugins_enabled": False,
        "comparison_enabled": False,
        "mcp_enabled": True,
        "realtime_enabled": False,
        "priority_support": False,
        "api_access": False,
        "custom_agents": False,
        "team_features": False,
        "sso_enabled": False,
        "audit_logs": False,
        "analytics": False
    })
    
    # Plan metadata
    is_active = Column(Boolean, default=True)
    is_featured = Column(Boolean, default=False)
    trial_days = Column(Integer, default=0)
    sort_order = Column(Integer, default=0)
    
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())
    
    # Relationships
    subscriptions = relationship("Subscription", back_populates="plan")
    
    def get_price(self, interval: BillingInterval) -> float:
        """Get price for billing interval."""
        if interval == BillingInterval.MONTHLY:
            return float(self.price_monthly or 0)
        elif interval == BillingInterval.YEARLY:
            return float(self.price_yearly or 0)
        return 0
    
    def get_stripe_price_id(self, interval: BillingInterval) -> Optional[str]:
        """Get Stripe price ID for billing interval."""
        if interval == BillingInterval.MONTHLY:
            return self.stripe_price_id_monthly
        elif interval == BillingInterval.YEARLY:
            return self.stripe_price_id_yearly
        return None
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "id": self.id,
            "name": self.name,
            "tier": self.tier.value,
            "display_name": self.display_name,
            "description": self.description,
            "price_monthly": float(self.price_monthly or 0),
            "price_yearly": float(self.price_yearly or 0),
            "currency": self.currency,
            "limits": self.limits,
            "features": self.features,
            "is_featured": self.is_featured,
            "trial_days": self.trial_days
        }


class Subscription(Base):
    """
    User subscription records.
    
    Tracks the subscription status and billing for each user.
    """
    __tablename__ = "subscriptions"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    plan_id = Column(Integer, ForeignKey("subscription_plans.id"), nullable=False)
    
    # Subscription status
    status = Column(SQLEnum(SubscriptionStatus), default=SubscriptionStatus.ACTIVE)
    billing_interval = Column(SQLEnum(BillingInterval), default=BillingInterval.MONTHLY)
    
    # Billing dates
    current_period_start = Column(DateTime, nullable=True)
    current_period_end = Column(DateTime, nullable=True)
    trial_start = Column(DateTime, nullable=True)
    trial_end = Column(DateTime, nullable=True)
    canceled_at = Column(DateTime, nullable=True)
    cancel_at_period_end = Column(Boolean, default=False)
    
    # Stripe integration
    stripe_customer_id = Column(String(128), nullable=True, index=True)
    stripe_subscription_id = Column(String(128), nullable=True, unique=True)
    
    # Usage tracking
    usage_this_period = Column(JSON, default={
        "chats": 0,
        "tokens": 0,
        "comparisons": 0,
        "file_storage_mb": 0
    })
    
    # Extra data
    extra_data = Column(JSON, default={})
    
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())
    
    # Relationships
    user = relationship("User", back_populates="subscription")
    plan = relationship("SubscriptionPlan", back_populates="subscriptions")
    payments = relationship("Payment", back_populates="subscription", cascade="all, delete-orphan")
    invoices = relationship("Invoice", back_populates="subscription", cascade="all, delete-orphan")
    
    # Indexes
    __table_args__ = (
        Index('idx_subscription_user', 'user_id'),
        Index('idx_subscription_status', 'status'),
        Index('idx_subscription_stripe', 'stripe_subscription_id'),
    )
    
    @property
    def is_active(self) -> bool:
        """Check if subscription is active."""
        return self.status in [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIALING]
    
    @property
    def is_trialing(self) -> bool:
        """Check if subscription is in trial."""
        return self.status == SubscriptionStatus.TRIALING
    
    @property
    def days_remaining(self) -> int:
        """Get days remaining in current period."""
        if not self.current_period_end:
            return 0
        delta = self.current_period_end - datetime.utcnow()
        return max(0, delta.days)
    
    def check_limit(self, limit_name: str, current_value: int) -> bool:
        """Check if a limit has been reached."""
        if not self.plan:
            return False
        limits = self.plan.limits or {}
        max_value = limits.get(limit_name, 0)
        if max_value == -1:  # Unlimited
            return True
        return current_value < max_value
    
    def has_feature(self, feature_name: str) -> bool:
        """Check if subscription has a feature."""
        if not self.plan:
            return False
        features = self.plan.features or {}
        return features.get(feature_name, False)
    
    def increment_usage(self, usage_type: str, amount: int = 1):
        """Increment usage counter."""
        if self.usage_this_period is None:
            self.usage_this_period = {}
        current = self.usage_this_period.get(usage_type, 0)
        self.usage_this_period[usage_type] = current + amount
    
    def reset_usage(self):
        """Reset usage counters for new period."""
        self.usage_this_period = {
            "chats": 0,
            "tokens": 0,
            "comparisons": 0,
            "file_storage_mb": 0
        }
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "id": self.id,
            "user_id": self.user_id,
            "plan": self.plan.to_dict() if self.plan else None,
            "status": self.status.value,
            "billing_interval": self.billing_interval.value,
            "current_period_start": self.current_period_start.isoformat() if self.current_period_start else None,
            "current_period_end": self.current_period_end.isoformat() if self.current_period_end else None,
            "trial_end": self.trial_end.isoformat() if self.trial_end else None,
            "cancel_at_period_end": self.cancel_at_period_end,
            "is_active": self.is_active,
            "is_trialing": self.is_trialing,
            "days_remaining": self.days_remaining,
            "usage": self.usage_this_period
        }


class Payment(Base):
    """
    Payment transaction records.
    
    Tracks all payment attempts and their status.
    """
    __tablename__ = "payments"
    
    id = Column(Integer, primary_key=True, index=True)
    subscription_id = Column(Integer, ForeignKey("subscriptions.id", ondelete="CASCADE"), nullable=False)
    
    # Payment details
    amount = Column(Numeric(10, 2), nullable=False)
    currency = Column(String(3), default="USD")
    status = Column(SQLEnum(PaymentStatus), default=PaymentStatus.PENDING)
    
    # Stripe integration
    stripe_payment_intent_id = Column(String(128), nullable=True, unique=True)
    stripe_charge_id = Column(String(128), nullable=True)
    stripe_invoice_id = Column(String(128), nullable=True)
    
    # Payment method
    payment_method_type = Column(String(32), nullable=True)  # card, bank_transfer, etc.
    payment_method_last4 = Column(String(4), nullable=True)
    payment_method_brand = Column(String(32), nullable=True)  # visa, mastercard, etc.
    
    # Error handling
    failure_code = Column(String(64), nullable=True)
    failure_message = Column(Text, nullable=True)
    
    # Metadata
    description = Column(String(256), nullable=True)
    payment_metadata = Column(JSON, default={})
    
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())
    
    # Relationships
    subscription = relationship("Subscription", back_populates="payments")
    
    # Indexes
    __table_args__ = (
        Index('idx_payment_subscription', 'subscription_id'),
        Index('idx_payment_status', 'status'),
        Index('idx_payment_stripe', 'stripe_payment_intent_id'),
    )
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "id": self.id,
            "amount": float(self.amount),
            "currency": self.currency,
            "status": self.status.value,
            "payment_method": {
                "type": self.payment_method_type,
                "last4": self.payment_method_last4,
                "brand": self.payment_method_brand
            } if self.payment_method_type else None,
            "description": self.description,
            "created_at": self.created_at.isoformat() if self.created_at else None
        }


class Invoice(Base):
    """
    Invoice records.
    
    Tracks invoices generated for subscriptions.
    """
    __tablename__ = "invoices"
    
    id = Column(Integer, primary_key=True, index=True)
    subscription_id = Column(Integer, ForeignKey("subscriptions.id", ondelete="CASCADE"), nullable=False)
    
    # Invoice details
    invoice_number = Column(String(64), unique=True, nullable=False)
    amount_due = Column(Numeric(10, 2), nullable=False)
    amount_paid = Column(Numeric(10, 2), default=0)
    currency = Column(String(3), default="USD")
    status = Column(String(32), default="draft")  # draft, open, paid, void, uncollectible
    
    # Stripe integration
    stripe_invoice_id = Column(String(128), nullable=True, unique=True)
    stripe_hosted_invoice_url = Column(Text, nullable=True)
    stripe_invoice_pdf = Column(Text, nullable=True)
    
    # Dates
    period_start = Column(DateTime, nullable=True)
    period_end = Column(DateTime, nullable=True)
    due_date = Column(DateTime, nullable=True)
    paid_at = Column(DateTime, nullable=True)
    
    # Line items
    line_items = Column(JSON, default=[])
    
    # Extra data
    extra_data = Column(JSON, default={})
    
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())
    
    # Relationships
    subscription = relationship("Subscription", back_populates="invoices")
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "id": self.id,
            "invoice_number": self.invoice_number,
            "amount_due": float(self.amount_due),
            "amount_paid": float(self.amount_paid),
            "currency": self.currency,
            "status": self.status,
            "period_start": self.period_start.isoformat() if self.period_start else None,
            "period_end": self.period_end.isoformat() if self.period_end else None,
            "due_date": self.due_date.isoformat() if self.due_date else None,
            "paid_at": self.paid_at.isoformat() if self.paid_at else None,
            "hosted_url": self.stripe_hosted_invoice_url,
            "pdf_url": self.stripe_invoice_pdf,
            "line_items": self.line_items,
            "created_at": self.created_at.isoformat() if self.created_at else None
        }


class UsageRecord(Base):
    """
    Usage tracking records.
    
    Detailed usage tracking for metered billing and analytics.
    """
    __tablename__ = "usage_records"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    subscription_id = Column(Integer, ForeignKey("subscriptions.id", ondelete="CASCADE"), nullable=True)
    
    # Usage details
    usage_type = Column(String(64), nullable=False)  # chat, token, comparison, storage, etc.
    quantity = Column(Integer, default=1)
    
    # Context
    resource_type = Column(String(64), nullable=True)  # chat, project, plugin, etc.
    resource_id = Column(Integer, nullable=True)
    
    # Extra data
    extra_data = Column(JSON, default={})
    
    recorded_at = Column(DateTime, default=func.now())
    
    # Indexes
    __table_args__ = (
        Index('idx_usage_user', 'user_id'),
        Index('idx_usage_subscription', 'subscription_id'),
        Index('idx_usage_type', 'usage_type'),
        Index('idx_usage_recorded', 'recorded_at'),
    )


# =============================================================================
# DEFAULT PLANS
# =============================================================================

DEFAULT_PLANS = [
    {
        "name": "free",
        "tier": SubscriptionTier.FREE,
        "display_name": "Free",
        "description": "Get started with basic features",
        "price_monthly": 0,
        "price_yearly": 0,
        "trial_days": 0,
        "sort_order": 0,
        "limits": {
            "max_projects": 3,
            "max_chats_per_day": 25,
            "max_tokens_per_month": 50000,
            "max_file_storage_mb": 50,
            "max_team_members": 1,
            "max_plugins": 3,
            "max_comparisons_per_day": 5,
            "max_mcp_connections": 1
        },
        "features": {
            "ai_models": ["deepseek-chat"],
            "chat_modes": ["solo"],
            "workspace_enabled": True,
            "plugins_enabled": False,
            "comparison_enabled": False,
            "mcp_enabled": True,
            "realtime_enabled": False,
            "priority_support": False,
            "api_access": False,
            "custom_agents": False,
            "team_features": False,
            "sso_enabled": False,
            "audit_logs": False,
            "analytics": False
        }
    },
    {
        "name": "starter",
        "tier": SubscriptionTier.STARTER,
        "display_name": "Starter",
        "description": "Perfect for individual developers",
        "price_monthly": 19,
        "price_yearly": 190,
        "trial_days": 14,
        "sort_order": 1,
        "is_featured": False,
        "limits": {
            "max_projects": 10,
            "max_chats_per_day": 100,
            "max_tokens_per_month": 500000,
            "max_file_storage_mb": 500,
            "max_team_members": 1,
            "max_plugins": 10,
            "max_comparisons_per_day": 25,
            "max_mcp_connections": 3
        },
        "features": {
            "ai_models": ["deepseek-chat", "deepseek-reasoner", "gemini-2.5-flash"],
            "chat_modes": ["solo", "team"],
            "workspace_enabled": True,
            "plugins_enabled": True,
            "comparison_enabled": True,
            "mcp_enabled": True,
            "realtime_enabled": False,
            "priority_support": False,
            "api_access": False,
            "custom_agents": True,
            "team_features": False,
            "sso_enabled": False,
            "audit_logs": False,
            "analytics": False
        }
    },
    {
        "name": "professional",
        "tier": SubscriptionTier.PROFESSIONAL,
        "display_name": "Professional",
        "description": "For power users and small teams",
        "price_monthly": 49,
        "price_yearly": 490,
        "trial_days": 14,
        "sort_order": 2,
        "is_featured": True,
        "limits": {
            "max_projects": 50,
            "max_chats_per_day": 500,
            "max_tokens_per_month": 2000000,
            "max_file_storage_mb": 2000,
            "max_team_members": 5,
            "max_plugins": 50,
            "max_comparisons_per_day": 100,
            "max_mcp_connections": 10
        },
        "features": {
            "ai_models": ["deepseek-chat", "deepseek-reasoner", "gemini-2.5-flash", "gemini-2.5-pro", "claude-3-5-sonnet"],
            "chat_modes": ["solo", "team", "roundtable"],
            "workspace_enabled": True,
            "plugins_enabled": True,
            "comparison_enabled": True,
            "mcp_enabled": True,
            "realtime_enabled": True,
            "priority_support": True,
            "api_access": True,
            "custom_agents": True,
            "team_features": True,
            "sso_enabled": False,
            "audit_logs": True,
            "analytics": True
        }
    },
    {
        "name": "team",
        "tier": SubscriptionTier.TEAM,
        "display_name": "Team",
        "description": "Collaborate with your entire team",
        "price_monthly": 99,
        "price_yearly": 990,
        "trial_days": 14,
        "sort_order": 3,
        "limits": {
            "max_projects": 200,
            "max_chats_per_day": 2000,
            "max_tokens_per_month": 10000000,
            "max_file_storage_mb": 10000,
            "max_team_members": 25,
            "max_plugins": 200,
            "max_comparisons_per_day": 500,
            "max_mcp_connections": 50
        },
        "features": {
            "ai_models": ["deepseek-chat", "deepseek-reasoner", "gemini-2.5-flash", "gemini-2.5-pro", "claude-3-5-sonnet", "claude-3-opus"],
            "chat_modes": ["solo", "team", "roundtable"],
            "workspace_enabled": True,
            "plugins_enabled": True,
            "comparison_enabled": True,
            "mcp_enabled": True,
            "realtime_enabled": True,
            "priority_support": True,
            "api_access": True,
            "custom_agents": True,
            "team_features": True,
            "sso_enabled": True,
            "audit_logs": True,
            "analytics": True
        }
    },
    {
        "name": "enterprise",
        "tier": SubscriptionTier.ENTERPRISE,
        "display_name": "Enterprise",
        "description": "Custom solutions for large organizations",
        "price_monthly": 0,  # Custom pricing
        "price_yearly": 0,
        "trial_days": 30,
        "sort_order": 4,
        "limits": {
            "max_projects": -1,  # Unlimited
            "max_chats_per_day": -1,
            "max_tokens_per_month": -1,
            "max_file_storage_mb": -1,
            "max_team_members": -1,
            "max_plugins": -1,
            "max_comparisons_per_day": -1,
            "max_mcp_connections": -1
        },
        "features": {
            "ai_models": ["deepseek-chat", "deepseek-reasoner", "gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-2.5-pro", "gemini-2.0-flash", "claude-3-5-sonnet", "claude-3-opus"],
            "chat_modes": ["solo", "team", "roundtable"],
            "workspace_enabled": True,
            "plugins_enabled": True,
            "comparison_enabled": True,
            "mcp_enabled": True,
            "realtime_enabled": True,
            "priority_support": True,
            "api_access": True,
            "custom_agents": True,
            "team_features": True,
            "sso_enabled": True,
            "audit_logs": True,
            "analytics": True,
            "dedicated_support": True,
            "custom_integrations": True,
            "on_premise": True
        }
    }
]
