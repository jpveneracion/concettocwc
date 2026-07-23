'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AppLayout from '@/components/AppLayout';
import type { SubscriptionDetails } from '@/types/subscription';

type LoadingState = 'idle' | 'loading' | 'success' | 'error';
type BillingPeriod = 'monthly' | 'quarterly' | 'annual';

interface PricingData {
  base_price: number;
  period_months: number;
  base_total: number;
  period_discount_percent: number;
  period_discount_amount: number;
  price_after_period_discount: number;
  promo_discount_percent?: number;
  promo_discount_amount?: number;
  final_price: number;
  billing_period: BillingPeriod;
  calculated_at: string;
}

type WarningBanner = {
  type: 'trial-ending' | 'payment-failed' | 'cancelled-grace' | 'payment-expiring';
  message: string;
  priority: 'high' | 'medium' | 'low';
};

export default function SubscriptionPage() {
  const router = useRouter();
  const [subscription, setSubscription] = useState<SubscriptionDetails | null>(null);
  const [loadingState, setLoadingState] = useState<LoadingState>('loading');
  const [error, setError] = useState<string | null>(null);
  const [warningBanners, setWarningBanners] = useState<WarningBanner[]>([]);
  const [cancelling, setCancelling] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  // New pricing system state
  const [pricingData, setPricingData] = useState<PricingData | null>(null);
  const [billingPeriod, setBillingPeriod] = useState<BillingPeriod>('monthly');
  const [loadingPricing, setLoadingPricing] = useState(false);
  const [allPricingOptions, setAllPricingOptions] = useState<Record<BillingPeriod, PricingData | null>>({
    monthly: null,
    quarterly: null,
    annual: null
  });

  useEffect(() => {
    fetchSubscriptionDetails();
  }, []);

  async function fetchSubscriptionDetails() {
    try {
      setLoadingState('loading');
      setError(null);

      const response = await fetch('/api/account/subscription');
      const data = await response.json();

      if (!response.ok) {
        if (response.status === 404) {
          // No subscription found - redirect to checkout
          router.push('/subscription/checkout');
          return;
        }
        if (response.status === 401) {
          setError('Authentication required. Please log in again.');
          setLoadingState('error');
          return;
        }
        throw new Error(data.error || 'Failed to load subscription details');
      }

      setSubscription(data);
      setLoadingState('success');
      generateWarningBanners(data);
    } catch (err) {
      console.error('Subscription fetch error:', err);
      setError(err instanceof Error ? err.message : 'Failed to load subscription details');
      setLoadingState('error');
    }
  }

  function generateWarningBanners(sub: SubscriptionDetails) {
    const banners: WarningBanner[] = [];
    const now = new Date();

    // Trial ending soon
    if (sub.status === 'trialing' && sub.trial_end) {
      const trialEndDate = new Date(sub.trial_end);
      const daysUntilTrialEnd = Math.ceil((trialEndDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      if (daysUntilTrialEnd <= 2) {
        banners.push({
          type: 'trial-ending',
          message: `Your trial ends in ${daysUntilTrialEnd === 0 ? 'less than 24 hours' : `${daysUntilTrialEnd} day${daysUntilTrialEnd === 1 ? '' : 's'}`}. Upgrade now to maintain access.`,
          priority: 'high'
        });
      }
    }

    // Payment failed / past due
    if (sub.status === 'past_due') {
      banners.push({
        type: 'payment-failed',
        message: 'Payment failed. Please update your payment method to avoid service interruption.',
        priority: 'high'
      });
    }

    // Subscription cancelled with grace period
    if (sub.cancel_at_period_end && sub.current_period_end) {
      const gracePeriodEnd = new Date(sub.current_period_end);
      const daysUntilExpiry = Math.ceil((gracePeriodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      banners.push({
        type: 'cancelled-grace',
        message: `Your subscription has been cancelled. Access will end on ${gracePeriodEnd.toLocaleDateString()}.`,
        priority: 'medium'
      });
    }

    setWarningBanners(banners);
  }

  async function handleCancelSubscription() {
    try {
      setCancelling(true);

      const response = await fetch('/api/account/subscription/cancel', {
        method: 'POST'
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to cancel subscription');
      }

      // Refresh subscription details
      await fetchSubscriptionDetails();
      setShowCancelConfirm(false);
    } catch (err) {
      console.error('Cancel subscription error:', err);
      setError(err instanceof Error ? err.message : 'Failed to cancel subscription');
    } finally {
      setCancelling(false);
    }
  }

  function handleUpdatePlan() {
    router.push('/subscription/checkout');
  }

  function handleUpdatePayment() {
    // TODO: Implement payment method update flow
    setError('Payment method update not yet implemented');
  }

  function getStatusBadgeClass(status: string): string {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'trialing':
        return 'bg-blue-100 text-blue-800';
      case 'past_due':
        return 'bg-red-100 text-red-800';
      case 'cancelled':
      case 'suspended':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  }

  function formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
      minimumFractionDigits: 0
    }).format(amount);
  }

  function getPlanName(planId: string): string {
    if (planId === 'basic') return 'Basic';
    if (planId === 'pro') return 'Pro';
    return planId.charAt(0).toUpperCase() + planId.slice(1);
  }

  function getPlanPrice(planId: string): number {
    if (planId === 'basic') return 499;
    if (planId === 'pro') return 999;
    return 0;
  }

  function getQuotesLimit(sub: SubscriptionDetails): string {
    if (sub.plan.id === 'pro') return 'Unlimited';
    return sub.usage_stats.quotes_remaining.toString();
  }

  if (loadingState === 'loading') {
    return (
      <AppLayout>
        <div className="flex items-center justify-center p-12">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="mt-4 text-gray-500">Loading subscription details...</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  if (error && !subscription) {
    return (
      <AppLayout>
        <div className="p-6">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <h3 className="text-red-800 font-medium mb-2">Unable to load subscription</h3>
            <p className="text-red-600 text-sm mb-4">{error}</p>
            <button
              onClick={fetchSubscriptionDetails}
              className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700"
            >
              Try Again
            </button>
          </div>
        </div>
      </AppLayout>
    );
  }

  if (!subscription) {
    return (
      <AppLayout>
        <div className="p-6">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <p className="text-yellow-800">No subscription found. Redirecting to checkout...</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  const planName = getPlanName(subscription.plan.id);
  const planPrice = getPlanPrice(subscription.plan.id);
  const quotesLimit = getQuotesLimit(subscription);

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto">
        {/* Page Header */}
        <div className="mb-6">
          <h1 className="text-xl font-semibold mb-2">Subscription Management</h1>
          <p className="text-gray-500 text-sm">Manage your subscription, billing, and usage</p>
        </div>

        {/* Warning Banners */}
        {warningBanners.length > 0 && (
          <div className="space-y-3 mb-6">
            {warningBanners.map((banner, index) => (
              <div
                key={index}
                className={`flex items-start gap-3 p-4 rounded-lg border ${
                  banner.priority === 'high'
                    ? 'bg-red-50 border-red-200'
                    : banner.priority === 'medium'
                    ? 'bg-yellow-50 border-yellow-200'
                    : 'bg-blue-50 border-blue-200'
                }`}
              >
                <span className="text-xl">
                  {banner.priority === 'high' ? '⚠️' : banner.priority === 'medium' ? '📢' : 'ℹ️'}
                </span>
                <div className="flex-1">
                  <p className={`text-sm font-medium ${
                    banner.priority === 'high' ? 'text-red-800' :
                    banner.priority === 'medium' ? 'text-yellow-800' : 'text-blue-800'
                  }`}>
                    {banner.message}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Error Messages */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-800 text-sm">{error}</p>
          </div>
        )}

        {/* Current Plan Card */}
        <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-1">Current Plan</h2>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold text-gray-900">{planName}</span>
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusBadgeClass(subscription.status)}`}>
                  {subscription.status.charAt(0).toUpperCase() + subscription.status.slice(1)}
                </span>
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-gray-900">{formatCurrency(planPrice)}</div>
              <div className="text-gray-500 text-sm">per month</div>
            </div>
          </div>

          {/* Plan Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div>
              <h3 className="text-xs text-gray-500 mb-1">Billing Cycle</h3>
              <p className="text-sm text-gray-900">Monthly</p>
            </div>
            <div>
              <h3 className="text-xs text-gray-500 mb-1">Next Billing Date</h3>
              <p className="text-sm text-gray-900">
                {subscription.current_period_end
                  ? new Date(subscription.current_period_end).toLocaleDateString()
                  : 'N/A'}
              </p>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex flex-wrap gap-3">
            <button
              onClick={handleUpdatePlan}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
            >
              Upgrade Plan
            </button>
            <button
              onClick={() => setShowCancelConfirm(true)}
              disabled={subscription.cancel_at_period_end}
              className="px-4 py-2 border border-red-600 text-red-600 rounded-lg text-sm font-medium hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {subscription.cancel_at_period_end ? 'Cancellation Pending' : 'Cancel Subscription'}
            </button>
            <button
              onClick={handleUpdatePayment}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50"
            >
              Update Payment
            </button>
          </div>
        </div>

        {/* Usage Statistics */}
        <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Usage Statistics</h2>

          <div className="space-y-4">
            {/* Quotes Created */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-gray-600">Quotes created this period</span>
                <span className="text-sm font-medium text-gray-900">
                  {subscription.usage_stats.quotes_created_this_period}
                </span>
              </div>
              {subscription.plan.id !== 'pro' && (
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full"
                    style={{
                      width: `${Math.min(
                        (subscription.usage_stats.quotes_created_this_period / 50) * 100,
                        100
                      )}%`
                    }}
                  ></div>
                </div>
              )}
            </div>

            {/* Quotes Remaining */}
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Quotes remaining</span>
              <span className={`text-sm font-medium ${quotesLimit === 'Unlimited' ? 'text-green-600' : 'text-gray-900'}`}>
                {quotesLimit}
              </span>
            </div>

            {/* Trial Days Remaining */}
            {subscription.status === 'trialing' && subscription.trial_end && (
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Trial days remaining</span>
                <span className="text-sm font-medium text-blue-600">
                  {Math.ceil((new Date(subscription.trial_end).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Billing Summary */}
        <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Billing Summary</h2>

          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Current Plan</span>
              <span className="text-sm font-medium text-gray-900">{planName} Plan</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Billing Cycle</span>
              <span className="text-sm font-medium text-gray-900">Monthly</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Next Payment Amount</span>
              <span className="text-sm font-medium text-gray-900">{formatCurrency(planPrice)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Next Payment Date</span>
              <span className="text-sm font-medium text-gray-900">
                {subscription.current_period_end
                  ? new Date(subscription.current_period_end).toLocaleDateString()
                  : 'N/A'}
              </span>
            </div>
            <div className="border-t border-gray-200 pt-3">
              <button className="text-sm text-blue-600 hover:text-blue-700">
                View billing history →
              </button>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <button
              onClick={handleUpdatePlan}
              className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 text-left"
            >
              <span className="text-xl">⬆️</span>
              <div>
                <div className="text-sm font-medium text-gray-900">Upgrade/Downgrade Plan</div>
                <div className="text-xs text-gray-500">Change your subscription plan</div>
              </div>
            </button>

            <button
              onClick={() => setShowCancelConfirm(true)}
              disabled={subscription.cancel_at_period_end}
              className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 text-left disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span className="text-xl">❌</span>
              <div>
                <div className="text-sm font-medium text-gray-900">Cancel Subscription</div>
                <div className="text-xs text-gray-500">Cancel at the end of your billing period</div>
              </div>
            </button>

            <button
              onClick={handleUpdatePayment}
              className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 text-left"
            >
              <span className="text-xl">💳</span>
              <div>
                <div className="text-sm font-medium text-gray-900">Update Payment Method</div>
                <div className="text-xs text-gray-500">Add or change your payment method</div>
              </div>
            </button>

            <button className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 text-left">
              <span className="text-xl">📥</span>
              <div>
                <div className="text-sm font-medium text-gray-900">Download Invoice</div>
                <div className="text-xs text-gray-500">Get your latest invoice</div>
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* Cancel Confirmation Modal */}
      {showCancelConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Cancel Subscription</h3>
            <p className="text-sm text-gray-600 mb-4">
              Are you sure you want to cancel your subscription? You'll continue to have access until the end of your current billing period (
              {subscription.current_period_end
                ? new Date(subscription.current_period_end).toLocaleDateString()
                : 'N/A'}
              ).
            </p>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
              <p className="text-sm text-yellow-800">
                <strong>Important:</strong> After cancellation, you'll lose access to all premium features at the end of your billing period.
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowCancelConfirm(false)}
                disabled={cancelling}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
              >
                Keep Subscription
              </button>
              <button
                onClick={handleCancelSubscription}
                disabled={cancelling}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50"
              >
                {cancelling ? 'Cancelling...' : 'Confirm Cancellation'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}