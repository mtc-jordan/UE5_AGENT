/**
 * Subscription Settings Page Component
 * 
 * Manages subscription, billing, and payment methods.
 * 
 * Version: 2.3.0
 */

import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  CreditCard,
  FileText,
  Settings,
  AlertTriangle,
  Check,
  X,
  ExternalLink,
  Loader2,
  RefreshCw,
  Crown,
  Zap
} from 'lucide-react';
import {
  getMySubscription,
  getPaymentMethods,
  getPaymentHistory,
  getInvoices,
  getBillingPortal,
  cancelSubscription,
  reactivateSubscription,
  SubscriptionSummary,
  PaymentMethod,
  Payment,
  Invoice,
  formatPrice,
  getStatusColor,
  getTierColor
} from '../lib/subscription-api';

// =============================================================================
// COMPONENTS
// =============================================================================

const UsageBar: React.FC<{ label: string; current: number; max: number; unit?: string }> = ({
  label,
  current,
  max,
  unit = ''
}) => {
  const percentage = max === -1 ? 0 : Math.min(100, (current / max) * 100);
  const isUnlimited = max === -1;
  
  return (
    <div className="mb-4">
      <div className="flex justify-between text-sm mb-1">
        <span className="text-gray-600">{label}</span>
        <span className="text-gray-900 font-medium">
          {current.toLocaleString()}{unit} / {isUnlimited ? '∞' : max.toLocaleString()}{unit}
        </span>
      </div>
      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${
            percentage > 90 ? 'bg-red-500' : percentage > 70 ? 'bg-yellow-500' : 'bg-green-500'
          }`}
          style={{ width: isUnlimited ? '0%' : `${percentage}%` }}
        />
      </div>
    </div>
  );
};

// =============================================================================
// MAIN COMPONENT
// =============================================================================

const SubscriptionSettings: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<'overview' | 'billing' | 'invoices'>('overview');
  const [subscription, setSubscription] = useState<SubscriptionSummary | null>(null);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  
  useEffect(() => {
    loadData();
    
    // Check for success/canceled params
    if (searchParams.get('success') === 'true') {
      // Show success message
      alert('Subscription activated successfully!');
    }
  }, [searchParams]);
  
  const loadData = async () => {
    try {
      const [subData, methodsData, paymentsData, invoicesData] = await Promise.all([
        getMySubscription(),
        getPaymentMethods().catch(() => ({ payment_methods: [] })),
        getPaymentHistory().catch(() => ({ payments: [] })),
        getInvoices().catch(() => ({ invoices: [] }))
      ]);
      
      setSubscription(subData);
      setPaymentMethods(methodsData.payment_methods);
      setPayments(paymentsData.payments);
      setInvoices(invoicesData.invoices);
    } catch (error) {
      console.error('Failed to load subscription data:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const handleManageBilling = async () => {
    setActionLoading(true);
    try {
      const { portal_url } = await getBillingPortal(window.location.href);
      if (portal_url) {
        window.location.href = portal_url;
      }
    } catch (error) {
      console.error('Failed to open billing portal:', error);
      alert('Billing portal is not available. Stripe may not be configured.');
    } finally {
      setActionLoading(false);
    }
  };
  
  const handleCancelSubscription = async () => {
    setActionLoading(true);
    try {
      await cancelSubscription(false);
      await loadData();
      setShowCancelModal(false);
      alert('Your subscription will be canceled at the end of the billing period.');
    } catch (error) {
      console.error('Failed to cancel subscription:', error);
      alert('Failed to cancel subscription. Please try again.');
    } finally {
      setActionLoading(false);
    }
  };
  
  const handleReactivate = async () => {
    setActionLoading(true);
    try {
      await reactivateSubscription();
      await loadData();
      alert('Subscription reactivated successfully!');
    } catch (error) {
      console.error('Failed to reactivate subscription:', error);
      alert('Failed to reactivate subscription. Please try again.');
    } finally {
      setActionLoading(false);
    }
  };
  
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
      </div>
    );
  }
  
  const plan = subscription?.plan;
  const usage = subscription?.usage || {};
  const limits = subscription?.limits || {};
  
  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Subscription</h1>
          <p className="text-gray-600 mt-1">Manage your plan, billing, and usage</p>
        </div>
        
        {/* Tabs */}
        <div className="flex gap-4 mb-6 border-b">
          <button
            onClick={() => setActiveTab('overview')}
            className={`pb-3 px-1 font-medium transition-colors ${
              activeTab === 'overview'
                ? 'text-purple-600 border-b-2 border-purple-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab('billing')}
            className={`pb-3 px-1 font-medium transition-colors ${
              activeTab === 'billing'
                ? 'text-purple-600 border-b-2 border-purple-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Billing
          </button>
          <button
            onClick={() => setActiveTab('invoices')}
            className={`pb-3 px-1 font-medium transition-colors ${
              activeTab === 'invoices'
                ? 'text-purple-600 border-b-2 border-purple-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Invoices
          </button>
        </div>
        
        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Current Plan Card */}
            <div className="bg-white rounded-xl shadow-sm border p-6">
              <div className="flex items-start justify-between mb-6">
                <div className="flex items-center gap-4">
                  <div className={`p-3 rounded-xl bg-${getTierColor(plan?.tier || 'free')}-100`}>
                    {plan?.tier === 'professional' ? (
                      <Zap className="w-8 h-8 text-purple-600" />
                    ) : (
                      <Crown className="w-8 h-8 text-gray-600" />
                    )}
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900">
                      {plan?.display_name || 'Free'} Plan
                    </h2>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium bg-${getStatusColor(subscription?.subscription?.status || 'active')}-100 text-${getStatusColor(subscription?.subscription?.status || 'active')}-700`}>
                        {subscription?.subscription?.status || 'active'}
                      </span>
                      {subscription?.is_trialing && (
                        <span className="text-sm text-blue-600">
                          Trial ends in {subscription.days_remaining} days
                        </span>
                      )}
                      {subscription?.subscription?.cancel_at_period_end && (
                        <span className="text-sm text-red-600">
                          Cancels at period end
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                
                <div className="flex gap-2">
                  {subscription?.subscription?.cancel_at_period_end ? (
                    <button
                      onClick={handleReactivate}
                      disabled={actionLoading}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
                    >
                      {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                      Reactivate
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={() => navigate('/pricing')}
                        className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                      >
                        {plan?.tier === 'free' ? 'Upgrade' : 'Change Plan'}
                      </button>
                      {plan?.tier !== 'free' && (
                        <button
                          onClick={() => setShowCancelModal(true)}
                          className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                        >
                          Cancel
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
              
              {/* Billing Period */}
              {subscription?.subscription?.current_period_end && (
                <div className="bg-gray-50 rounded-lg p-4 mb-6">
                  <p className="text-sm text-gray-600">
                    Current billing period ends on{' '}
                    <strong>
                      {new Date(subscription.subscription.current_period_end).toLocaleDateString()}
                    </strong>
                  </p>
                </div>
              )}
              
              {/* Usage Stats */}
              <h3 className="font-semibold text-gray-900 mb-4">Usage This Period</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
                <UsageBar
                  label="Chats"
                  current={usage.chats || 0}
                  max={limits.max_chats_per_day || 0}
                />
                <UsageBar
                  label="Tokens"
                  current={usage.tokens || 0}
                  max={limits.max_tokens_per_month || 0}
                />
                <UsageBar
                  label="Comparisons"
                  current={usage.comparisons || 0}
                  max={limits.max_comparisons_per_day || 0}
                />
                <UsageBar
                  label="Storage"
                  current={usage.file_storage_mb || 0}
                  max={limits.max_file_storage_mb || 0}
                  unit=" MB"
                />
              </div>
            </div>
            
            {/* Features Card */}
            <div className="bg-white rounded-xl shadow-sm border p-6">
              <h3 className="font-semibold text-gray-900 mb-4">Plan Features</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {Object.entries(subscription?.features || {}).map(([key, value]) => (
                  <div key={key} className="flex items-center gap-2">
                    {value ? (
                      <Check className="w-4 h-4 text-green-600" />
                    ) : (
                      <X className="w-4 h-4 text-gray-400" />
                    )}
                    <span className={value ? 'text-gray-900' : 'text-gray-400'}>
                      {key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
        
        {/* Billing Tab */}
        {activeTab === 'billing' && (
          <div className="space-y-6">
            {/* Payment Methods */}
            <div className="bg-white rounded-xl shadow-sm border p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-900">Payment Methods</h3>
                <button
                  onClick={handleManageBilling}
                  disabled={actionLoading}
                  className="text-purple-600 hover:text-purple-700 text-sm font-medium flex items-center gap-1"
                >
                  {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Settings className="w-4 h-4" />}
                  Manage
                </button>
              </div>
              
              {paymentMethods.length > 0 ? (
                <div className="space-y-3">
                  {paymentMethods.map(method => (
                    <div key={method.id} className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
                      <CreditCard className="w-6 h-6 text-gray-600" />
                      <div>
                        <p className="font-medium text-gray-900">
                          {method.card?.brand?.toUpperCase()} •••• {method.card?.last4}
                        </p>
                        <p className="text-sm text-gray-500">
                          Expires {method.card?.exp_month}/{method.card?.exp_year}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-center py-4">
                  No payment methods on file
                </p>
              )}
            </div>
            
            {/* Recent Payments */}
            <div className="bg-white rounded-xl shadow-sm border p-6">
              <h3 className="font-semibold text-gray-900 mb-4">Recent Payments</h3>
              
              {payments.length > 0 ? (
                <div className="space-y-3">
                  {payments.map(payment => (
                    <div key={payment.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className={`w-2 h-2 rounded-full ${
                          payment.status === 'succeeded' ? 'bg-green-500' : 'bg-red-500'
                        }`} />
                        <div>
                          <p className="font-medium text-gray-900">
                            {formatPrice(payment.amount, payment.currency)}
                          </p>
                          <p className="text-sm text-gray-500">
                            {payment.description || 'Subscription payment'}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-gray-500">
                          {new Date(payment.created_at).toLocaleDateString()}
                        </p>
                        <p className={`text-xs ${
                          payment.status === 'succeeded' ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {payment.status}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-center py-4">
                  No payment history
                </p>
              )}
            </div>
          </div>
        )}
        
        {/* Invoices Tab */}
        {activeTab === 'invoices' && (
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Invoices</h3>
            
            {invoices.length > 0 ? (
              <div className="space-y-3">
                {invoices.map(invoice => (
                  <div key={invoice.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-4">
                      <FileText className="w-6 h-6 text-gray-600" />
                      <div>
                        <p className="font-medium text-gray-900">
                          Invoice #{invoice.number}
                        </p>
                        <p className="text-sm text-gray-500">
                          {new Date(invoice.created).toLocaleDateString()} • {formatPrice(invoice.amount_due, invoice.currency)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        invoice.status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                      }`}>
                        {invoice.status}
                      </span>
                      {invoice.hosted_invoice_url && (
                        <a
                          href={invoice.hosted_invoice_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-purple-600 hover:text-purple-700"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      )}
                      {invoice.invoice_pdf && (
                        <a
                          href={invoice.invoice_pdf}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-gray-600 hover:text-gray-700"
                        >
                          PDF
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-4">
                No invoices yet
              </p>
            )}
          </div>
        )}
        
        {/* Cancel Modal */}
        {showCancelModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-red-100 rounded-full">
                  <AlertTriangle className="w-6 h-6 text-red-600" />
                </div>
                <h3 className="text-xl font-bold text-gray-900">Cancel Subscription?</h3>
              </div>
              
              <p className="text-gray-600 mb-6">
                Your subscription will remain active until the end of your current billing period. After that, you'll be downgraded to the Free plan.
              </p>
              
              <div className="flex gap-3">
                <button
                  onClick={() => setShowCancelModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Keep Subscription
                </button>
                <button
                  onClick={handleCancelSubscription}
                  disabled={actionLoading}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center justify-center gap-2"
                >
                  {actionLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                  Cancel Subscription
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SubscriptionSettings;
