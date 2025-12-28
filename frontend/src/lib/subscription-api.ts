/**
 * Subscription API Client
 * 
 * Handles subscription management, payments, and billing operations.
 * 
 * Version: 2.3.0
 */

import { api } from './api';

// =============================================================================
// TYPES
// =============================================================================

export interface SubscriptionPlan {
  id: number;
  name: string;
  tier: string;
  display_name: string;
  description: string | null;
  price_monthly: number;
  price_yearly: number;
  currency: string;
  limits: PlanLimits;
  features: PlanFeatures;
  is_featured: boolean;
  trial_days: number;
}

export interface PlanLimits {
  max_projects: number;
  max_chats_per_day: number;
  max_tokens_per_month: number;
  max_file_storage_mb: number;
  max_team_members: number;
  max_plugins: number;
  max_comparisons_per_day: number;
  max_mcp_connections: number;
}

export interface PlanFeatures {
  ai_models: string[];
  chat_modes: string[];
  workspace_enabled: boolean;
  plugins_enabled: boolean;
  comparison_enabled: boolean;
  mcp_enabled: boolean;
  realtime_enabled: boolean;
  priority_support: boolean;
  api_access: boolean;
  custom_agents: boolean;
  team_features: boolean;
  sso_enabled: boolean;
  audit_logs: boolean;
  analytics: boolean;
}

export interface Subscription {
  id: number;
  user_id: number;
  plan: SubscriptionPlan | null;
  status: SubscriptionStatus;
  billing_interval: BillingInterval;
  current_period_start: string | null;
  current_period_end: string | null;
  trial_end: string | null;
  cancel_at_period_end: boolean;
  is_active: boolean;
  is_trialing: boolean;
  days_remaining: number;
  usage: UsageStats;
}

export type SubscriptionStatus = 
  | 'active' 
  | 'trialing' 
  | 'past_due' 
  | 'canceled' 
  | 'unpaid' 
  | 'paused';

export type BillingInterval = 'monthly' | 'yearly' | 'lifetime';

export interface UsageStats {
  chats: number;
  tokens: number;
  comparisons: number;
  file_storage_mb: number;
}

export interface SubscriptionSummary {
  subscription: Subscription | null;
  plan: SubscriptionPlan | null;
  usage: UsageStats;
  limits: PlanLimits;
  usage_percentages: Record<string, number>;
  features: PlanFeatures;
  is_active: boolean;
  is_trialing: boolean;
  days_remaining: number;
  stripe_configured: boolean;
}

export interface PaymentMethod {
  id: string;
  type: string;
  card: {
    brand: string;
    last4: string;
    exp_month: number;
    exp_year: number;
  } | null;
}

export interface Payment {
  id: number;
  amount: number;
  currency: string;
  status: string;
  payment_method: PaymentMethod | null;
  description: string | null;
  created_at: string;
}

export interface Invoice {
  id: string;
  number: string;
  amount_due: number;
  amount_paid: number;
  currency: string;
  status: string;
  hosted_invoice_url: string | null;
  invoice_pdf: string | null;
  created: string;
  period_start: string | null;
  period_end: string | null;
}

export interface UsageLimitCheck {
  allowed: boolean;
  current_usage: number;
  max_limit: number;
  usage_type: string;
}

export interface StripeConfig {
  publishable_key: string | null;
  is_configured: boolean;
}

// =============================================================================
// API FUNCTIONS
// =============================================================================

/**
 * Get all available subscription plans.
 */
export async function getPlans(): Promise<SubscriptionPlan[]> {
  const response = await api.get('/subscription/plans');
  return response.data;
}

/**
 * Get a specific subscription plan.
 */
export async function getPlan(planId: number): Promise<SubscriptionPlan> {
  const response = await api.get(`/subscription/plans/${planId}`);
  return response.data;
}

/**
 * Get current user's subscription summary.
 */
export async function getMySubscription(): Promise<SubscriptionSummary> {
  const response = await api.get('/subscription/me');
  return response.data;
}

/**
 * Subscribe to a plan.
 */
export async function subscribe(
  planId: number,
  billingInterval: BillingInterval = 'monthly',
  paymentMethodId?: string
): Promise<{
  subscription: Subscription;
  client_secret: string | null;
  requires_payment: boolean;
}> {
  const response = await api.post('/subscription/subscribe', {
    plan_id: planId,
    billing_interval: billingInterval,
    payment_method_id: paymentMethodId
  });
  return response.data;
}

/**
 * Cancel current subscription.
 */
export async function cancelSubscription(immediately: boolean = false): Promise<{
  message: string;
  immediately: boolean;
}> {
  const response = await api.post('/subscription/cancel', null, {
    params: { immediately }
  });
  return response.data;
}

