'use client';

import { useState } from 'react';

interface SubscriptionPlan {
  id: string;
  name: string;
  description: string;
  price: number;
  currency: string;
  interval: 'month' | 'quarter' | 'year';
  discount_percent: number;
  features: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface SubscriptionPlanListProps {
  plans: SubscriptionPlan[];
  onEdit: (plan: SubscriptionPlan) => void;
  onDelete: (planId: string) => Promise<void>;
  onToggleStatus: (planId: string, newStatus: boolean) => Promise<void>;
  isLoading?: boolean;
}

export default function SubscriptionPlanList({
  plans,
  onEdit,
  onDelete,
  onToggleStatus,
  isLoading = false
}: SubscriptionPlanListProps) {
  const [deletingPlan, setDeletingPlan] = useState<string | null>(null);
  const [togglingPlan, setTogglingPlan] = useState<string | null>(null);

  const handleDelete = async (planId: string) => {
    if (!confirm('Are you sure you want to delete this plan? This action cannot be undone.')) {
      return;
    }

    setDeletingPlan(planId);
    try {
      await onDelete(planId);
    } finally {
      setDeletingPlan(null);
    }
  };

  const handleToggleStatus = async (planId: string, currentStatus: boolean) => {
    setTogglingPlan(planId);
    try {
      await onToggleStatus(planId, !currentStatus);
    } finally {
      setTogglingPlan(null);
    }
  };

  const formatInterval = (interval: string): string => {
    switch (interval) {
      case 'month':
        return 'Monthly';
      case 'quarter':
        return 'Quarterly';
      case 'year':
        return 'Annual';
      default:
        return interval;
    }
  };

  const formatPrice = (price: number, currency: string): string => {
    const symbol = currency === 'PHP' ? '₱' : currency === 'USD' ? '$' : '€';
    return `${symbol}${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-white border border-gray-200 rounded-lg p-6 animate-pulse">
            <div className="h-6 bg-gray-200 rounded mb-4"></div>
            <div className="h-4 bg-gray-200 rounded mb-2"></div>
            <div className="h-4 bg-gray-200 rounded mb-4"></div>
            <div className="h-8 bg-gray-200 rounded mb-4"></div>
            <div className="h-12 bg-gray-200 rounded"></div>
          </div>
        ))}
      </div>
    );
  }

  if (plans.length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-12 text-center">
        <div className="text-6xl mb-4">💳</div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">No Subscription Plans</h3>
        <p className="text-gray-600 mb-6">
          Get started by creating your first subscription plan.
        </p>
        <div className="text-sm text-gray-500">
          Click the "Create New Plan" button above to begin.
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {plans.map((plan) => (
        <div
          key={plan.id}
          className={`bg-white border rounded-lg shadow-sm hover:shadow-md transition-shadow overflow-hidden ${
            plan.is_active ? 'border-gray-200' : 'border-gray-300 opacity-75'
          }`}
        >
          {/* Plan Header */}
          <div className={`p-6 border-b ${
            plan.is_active ? 'border-gray-200 bg-white' : 'border-gray-300 bg-gray-50'
          }`}>
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  {plan.name}
                </h3>
                <p className="text-sm text-gray-600 mt-1">
                  {formatInterval(plan.interval)}
                </p>
              </div>
              <div className={`px-2 py-1 text-xs font-medium rounded-full ${
                plan.is_active
                  ? 'bg-green-100 text-green-800'
                  : 'bg-gray-100 text-gray-800'
              }`}>
                {plan.is_active ? 'Active' : 'Inactive'}
              </div>
            </div>

            {/* Price Display */}
            <div className="flex items-baseline gap-1 mb-2">
              <span className="text-2xl font-bold text-gray-900">
                {formatPrice(plan.price, plan.currency)}
              </span>
              <span className="text-gray-600">/ {plan.interval}</span>
            </div>

            {/* Discount Badge */}
            {plan.discount_percent > 0 && (
              <div className="inline-flex items-center bg-green-50 text-green-700 px-2 py-1 rounded text-sm font-medium">
                Save {plan.discount_percent}%
              </div>
            )}
          </div>

          {/* Plan Body */}
          <div className="p-6">
            {/* Description */}
            <p className="text-sm text-gray-600 mb-4 line-clamp-2">
              {plan.description}
            </p>

            {/* Features Preview */}
            <div className="mb-4">
              <h4 className="text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wide">
                Key Features
              </h4>
              <ul className="space-y-1">
                {plan.features.slice(0, 3).map((feature, index) => (
                  <li key={index} className="text-xs text-gray-600 flex items-start gap-2">
                    <span className="text-green-600 mt-0.5">✓</span>
                    <span className="line-clamp-1">{feature}</span>
                  </li>
                ))}
                {plan.features.length > 3 && (
                  <li className="text-xs text-gray-500">
                    +{plan.features.length - 3} more features
                  </li>
                )}
              </ul>
            </div>

            {/* Action Buttons */}
            <div className="space-y-2 pt-4 border-t border-gray-200">
              <button
                onClick={() => onEdit(plan)}
                disabled={togglingPlan === plan.id || deletingPlan === plan.id}
                className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed min-h-[44px] text-sm"
              >
                Edit Plan
              </button>

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => handleToggleStatus(plan.id, plan.is_active)}
                  disabled={togglingPlan === plan.id || deletingPlan === plan.id}
                  className={`px-4 py-2 rounded-lg font-medium min-h-[44px] text-sm ${
                    plan.is_active
                      ? 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200'
                      : 'bg-green-100 text-green-800 hover:bg-green-200'
                  } disabled:bg-gray-100 disabled:cursor-not-allowed`}
                >
                  {togglingPlan === plan.id
                    ? 'Updating...'
                    : plan.is_active
                    ? 'Deactivate'
                    : 'Activate'}
                </button>

                <button
                  onClick={() => handleDelete(plan.id)}
                  disabled={togglingPlan === plan.id || deletingPlan === plan.id}
                  className="bg-red-100 text-red-800 px-4 py-2 rounded-lg font-medium hover:bg-red-200 disabled:bg-gray-100 disabled:cursor-not-allowed min-h-[44px] text-sm"
                >
                  {deletingPlan === plan.id ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>

            {/* Updated Date */}
            <div className="mt-4 pt-4 border-t border-gray-200">
              <p className="text-xs text-gray-500">
                Last updated: {new Date(plan.updated_at).toLocaleDateString()}
              </p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}