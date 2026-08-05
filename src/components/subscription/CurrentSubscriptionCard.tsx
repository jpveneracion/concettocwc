'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { SubscriptionDetails } from '@/types/subscription';
import { SubscriptionPlanInterval } from '@/types/subscription';

type CardState = 'loading' | 'no-subscription' | 'error' | 'success';

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: 0
  }).format(amount);
}

function getBillingCycleLabel(interval: string): string {
  if (interval === SubscriptionPlanInterval.ANNUAL) return 'Annual';
  if (interval === SubscriptionPlanInterval.QUARTERLY) return 'Quarterly';
  return 'Monthly';
}

function getPeriodLabel(interval: string): string {
  if (interval === SubscriptionPlanInterval.ANNUAL) return 'per year';
  if (interval === SubscriptionPlanInterval.QUARTERLY) return 'per quarter';
  return 'per month';
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

export default function CurrentSubscriptionCard() {
  const [subscription, setSubscription] = useState<SubscriptionDetails | null>(null);
  const [state, setState] = useState<CardState>('loading');

  useEffect(() => {
    let cancelled = false;
    async function fetchSubscription() {
      try {
        const res = await fetch('/api/account/subscription');
        if (res.status === 404) {
          if (!cancelled) setState('no-subscription');
          return;
        }
        if (!res.ok) {
          if (res.status === 401) {
            if (!cancelled) setState('error');
            return;
          }
          throw new Error('Failed to load subscription');
        }
        const data = await res.json();
        if (!cancelled) {
          setSubscription(data);
          setState('success');
        }
      } catch {
        if (!cancelled) setState('error');
      }
    }
    fetchSubscription();
    return () => { cancelled = true; };
  }, []);

  if (state === 'loading') {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-6" aria-busy="true">
        <div className="h-4 w-32 bg-gray-200 rounded animate-pulse mb-4"></div>
        <div className="h-6 w-40 bg-gray-200 rounded animate-pulse mb-3"></div>
        <div className="h-4 w-full bg-gray-100 rounded animate-pulse mb-2"></div>
        <div className="h-4 w-2/3 bg-gray-100 rounded animate-pulse"></div>
      </div>
    );
  }

  if (state === 'error') {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <h2 className="text-sm font-semibold text-gray-900 mb-1">Current Subscription</h2>
        <p className="text-sm text-gray-500">Unable to load subscription details. Try again later.</p>
      </div>
    );
  }

  if (state === 'no-subscription' || !subscription) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <h2 className="text-sm font-semibold text-gray-900 mb-1">Current Subscription</h2>
        <p className="text-sm text-gray-600 mb-4">
          You don&apos;t have an active subscription yet. Choose a plan below to get started.
        </p>
        <Link
          href="/subscription/checkout"
          className="inline-flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-700"
        >
          Compare plans below ↓
        </Link>
      </div>
    );
  }

  const planName = subscription.plan?.name || 'Unknown Plan';
  const planPrice = subscription.plan?.price ?? 0;
  const billingCycleLabel = getBillingCycleLabel(subscription.plan?.interval || 'monthly');
  const periodLabel = getPeriodLabel(subscription.plan?.interval || 'monthly');
  const quotesLimit = subscription.usage_stats?.quotes_remaining === -1
    ? 'Unlimited'
    : String(subscription.usage_stats?.quotes_remaining ?? 0);

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-gray-900">Current Subscription</h2>
        <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${getStatusBadgeClass(subscription.status)}`}>
          {subscription.status.charAt(0).toUpperCase() + subscription.status.slice(1)}
        </span>
      </div>

      <div className="mb-4">
        <div className="text-lg font-bold text-gray-900">{planName} Plan</div>
        <div className="flex items-baseline gap-1 mt-1">
          <span className="text-2xl font-bold text-gray-900">{formatCurrency(planPrice)}</span>
          <span className="text-sm text-gray-500">{periodLabel}</span>
        </div>
      </div>

      <dl className="space-y-3 mb-5">
        <div className="flex items-center justify-between gap-2">
          <dt className="text-sm text-gray-500">Billing Cycle</dt>
          <dd className="text-sm font-medium text-gray-900">{billingCycleLabel}</dd>
        </div>
        <div className="flex items-center justify-between gap-2">
          <dt className="text-sm text-gray-500">Next Billing Date</dt>
          <dd className="text-sm font-medium text-gray-900">
            {subscription.current_period_end
              ? new Date(subscription.current_period_end).toLocaleDateString()
              : 'N/A'}
          </dd>
        </div>
        <div className="flex items-center justify-between gap-2">
          <dt className="text-sm text-gray-500">Quotes Remaining</dt>
          <dd className={`text-sm font-medium ${quotesLimit === 'Unlimited' ? 'text-green-600' : 'text-gray-900'}`}>
            {quotesLimit}
          </dd>
        </div>
      </dl>

      <Link
        href="/account/subscription"
        className="block w-full text-center px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
      >
        Manage Subscription
      </Link>
      <Link
        href="/subscription/checkout"
        className="block w-full text-center px-4 py-2 mt-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
      >
        Upgrade or Change Plan
      </Link>
    </div>
  );
}
