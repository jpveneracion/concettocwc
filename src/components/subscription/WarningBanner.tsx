'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { TrialStatusResponse } from '@/types/subscription';

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
 * Displays trial-related warnings based on current trial status:
 * - Trial ending (2 days or less) - Blue info banner
 * - Trial expired - Red error banner
 * - Subscription active - No banner
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
    async function checkTrialStatus() {
      try {
        const response = await fetch('/api/auth/trial-status');

        if (!response.ok) {
          // Silent API failure - don't show banner
          setWarning({ show: false, message: '', type: 'info' });
          return;
        }

        const data: TrialStatusResponse = await response.json();
        const newWarning = evaluateTrialStatus(data);
        setWarning(newWarning);

      } catch (error) {
        // Silent error handling - don't show banner on API failures
        console.error('Failed to fetch trial status:', error);
        setWarning({ show: false, message: '', type: 'info' });
      } finally {
        setIsLoading(false);
      }
    }

    checkTrialStatus();
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
 * Evaluates trial status and determines if warning should be shown
 */
function evaluateTrialStatus(data: TrialStatusResponse): SubscriptionWarning {
  // Trial Expired Error - User needs to activate subscription
  if (data.requires_activation) {
    return {
      show: true,
      message: 'Trial expired - Activate your account to continue access',
      type: 'error',
      actionUrl: '/activate-code',
      actionText: 'Activate Account'
    };
  }

  // Trial Ending Warning (2 days or less remaining)
  if (data.trial_active && data.trial_days_remaining <= 2) {
    return {
      show: true,
      message: `Trial ends in ${data.trial_days_remaining} day${data.trial_days_remaining === 1 ? '' : 's'} - Activate now to continue access`,
      type: 'info',
      actionUrl: '/activate-code',
      actionText: 'Activate Now'
    };
  }

  // Trial Active with more than 2 days - no warning needed
  if (data.trial_active && data.trial_days_remaining > 2) {
    return {
      show: false,
      message: '',
      type: 'info'
    };
  }

  // Subscription Active - no warning needed
  if (data.subscription_activated) {
    return {
      show: false,
      message: '',
      type: 'info'
    };
  }

  // No warning condition found
  return {
    show: false,
    message: '',
    type: 'info'
  };
}