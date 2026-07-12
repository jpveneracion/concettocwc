// src/components/subscription/AccountLockedBanner.tsx

'use client';
import { useState } from 'react';

interface AccountLockedBannerProps {
  trialDaysRemaining?: number;
  onDismiss?: () => void;
}

export function AccountLockedBanner({ trialDaysRemaining = 0, onDismiss }: AccountLockedBannerProps) {
  const [showActivation, setShowActivation] = useState(false);

  if (trialDaysRemaining > 0) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <span className="text-yellow-600 text-2xl mr-3">⏰</span>
            <div>
              <h3 className="font-semibold text-yellow-900">
                Trial Period Active
              </h3>
              <p className="text-sm text-yellow-700">
                {trialDaysRemaining} day{trialDaysRemaining !== 1 ? 's' : ''} remaining in your trial
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowActivation(!showActivation)}
            className="text-yellow-700 hover:text-yellow-900 text-sm font-medium"
          >
            {showActivation ? 'Hide' : 'Activate Now'}
          </button>
        </div>

        {showActivation && (
          <div className="mt-4">
            <div className="text-sm text-yellow-800 mb-2">
              Activate your account now to avoid interruption:
            </div>
            <a
              href="/activate-code"
              className="inline-block bg-yellow-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-yellow-700 text-sm"
            >
              Enter Activation Code
            </a>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <span className="text-red-600 text-2xl mr-3">🔒</span>
          <div>
            <h3 className="font-semibold text-red-900">
              Account Locked
            </h3>
            <p className="text-sm text-red-700">
              Your trial has expired. Please activate your account to continue.
            </p>
          </div>
        </div>
        <div className="flex space-x-2">
          <button
            onClick={() => setShowActivation(!showActivation)}
            className="text-red-700 hover:text-red-900 text-sm font-medium"
          >
            {showActivation ? 'Hide' : 'Activate'}
          </button>
          {onDismiss && (
            <button
              onClick={onDismiss}
              className="text-red-700 hover:text-red-900 text-sm font-medium"
            >
              Dismiss
            </button>
          )}
        </div>
      </div>

      {showActivation && (
        <div className="mt-4">
          <div className="text-sm text-red-800 mb-2">
            Enter your activation code to restore access:
          </div>
          <a
            href="/activate-code"
            className="inline-block bg-red-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-red-700 text-sm"
          >
            Enter Activation Code
          </a>
          <div className="mt-2 text-xs text-red-600">
            Don't have a code?{' '}
            <a href="mailto:support@concetto.com" className="underline hover:text-red-800">
              Contact support
            </a>
          </div>
        </div>
      )}
    </div>
  );
}