/**
 * Reactivate a canceled subscription.
 */
export async function reactivateSubscription(): Promise<{ message: string }> {
  const response = await api.post('/subscription/reactivate');
  return response.data;
}

/**
 * Change to a different subscription plan.
 */
export async function changePlan(
  planId: number,
  billingInterval?: BillingInterval
): Promise<{ message: string }> {
  const response = await api.post('/subscription/change-plan', {
    plan_id: planId,
    billing_interval: billingInterval
  });
  return response.data;
}

/**
 * Get current usage statistics.
 */
export async function getUsage(): Promise<{
  usage: UsageStats;
  limits: PlanLimits;
  percentages: Record<string, number>;
}> {
  const response = await api.get('/subscription/usage');
  return response.data;
}

/**
 * Check if an action is allowed within usage limits.
 */
export async function checkUsageLimit(
  usageType: string,
  additional: number = 1
): Promise<UsageLimitCheck> {
  const response = await api.get(`/subscription/usage/check/${usageType}`, {
    params: { additional }
  });
  return response.data;
}

/**
 * Check if user has access to a feature.
 */
export async function checkFeature(featureName: string): Promise<{
  feature: string;
  has_access: boolean;
}> {
  const response = await api.get(`/subscription/features/${featureName}`);
  return response.data;
}

/**
 * Get list of AI models user can access.
 */
export async function getAllowedModels(): Promise<{ models: string[] }> {
  const response = await api.get('/subscription/models');
  return response.data;
}

/**
 * Create a Stripe Checkout session.
 */
export async function createCheckoutSession(
  planId: number,
  billingInterval: BillingInterval,
  successUrl: string,
  cancelUrl: string
): Promise<{ checkout_url: string }> {
  const response = await api.post('/subscription/checkout', {
    plan_id: planId,
    billing_interval: billingInterval,
    success_url: successUrl,
    cancel_url: cancelUrl
  });
  return response.data;
}

/**
 * Get Stripe Billing Portal URL.
 */
export async function getBillingPortal(returnUrl: string): Promise<{ portal_url: string }> {
  const response = await api.get('/subscription/billing-portal', {
    params: { return_url: returnUrl }
  });
  return response.data;
}

/**
 * Get user's payment methods.
 */
export async function getPaymentMethods(): Promise<{ payment_methods: PaymentMethod[] }> {
  const response = await api.get('/subscription/payment-methods');
  return response.data;
}

/**
 * Create a SetupIntent for adding a payment method.
 */
export async function createSetupIntent(): Promise<{ client_secret: string }> {
  const response = await api.post('/subscription/setup-intent');
  return response.data;
}

/**
 * Get payment history.
 */
export async function getPaymentHistory(limit: number = 20): Promise<{ payments: Payment[] }> {
  const response = await api.get('/subscription/payments', {
    params: { limit }
  });
  return response.data;
}

/**
 * Get invoices.
 */
export async function getInvoices(limit: number = 20): Promise<{ invoices: Invoice[] }> {
  const response = await api.get('/subscription/invoices', {
    params: { limit }
  });
  return response.data;
}

/**
 * Get Stripe configuration for frontend.
 */
export async function getStripeConfig(): Promise<StripeConfig> {
  const response = await api.get('/subscription/config');
  return response.data;
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Format price for display.
 */
export function formatPrice(amount: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency
  }).format(amount);
}

/**
 * Get tier badge color.
 */
export function getTierColor(tier: string): string {
  const colors: Record<string, string> = {
    free: 'gray',
    starter: 'blue',
    professional: 'purple',
    team: 'orange',
    enterprise: 'red'
  };
  return colors[tier] || 'gray';
}

/**
 * Get status badge color.
 */
export function getStatusColor(status: SubscriptionStatus): string {
  const colors: Record<string, string> = {
    active: 'green',
    trialing: 'blue',
    past_due: 'yellow',
    canceled: 'red',
    unpaid: 'red',
    paused: 'gray'
  };
  return colors[status] || 'gray';
}

/**
 * Calculate savings percentage for yearly billing.
 */
export function calculateYearlySavings(monthly: number, yearly: number): number {
  const monthlyTotal = monthly * 12;
  if (monthlyTotal === 0) return 0;
  return Math.round(((monthlyTotal - yearly) / monthlyTotal) * 100);
}

/**
 * Check if a limit is unlimited (-1).
 */
export function isUnlimited(limit: number): boolean {
  return limit === -1;
}

/**
 * Format limit for display.
 */
export function formatLimit(limit: number): string {
  if (isUnlimited(limit)) return 'Unlimited';
  return limit.toLocaleString();
}
