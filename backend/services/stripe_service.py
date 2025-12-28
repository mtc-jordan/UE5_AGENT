"""
Stripe Payment Service.

Handles all Stripe API interactions for subscriptions, payments, and webhooks.

Version: 2.3.0
"""

import stripe
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from sqlalchemy.orm import selectinload
from typing import Optional, Dict, Any, List, Tuple
from datetime import datetime, timedelta
import logging
import os

from models.subscription import (
    Subscription, SubscriptionPlan, Payment, Invoice, UsageRecord,
    SubscriptionStatus, PaymentStatus, BillingInterval, DEFAULT_PLANS
)
from models.user import User

logger = logging.getLogger(__name__)


class StripeService:
    """
    Service for Stripe payment integration.
    
    Handles:
    - Customer management
    - Subscription lifecycle
    - Payment processing
    - Webhook handling
    """
    
    def __init__(self):
        self.api_key = os.getenv("STRIPE_SECRET_KEY")
        self.webhook_secret = os.getenv("STRIPE_WEBHOOK_SECRET")
        self.publishable_key = os.getenv("STRIPE_PUBLISHABLE_KEY")
        
        if self.api_key:
            stripe.api_key = self.api_key
        
        self._initialized = bool(self.api_key)
    
    @property
    def is_configured(self) -> bool:
        """Check if Stripe is properly configured."""
        return self._initialized
    
    # =========================================================================
    # CUSTOMER MANAGEMENT
    # =========================================================================
    
    async def create_customer(
        self,
        db: AsyncSession,
        user: User,
        payment_method_id: Optional[str] = None
    ) -> Optional[str]:
        """
        Create a Stripe customer for a user.
        
        Returns the Stripe customer ID.
        """
        if not self.is_configured:
            logger.warning("Stripe not configured, skipping customer creation")
            return None
        
        try:
            # Check if user already has a subscription with customer ID
            result = await db.execute(
                select(Subscription)
                .where(Subscription.user_id == user.id)
                .where(Subscription.stripe_customer_id.isnot(None))
            )
            existing = result.scalar_one_or_none()
            
            if existing and existing.stripe_customer_id:
                return existing.stripe_customer_id
            
            # Create new Stripe customer
            customer_data = {
                "email": user.email,
                "name": user.username,
                "metadata": {
                    "user_id": str(user.id),
                    "username": user.username
                }
            }
            
            if payment_method_id:
                customer_data["payment_method"] = payment_method_id
                customer_data["invoice_settings"] = {
                    "default_payment_method": payment_method_id
                }
            
            customer = stripe.Customer.create(**customer_data)
            
            logger.info(f"Created Stripe customer {customer.id} for user {user.id}")
            return customer.id
            
        except stripe.error.StripeError as e:
            logger.error(f"Stripe error creating customer: {e}")
            raise
    
    async def get_customer(self, customer_id: str) -> Optional[Dict[str, Any]]:
        """Get Stripe customer details."""
        if not self.is_configured:
            return None
        
        try:
            customer = stripe.Customer.retrieve(customer_id)
            return {
                "id": customer.id,
                "email": customer.email,
                "name": customer.name,
                "default_payment_method": customer.invoice_settings.default_payment_method if customer.invoice_settings else None,
                "balance": customer.balance,
                "created": datetime.fromtimestamp(customer.created)
            }
        except stripe.error.StripeError as e:
            logger.error(f"Stripe error getting customer: {e}")
            return None
    
    async def update_customer_payment_method(
        self,
        customer_id: str,
        payment_method_id: str
    ) -> bool:
        """Update customer's default payment method."""
        if not self.is_configured:
            return False
        
        try:
            # Attach payment method to customer
            stripe.PaymentMethod.attach(
                payment_method_id,
                customer=customer_id
            )
            
            # Set as default
            stripe.Customer.modify(
                customer_id,
                invoice_settings={"default_payment_method": payment_method_id}
            )
            
            return True
        except stripe.error.StripeError as e:
            logger.error(f"Stripe error updating payment method: {e}")
            return False
    
    # =========================================================================
    # SUBSCRIPTION MANAGEMENT
    # =========================================================================
    
    async def create_subscription(
        self,
        db: AsyncSession,
        user: User,
        plan: SubscriptionPlan,
        billing_interval: BillingInterval,
        payment_method_id: Optional[str] = None,
        trial_days: Optional[int] = None
    ) -> Tuple[Optional[Subscription], Optional[str]]:
        """
        Create a new subscription for a user.
        
        Returns (Subscription, client_secret) tuple.
        """
        try:
            # Get or create Stripe customer
            customer_id = await self.create_customer(db, user, payment_method_id)
            
            # Get Stripe price ID
            stripe_price_id = plan.get_stripe_price_id(billing_interval)
            
            # Calculate trial end
            trial_end = None
            trial_days_to_use = trial_days if trial_days is not None else plan.trial_days
            if trial_days_to_use > 0:
                trial_end = datetime.utcnow() + timedelta(days=trial_days_to_use)
            
            # Create local subscription record
            subscription = Subscription(
                user_id=user.id,
                plan_id=plan.id,
                status=SubscriptionStatus.TRIALING if trial_end else SubscriptionStatus.ACTIVE,
                billing_interval=billing_interval,
                stripe_customer_id=customer_id,
                current_period_start=datetime.utcnow(),
                current_period_end=datetime.utcnow() + timedelta(days=30 if billing_interval == BillingInterval.MONTHLY else 365),
                trial_start=datetime.utcnow() if trial_end else None,
                trial_end=trial_end
            )
            
            db.add(subscription)
            await db.flush()
            
            client_secret = None
            
            # Create Stripe subscription if configured
            if self.is_configured and stripe_price_id and customer_id:
                stripe_sub_data = {
                    "customer": customer_id,
                    "items": [{"price": stripe_price_id}],
                    "metadata": {
                        "user_id": str(user.id),
                        "subscription_id": str(subscription.id)
                    },
                    "payment_behavior": "default_incomplete",
                    "payment_settings": {
                        "save_default_payment_method": "on_subscription"
                    },
                    "expand": ["latest_invoice.payment_intent"]
                }
                
                if trial_days_to_use > 0:
                    stripe_sub_data["trial_period_days"] = trial_days_to_use
                
                stripe_subscription = stripe.Subscription.create(**stripe_sub_data)
                
                subscription.stripe_subscription_id = stripe_subscription.id
                subscription.current_period_start = datetime.fromtimestamp(stripe_subscription.current_period_start)
                subscription.current_period_end = datetime.fromtimestamp(stripe_subscription.current_period_end)
                
                # Get client secret for payment confirmation
                if stripe_subscription.latest_invoice and stripe_subscription.latest_invoice.payment_intent:
                    client_secret = stripe_subscription.latest_invoice.payment_intent.client_secret
            
            await db.commit()
            await db.refresh(subscription)
            
            logger.info(f"Created subscription {subscription.id} for user {user.id}")
            return subscription, client_secret
            
        except stripe.error.StripeError as e:
            await db.rollback()
            logger.error(f"Stripe error creating subscription: {e}")
            raise
        except Exception as e:
            await db.rollback()
            logger.error(f"Error creating subscription: {e}")
            raise
    
    async def cancel_subscription(
        self,
        db: AsyncSession,
        subscription: Subscription,
        immediately: bool = False
    ) -> bool:
        """
        Cancel a subscription.
        
        If immediately=False, cancels at end of billing period.
        """
        try:
            if self.is_configured and subscription.stripe_subscription_id:
                if immediately:
                    stripe.Subscription.delete(subscription.stripe_subscription_id)
                else:
                    stripe.Subscription.modify(
                        subscription.stripe_subscription_id,
                        cancel_at_period_end=True
                    )
            
            if immediately:
                subscription.status = SubscriptionStatus.CANCELED
                subscription.canceled_at = datetime.utcnow()
            else:
                subscription.cancel_at_period_end = True
            
            await db.commit()
            
            logger.info(f"Canceled subscription {subscription.id}")
            return True
            
        except stripe.error.StripeError as e:
            logger.error(f"Stripe error canceling subscription: {e}")
            return False
    
    async def reactivate_subscription(
        self,
        db: AsyncSession,
        subscription: Subscription
    ) -> bool:
        """Reactivate a subscription that was set to cancel at period end."""
        try:
            if not subscription.cancel_at_period_end:
                return False
            
            if self.is_configured and subscription.stripe_subscription_id:
                stripe.Subscription.modify(
                    subscription.stripe_subscription_id,
                    cancel_at_period_end=False
                )
            
            subscription.cancel_at_period_end = False
            await db.commit()
            
            logger.info(f"Reactivated subscription {subscription.id}")
            return True
            
        except stripe.error.StripeError as e:
            logger.error(f"Stripe error reactivating subscription: {e}")
            return False
    
    async def change_plan(
        self,
        db: AsyncSession,
        subscription: Subscription,
        new_plan: SubscriptionPlan,
        billing_interval: Optional[BillingInterval] = None
    ) -> bool:
        """Change subscription to a different plan."""
        try:
            interval = billing_interval or subscription.billing_interval
            new_price_id = new_plan.get_stripe_price_id(interval)
            
            if self.is_configured and subscription.stripe_subscription_id and new_price_id:
                # Get current subscription items
                stripe_sub = stripe.Subscription.retrieve(subscription.stripe_subscription_id)
                
                # Update to new price
                stripe.Subscription.modify(
                    subscription.stripe_subscription_id,
                    items=[{
                        "id": stripe_sub["items"]["data"][0].id,
                        "price": new_price_id
                    }],
                    proration_behavior="create_prorations"
                )
            
            subscription.plan_id = new_plan.id
            subscription.billing_interval = interval
            await db.commit()
            
            logger.info(f"Changed subscription {subscription.id} to plan {new_plan.name}")
            return True
            
        except stripe.error.StripeError as e:
            logger.error(f"Stripe error changing plan: {e}")
            return False
    
    # =========================================================================
    # PAYMENT MANAGEMENT
    # =========================================================================
    
    async def create_setup_intent(self, customer_id: str) -> Optional[str]:
        """
        Create a SetupIntent for collecting payment method.
        
        Returns the client secret.
        """
        if not self.is_configured:
            return None
        
        try:
            setup_intent = stripe.SetupIntent.create(
                customer=customer_id,
                payment_method_types=["card"]
            )
            return setup_intent.client_secret
        except stripe.error.StripeError as e:
            logger.error(f"Stripe error creating setup intent: {e}")
            return None
    
    async def get_payment_methods(self, customer_id: str) -> List[Dict[str, Any]]:
        """Get customer's payment methods."""
        if not self.is_configured:
            return []
        
        try:
            payment_methods = stripe.PaymentMethod.list(
                customer=customer_id,
                type="card"
            )
            
            return [
                {
                    "id": pm.id,
                    "type": pm.type,
                    "card": {
                        "brand": pm.card.brand,
                        "last4": pm.card.last4,
                        "exp_month": pm.card.exp_month,
                        "exp_year": pm.card.exp_year
                    } if pm.card else None
                }
                for pm in payment_methods.data
            ]
        except stripe.error.StripeError as e:
            logger.error(f"Stripe error getting payment methods: {e}")
            return []
    
    async def delete_payment_method(self, payment_method_id: str) -> bool:
        """Delete a payment method."""
        if not self.is_configured:
            return False
        
        try:
            stripe.PaymentMethod.detach(payment_method_id)
            return True
        except stripe.error.StripeError as e:
            logger.error(f"Stripe error deleting payment method: {e}")
            return False
    
    # =========================================================================
    # INVOICE MANAGEMENT
    # =========================================================================
    
    async def get_invoices(
        self,
        customer_id: str,
        limit: int = 10
    ) -> List[Dict[str, Any]]:
        """Get customer's invoices."""
        if not self.is_configured:
            return []
        
        try:
            invoices = stripe.Invoice.list(
                customer=customer_id,
                limit=limit
            )
            
            return [
                {
                    "id": inv.id,
                    "number": inv.number,
                    "amount_due": inv.amount_due / 100,
                    "amount_paid": inv.amount_paid / 100,
                    "currency": inv.currency,
                    "status": inv.status,
                    "hosted_invoice_url": inv.hosted_invoice_url,
                    "invoice_pdf": inv.invoice_pdf,
                    "created": datetime.fromtimestamp(inv.created).isoformat(),
                    "period_start": datetime.fromtimestamp(inv.period_start).isoformat() if inv.period_start else None,
                    "period_end": datetime.fromtimestamp(inv.period_end).isoformat() if inv.period_end else None
                }
                for inv in invoices.data
            ]
        except stripe.error.StripeError as e:
            logger.error(f"Stripe error getting invoices: {e}")
            return []
    
    async def get_upcoming_invoice(self, customer_id: str) -> Optional[Dict[str, Any]]:
        """Get customer's upcoming invoice."""
        if not self.is_configured:
            return None
        
        try:
            invoice = stripe.Invoice.upcoming(customer=customer_id)
            
            return {
                "amount_due": invoice.amount_due / 100,
                "currency": invoice.currency,
                "period_start": datetime.fromtimestamp(invoice.period_start).isoformat() if invoice.period_start else None,
                "period_end": datetime.fromtimestamp(invoice.period_end).isoformat() if invoice.period_end else None,
                "lines": [
                    {
                        "description": line.description,
                        "amount": line.amount / 100,
                        "quantity": line.quantity
                    }
                    for line in invoice.lines.data
                ]
            }
        except stripe.error.InvalidRequestError:
            # No upcoming invoice
            return None
        except stripe.error.StripeError as e:
            logger.error(f"Stripe error getting upcoming invoice: {e}")
            return None
    
    # =========================================================================
    # WEBHOOK HANDLING
    # =========================================================================
    
    def verify_webhook(self, payload: bytes, signature: str) -> Optional[Dict[str, Any]]:
        """
        Verify and parse a Stripe webhook event.
        
        Returns the event data if valid, None otherwise.
        """
        if not self.webhook_secret:
            logger.warning("Webhook secret not configured")
            return None
        
        try:
            event = stripe.Webhook.construct_event(
                payload, signature, self.webhook_secret
            )
            return event
        except ValueError as e:
            logger.error(f"Invalid webhook payload: {e}")
            return None
        except stripe.error.SignatureVerificationError as e:
            logger.error(f"Invalid webhook signature: {e}")
            return None
    
    async def handle_webhook_event(
        self,
        db: AsyncSession,
        event: Dict[str, Any]
    ) -> bool:
        """
        Handle a Stripe webhook event.
        
        Processes subscription and payment events.
        """
        event_type = event.get("type")
        data = event.get("data", {}).get("object", {})
        
        handlers = {
            "customer.subscription.created": self._handle_subscription_created,
            "customer.subscription.updated": self._handle_subscription_updated,
            "customer.subscription.deleted": self._handle_subscription_deleted,
            "invoice.paid": self._handle_invoice_paid,
            "invoice.payment_failed": self._handle_invoice_payment_failed,
            "payment_intent.succeeded": self._handle_payment_succeeded,
            "payment_intent.payment_failed": self._handle_payment_failed
        }
        
        handler = handlers.get(event_type)
        if handler:
            try:
                await handler(db, data)
                return True
            except Exception as e:
                logger.error(f"Error handling webhook {event_type}: {e}")
                return False
        
        logger.debug(f"Unhandled webhook event: {event_type}")
        return True
    
    async def _handle_subscription_created(self, db: AsyncSession, data: Dict):
        """Handle subscription.created webhook."""
        stripe_sub_id = data.get("id")
        
        result = await db.execute(
            select(Subscription)
            .where(Subscription.stripe_subscription_id == stripe_sub_id)
        )
        subscription = result.scalar_one_or_none()
        
        if subscription:
            subscription.status = SubscriptionStatus(data.get("status", "active"))
            subscription.current_period_start = datetime.fromtimestamp(data.get("current_period_start", 0))
            subscription.current_period_end = datetime.fromtimestamp(data.get("current_period_end", 0))
            await db.commit()
    
    async def _handle_subscription_updated(self, db: AsyncSession, data: Dict):
        """Handle subscription.updated webhook."""
        stripe_sub_id = data.get("id")
        
        result = await db.execute(
            select(Subscription)
            .where(Subscription.stripe_subscription_id == stripe_sub_id)
        )
        subscription = result.scalar_one_or_none()
        
        if subscription:
            status_map = {
                "active": SubscriptionStatus.ACTIVE,
                "trialing": SubscriptionStatus.TRIALING,
                "past_due": SubscriptionStatus.PAST_DUE,
                "canceled": SubscriptionStatus.CANCELED,
                "unpaid": SubscriptionStatus.UNPAID
            }
            subscription.status = status_map.get(data.get("status"), SubscriptionStatus.ACTIVE)
            subscription.current_period_start = datetime.fromtimestamp(data.get("current_period_start", 0))
            subscription.current_period_end = datetime.fromtimestamp(data.get("current_period_end", 0))
            subscription.cancel_at_period_end = data.get("cancel_at_period_end", False)
            
            if data.get("canceled_at"):
                subscription.canceled_at = datetime.fromtimestamp(data.get("canceled_at"))
            
            await db.commit()
    
    async def _handle_subscription_deleted(self, db: AsyncSession, data: Dict):
        """Handle subscription.deleted webhook."""
        stripe_sub_id = data.get("id")
        
        result = await db.execute(
            select(Subscription)
            .where(Subscription.stripe_subscription_id == stripe_sub_id)
        )
        subscription = result.scalar_one_or_none()
        
        if subscription:
            subscription.status = SubscriptionStatus.CANCELED
            subscription.canceled_at = datetime.utcnow()
            await db.commit()
    
    async def _handle_invoice_paid(self, db: AsyncSession, data: Dict):
        """Handle invoice.paid webhook."""
        stripe_sub_id = data.get("subscription")
        
        if not stripe_sub_id:
            return
        
        result = await db.execute(
            select(Subscription)
            .where(Subscription.stripe_subscription_id == stripe_sub_id)
        )
        subscription = result.scalar_one_or_none()
        
        if subscription:
            # Reset usage for new period
            subscription.reset_usage()
            subscription.status = SubscriptionStatus.ACTIVE
            
            # Create payment record
            payment = Payment(
                subscription_id=subscription.id,
                amount=data.get("amount_paid", 0) / 100,
                currency=data.get("currency", "usd"),
                status=PaymentStatus.SUCCEEDED,
                stripe_invoice_id=data.get("id"),
                description=f"Invoice {data.get('number')}"
            )
            db.add(payment)
            
            await db.commit()
    
    async def _handle_invoice_payment_failed(self, db: AsyncSession, data: Dict):
        """Handle invoice.payment_failed webhook."""
        stripe_sub_id = data.get("subscription")
        
        if not stripe_sub_id:
            return
        
        result = await db.execute(
            select(Subscription)
            .where(Subscription.stripe_subscription_id == stripe_sub_id)
        )
        subscription = result.scalar_one_or_none()
        
        if subscription:
            subscription.status = SubscriptionStatus.PAST_DUE
            
            # Create failed payment record
            payment = Payment(
                subscription_id=subscription.id,
                amount=data.get("amount_due", 0) / 100,
                currency=data.get("currency", "usd"),
                status=PaymentStatus.FAILED,
                stripe_invoice_id=data.get("id"),
                failure_message="Payment failed"
            )
            db.add(payment)
            
            await db.commit()
    
    async def _handle_payment_succeeded(self, db: AsyncSession, data: Dict):
        """Handle payment_intent.succeeded webhook."""
        # Payment success is usually handled via invoice.paid
        pass
    
    async def _handle_payment_failed(self, db: AsyncSession, data: Dict):
        """Handle payment_intent.payment_failed webhook."""
        # Payment failure is usually handled via invoice.payment_failed
        pass
    
    # =========================================================================
    # BILLING PORTAL
    # =========================================================================
    
    async def create_billing_portal_session(
        self,
        customer_id: str,
        return_url: str
    ) -> Optional[str]:
        """
        Create a Stripe Billing Portal session.
        
        Returns the portal URL.
        """
        if not self.is_configured:
            return None
        
        try:
            session = stripe.billing_portal.Session.create(
                customer=customer_id,
                return_url=return_url
            )
            return session.url
        except stripe.error.StripeError as e:
            logger.error(f"Stripe error creating billing portal: {e}")
            return None
    
    # =========================================================================
    # CHECKOUT SESSION
    # =========================================================================
    
    async def create_checkout_session(
        self,
        db: AsyncSession,
        user: User,
        plan: SubscriptionPlan,
        billing_interval: BillingInterval,
        success_url: str,
        cancel_url: str
    ) -> Optional[str]:
        """
        Create a Stripe Checkout session.
        
        Returns the checkout URL.
        """
        if not self.is_configured:
            return None
        
        try:
            price_id = plan.get_stripe_price_id(billing_interval)
            if not price_id:
                logger.error(f"No Stripe price ID for plan {plan.name}")
                return None
            
            # Get or create customer
            customer_id = await self.create_customer(db, user)
            
            session_data = {
                "mode": "subscription",
                "customer": customer_id,
                "line_items": [{"price": price_id, "quantity": 1}],
                "success_url": success_url,
                "cancel_url": cancel_url,
                "metadata": {
                    "user_id": str(user.id),
                    "plan_id": str(plan.id)
                }
            }
            
            if plan.trial_days > 0:
                session_data["subscription_data"] = {
                    "trial_period_days": plan.trial_days
                }
            
            session = stripe.checkout.Session.create(**session_data)
            return session.url
            
        except stripe.error.StripeError as e:
            logger.error(f"Stripe error creating checkout session: {e}")
            return None


# Global service instance
stripe_service = StripeService()
