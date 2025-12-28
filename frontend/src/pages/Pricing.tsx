/**
 * Pricing Page Component
 * 
 * Displays subscription plans with pricing and features comparison.
 * 
 * Version: 2.3.0
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Check,
  X,
  Zap,
  Crown,
  Building2,
  Rocket,
  Sparkles,
  ArrowRight,
  Loader2
} from 'lucide-react';
import {
  getPlans,
  getMySubscription,
  createCheckoutSession,
  SubscriptionPlan,
  SubscriptionSummary,
  BillingInterval,
  formatPrice,
  getTierColor,
  calculateYearlySavings,
  isUnlimited,
  formatLimit
} from '../lib/subscription-api';

// =============================================================================
// TYPES
// =============================================================================

interface PricingCardProps {
  plan: SubscriptionPlan;
  billingInterval: BillingInterval;
  currentPlan: SubscriptionPlan | null;
  onSelect: (plan: SubscriptionPlan) => void;
  isLoading: boolean;
}

// =============================================================================
// COMPONENTS
// =============================================================================

const PricingCard: React.FC<PricingCardProps> = ({
  plan,
  billingInterval,
  currentPlan,
  onSelect,
  isLoading
}) => {
  const price = billingInterval === 'monthly' ? plan.price_monthly : plan.price_yearly;
  const monthlyEquivalent = billingInterval === 'yearly' ? plan.price_yearly / 12 : plan.price_monthly;
  const savings = calculateYearlySavings(plan.price_monthly, plan.price_yearly);
  const isCurrentPlan = currentPlan?.id === plan.id;
  const isEnterprise = plan.tier === 'enterprise';
  
  const tierIcons: Record<string, React.ReactNode> = {
    free: <Sparkles className="w-6 h-6" />,
    starter: <Rocket className="w-6 h-6" />,
    professional: <Zap className="w-6 h-6" />,
    team: <Crown className="w-6 h-6" />,
    enterprise: <Building2 className="w-6 h-6" />
  };
  
  const tierColors: Record<string, string> = {
    free: 'border-gray-200 bg-gray-50',
    starter: 'border-blue-200 bg-blue-50',
    professional: 'border-purple-200 bg-purple-50 ring-2 ring-purple-500',
    team: 'border-orange-200 bg-orange-50',
    enterprise: 'border-red-200 bg-red-50'
  };
  
  const buttonColors: Record<string, string> = {
    free: 'bg-gray-600 hover:bg-gray-700',
    starter: 'bg-blue-600 hover:bg-blue-700',
    professional: 'bg-purple-600 hover:bg-purple-700',
    team: 'bg-orange-600 hover:bg-orange-700',
    enterprise: 'bg-red-600 hover:bg-red-700'
  };
  
  return (
    <div className={`relative rounded-2xl border-2 p-6 ${tierColors[plan.tier]} ${plan.is_featured ? 'scale-105 shadow-xl' : 'shadow-lg'}`}>
      {plan.is_featured && (
        <div className="absolute -top-4 left-1/2 -translate-x-1/2">
          <span className="bg-purple-600 text-white text-sm font-semibold px-4 py-1 rounded-full">
            Most Popular
          </span>
        </div>
      )}
      
      <div className="flex items-center gap-3 mb-4">
        <div className={`p-2 rounded-lg bg-${getTierColor(plan.tier)}-100`}>
          {tierIcons[plan.tier]}
        </div>
        <div>
          <h3 className="text-xl font-bold text-gray-900">{plan.display_name}</h3>
          <p className="text-sm text-gray-600">{plan.description}</p>
        </div>
      </div>
      
      <div className="mb-6">
        {isEnterprise ? (
          <div className="text-3xl font-bold text-gray-900">Custom</div>
        ) : (
          <>
            <div className="flex items-baseline gap-1">
              <span className="text-4xl font-bold text-gray-900">
                {formatPrice(monthlyEquivalent)}
              </span>
              <span className="text-gray-600">/month</span>
            </div>
            {billingInterval === 'yearly' && savings > 0 && (
              <div className="text-sm text-green-600 font-medium mt-1">
                Save {savings}% with yearly billing
              </div>
            )}
            {plan.trial_days > 0 && (
              <div className="text-sm text-blue-600 font-medium mt-1">
                {plan.trial_days}-day free trial
              </div>
            )}
          </>
        )}
      </div>
      
      <button
        onClick={() => onSelect(plan)}
        disabled={isLoading || isCurrentPlan}
        className={`w-full py-3 px-4 rounded-lg text-white font-semibold transition-colors flex items-center justify-center gap-2 ${
          isCurrentPlan
            ? 'bg-gray-400 cursor-not-allowed'
            : buttonColors[plan.tier]
        }`}
      >
        {isLoading ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : isCurrentPlan ? (
          'Current Plan'
        ) : isEnterprise ? (
          <>Contact Sales <ArrowRight className="w-4 h-4" /></>
        ) : (
          <>Get Started <ArrowRight className="w-4 h-4" /></>
        )}
      </button>
      
      <div className="mt-6 space-y-3">
        <h4 className="font-semibold text-gray-900">Includes:</h4>
        
        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-green-600" />
            <span>{formatLimit(plan.limits.max_projects)} projects</span>
          </div>
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-green-600" />
            <span>{formatLimit(plan.limits.max_chats_per_day)} chats/day</span>
          </div>
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-green-600" />
            <span>{formatLimit(plan.limits.max_tokens_per_month)} tokens/month</span>
          </div>
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-green-600" />
            <span>{formatLimit(plan.limits.max_file_storage_mb)} MB storage</span>
          </div>
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-green-600" />
            <span>{formatLimit(plan.limits.max_team_members)} team members</span>
          </div>
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-green-600" />
            <span>{plan.features.ai_models.length} AI models</span>
          </div>
        </div>
        
        <div className="pt-3 border-t border-gray-200 space-y-2 text-sm">
          {plan.features.plugins_enabled ? (
            <div className="flex items-center gap-2 text-green-700">
              <Check className="w-4 h-4" />
              <span>Plugins</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-gray-400">
              <X className="w-4 h-4" />
              <span>Plugins</span>
            </div>
          )}
          
          {plan.features.comparison_enabled ? (
            <div className="flex items-center gap-2 text-green-700">
              <Check className="w-4 h-4" />
              <span>Model Comparison</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-gray-400">
              <X className="w-4 h-4" />
              <span>Model Comparison</span>
            </div>
          )}
          
          {plan.features.realtime_enabled ? (
            <div className="flex items-center gap-2 text-green-700">
              <Check className="w-4 h-4" />
              <span>Real-time Collaboration</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-gray-400">
              <X className="w-4 h-4" />
              <span>Real-time Collaboration</span>
            </div>
          )}
          
          {plan.features.team_features ? (
            <div className="flex items-center gap-2 text-green-700">
              <Check className="w-4 h-4" />
              <span>Team Features</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-gray-400">
              <X className="w-4 h-4" />
              <span>Team Features</span>
            </div>
          )}
          
          {plan.features.priority_support ? (
            <div className="flex items-center gap-2 text-green-700">
              <Check className="w-4 h-4" />
              <span>Priority Support</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-gray-400">
              <X className="w-4 h-4" />
              <span>Priority Support</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// =============================================================================
// MAIN COMPONENT
// =============================================================================

const Pricing: React.FC = () => {
  const navigate = useNavigate();
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [subscription, setSubscription] = useState<SubscriptionSummary | null>(null);
  const [billingInterval, setBillingInterval] = useState<BillingInterval>('monthly');
  const [loading, setLoading] = useState(true);
  const [selectingPlan, setSelectingPlan] = useState<number | null>(null);
  
  useEffect(() => {
    loadData();
  }, []);
  
  const loadData = async () => {
    try {
      const [plansData, subData] = await Promise.all([
        getPlans(),
        getMySubscription()
      ]);
      setPlans(plansData);
      setSubscription(subData);
    } catch (error) {
      console.error('Failed to load pricing data:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const handleSelectPlan = async (plan: SubscriptionPlan) => {
    if (plan.tier === 'enterprise') {
      // Redirect to contact page for enterprise
      window.open('mailto:sales@ue5-ai-studio.com?subject=Enterprise Plan Inquiry', '_blank');
      return;
    }
    
    if (plan.tier === 'free') {
      // Free plan doesn't need checkout
      navigate('/settings/subscription');
      return;
    }
    
    setSelectingPlan(plan.id);
    
    try {
      const { checkout_url } = await createCheckoutSession(
        plan.id,
        billingInterval,
        `${window.location.origin}/settings/subscription?success=true`,
        `${window.location.origin}/pricing?canceled=true`
      );
      
      if (checkout_url) {
        window.location.href = checkout_url;
      } else {
        // Stripe not configured, redirect to subscription settings
        navigate('/settings/subscription');
      }
    } catch (error) {
      console.error('Failed to create checkout session:', error);
      alert('Failed to start checkout. Please try again.');
    } finally {
      setSelectingPlan(null);
    }
  };
  
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white py-12 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Choose Your Plan
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Scale your UE5 development with AI-powered tools. Start free and upgrade as you grow.
          </p>
        </div>
        
        {/* Billing Toggle */}
        <div className="flex items-center justify-center gap-4 mb-12">
          <span className={`text-sm font-medium ${billingInterval === 'monthly' ? 'text-gray-900' : 'text-gray-500'}`}>
            Monthly
          </span>
          <button
            onClick={() => setBillingInterval(billingInterval === 'monthly' ? 'yearly' : 'monthly')}
            className={`relative w-14 h-7 rounded-full transition-colors ${
              billingInterval === 'yearly' ? 'bg-purple-600' : 'bg-gray-300'
            }`}
          >
            <div className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow transition-transform ${
              billingInterval === 'yearly' ? 'translate-x-8' : 'translate-x-1'
            }`} />
          </button>
          <span className={`text-sm font-medium ${billingInterval === 'yearly' ? 'text-gray-900' : 'text-gray-500'}`}>
            Yearly
          </span>
          {billingInterval === 'yearly' && (
            <span className="bg-green-100 text-green-700 text-xs font-semibold px-2 py-1 rounded-full">
              Save up to 17%
            </span>
          )}
        </div>
        
        {/* Current Plan Banner */}
        {subscription?.plan && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-8 text-center">
            <p className="text-blue-800">
              You're currently on the <strong>{subscription.plan.display_name}</strong> plan.
              {subscription.is_trialing && (
                <span className="ml-2 text-blue-600">
                  (Trial ends in {subscription.days_remaining} days)
                </span>
              )}
            </p>
          </div>
        )}
        
        {/* Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
          {plans.map(plan => (
            <PricingCard
              key={plan.id}
              plan={plan}
              billingInterval={billingInterval}
              currentPlan={subscription?.plan || null}
              onSelect={handleSelectPlan}
              isLoading={selectingPlan === plan.id}
            />
          ))}
        </div>
        
        {/* FAQ Section */}
        <div className="mt-16 max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold text-gray-900 text-center mb-8">
            Frequently Asked Questions
          </h2>
          
          <div className="space-y-6">
            <div className="bg-white rounded-lg p-6 shadow-sm border">
              <h3 className="font-semibold text-gray-900 mb-2">
                Can I change my plan later?
              </h3>
              <p className="text-gray-600">
                Yes! You can upgrade or downgrade your plan at any time. Changes take effect immediately, and we'll prorate any differences.
              </p>
            </div>
            
            <div className="bg-white rounded-lg p-6 shadow-sm border">
              <h3 className="font-semibold text-gray-900 mb-2">
                What happens when I hit my usage limits?
              </h3>
              <p className="text-gray-600">
                You'll receive a notification when you're approaching your limits. You can either upgrade your plan or wait for the next billing cycle when limits reset.
              </p>
            </div>
            
            <div className="bg-white rounded-lg p-6 shadow-sm border">
              <h3 className="font-semibold text-gray-900 mb-2">
                Do you offer refunds?
              </h3>
              <p className="text-gray-600">
                Yes, we offer a 14-day money-back guarantee for all paid plans. If you're not satisfied, contact our support team for a full refund.
              </p>
            </div>
            
            <div className="bg-white rounded-lg p-6 shadow-sm border">
              <h3 className="font-semibold text-gray-900 mb-2">
                What payment methods do you accept?
              </h3>
              <p className="text-gray-600">
                We accept all major credit cards (Visa, MasterCard, American Express) through our secure Stripe payment processing.
              </p>
            </div>
          </div>
        </div>
        
        {/* CTA */}
        <div className="mt-16 text-center">
          <p className="text-gray-600 mb-4">
            Have questions? Need a custom plan?
          </p>
          <a
            href="mailto:support@ue5-ai-studio.com"
            className="inline-flex items-center gap-2 text-purple-600 hover:text-purple-700 font-semibold"
          >
            Contact our team <ArrowRight className="w-4 h-4" />
          </a>
        </div>
      </div>
    </div>
  );
};

export default Pricing;
