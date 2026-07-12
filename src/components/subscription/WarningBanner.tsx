'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { SubscriptionDetails } from '@/types/subscription';

interface SubscriptionWarning {
  show: boolean;
  message: string;
  type: 'info' | 'warning' | 'error';
  actionUrl?: string;
  actionText?: string;
}

interface WarningBannerProps {
  className?: string;
}

/**
 * WarningBanner Component
 *
 * Displays subscription-related warnings based on current subscription status:
 * - Trial ending (2 days or less) - Blue info banner
 * - Payment failed (past_due) - Red error banner
 * - Subscription cancelled - Yellow warning banner
 *
 * Silently handles API failures and only shows when warning conditions exist.
 */
export default function WarningBanner({ className = '' }: WarningBannerProps) {
  const [warning, setWarning] = useState<SubscriptionWarning>({
    show: false,
    message: '',
    type: 'info'
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function checkSubscriptionStatus() {
      try {
        const response = await fetch('/api/account/subscription');

        if (!response.ok) {
          // Silent API failure - don't show banner
          setWarning({ show: false, message: '', type: 'info' });
          return;
        }

        const data: SubscriptionDetails = await response.json();
        const newWarning = evaluateSubscriptionStatus(data);
        setWarning(newWarning);

      } catch (error) {
        // Silent error handling - don't show banner on API failures
        console.error('Failed to fetch subscription status:', error);
        setWarning({ show: false, message: '', type: 'info' });
      } finally {
        setIsLoading(false);
      }
    }

    checkSubscriptionStatus();
  }, []);

  // Don't render anything if loading, no warning, or error state
  if (isLoading || !warning.show) {
    return null;
  }

  // Get styling based on warning type
  const getBannerStyles = () => {
    switch (warning.type) {
      case 'info':
        return 'bg-blue-50 border-l-4 border-blue-500 text-blue-800';
      case 'warning':
        return 'bg-yellow-50 border-l-4 border-yellow-500 text-yellow-800';
      case 'error':
        return 'bg-red-50 border-l-4 border-red-500 text-red-800';
      default:
        return 'bg-gray-50 border-l-4 border-gray-500 text-gray-800';
    }
  };

  const getButtonStyles = () => {
    switch (warning.type) {
      case 'info':
        return 'bg-blue-600 hover:bg-blue-700 text-white';
      case 'warning':
        return 'bg-yellow-600 hover:bg-yellow-700 text-white';
      case 'error':
        return 'bg-red-600 hover:bg-red-700 text-white';
      default:
        return 'bg-gray-600 hover:bg-gray-700 text-white';
    }
  };

  return (
    <div className={`w-full ${getBannerStyles()} ${className}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          {/* Warning Message */}
          <div className="flex items-center gap-3 flex-1">
            <span className="text-2xl" role="img" aria-label="Warning icon">
              {warning.type === 'info' ? 'ℹ️' : warning.type === 'warning' ? '⚠️' : '🚨'}
            </span>
            <p className="text-sm font-medium">{warning.message}</p>
          </div>

          {/* Action Button */}
          {warning.actionUrl && warning.actionText && (
            <Link
              href={warning.actionUrl}
              className={`inline-flex items-center px-4 py-2 rounded-lg text-sm font-semibold transition-colors duration-200 ${getButtonStyles()}`}
            >
              {warning.actionText}
              <span className="ml-2" aria-hidden="true">→</span>
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Evaluates subscription status and determines if warning should be shown
 */
function evaluateSubscriptionStatus(data: SubscriptionDetails): SubscriptionWarning {
  const now = new Date();

  // Trial Ending Warning (2 days or less remaining)
  if (data.status === 'trialing' && data.trial_end) {
    const trialEndDate = new Date(data.trial_end);
    const daysLeft = Math.ceil((trialEndDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (daysLeft <= 2 && daysLeft > 0) {
      return {
        show: true,
        message: `Trial ends in ${daysLeft} day${daysLeft === 1 ? '' : 's'} - Subscribe now to continue access`,
        type: 'info',
        actionUrl: '/subscription/checkout',
        actionText: 'Subscribe Now'
      };
    }
  }

  // Payment Failed Warning (past_due status)
  if (data.status === 'past_due') {
    // Check if still in grace period
    if (data.current_period_end) {
      const gracePeriodEnd = new Date(data.current_period_end);
      if (gracePeriodEnd > now) {
        const daysLeft = Math.ceil((gracePeriodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        return {
          show: true,
          message: `Payment failed - Update payment method (grace period ends in ${daysLeft} days)`,
          type: 'error',
          actionUrl: '/account/subscription',
          actionText: 'Update Payment'
        };
      }
    } else {
      return {
        show: true,
        message: 'Payment failed - Update payment method to maintain access',
        type: 'error',
        actionUrl: '/account/subscription',
        actionText: 'Update Payment'
      };
    }
  }

  // Subscription Cancelled Warning
  if (data.status === 'cancelled') {
    if (data.current_period_end) {
      const gracePeriodEnd = new Date(data.current_period_end);
      const daysLeft = Math.ceil((gracePeriodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      if (daysLeft > 0) {
        return {
          show: true,
          message: `Subscription cancelled - Grace period ends in ${daysLeft} day${daysLeft === 1 ? '' : 's'}`,
          type: 'warning',
          actionUrl: '/account/subscription',
          actionText: 'Manage Subscription'
        };
      }
    } else {
      return {
        show: true,
        message: 'Subscription cancelled - Reactivate to maintain access',
        type: 'warning',
        actionUrl: '/subscription/checkout',
        actionText: 'Reactivate'
      };
    }
  }

  // No warning condition found
  return {
    show: false,
    message: '',
    type: 'info'
  };
}