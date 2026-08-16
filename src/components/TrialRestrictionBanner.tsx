'use client';

import { useTrialRestrictions } from '@/contexts/TrialRestrictionContext';
import { useState, useEffect } from 'react';
import { AlertTriangle, X, ArrowRight } from 'lucide-react';

export function TrialRestrictionBanner() {
  const { state, canCreateFutureOrders } = useTrialRestrictions();
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Only show banner when restrictions are active
    if (!canCreateFutureOrders && state.trialExpired) {
      setIsVisible(true);
    } else {
      setIsVisible(false);
    }
  }, [canCreateFutureOrders, state.trialExpired]);

  if (!isVisible || !state.restrictionReason) {
    return null;
  }

  return (
    <div className="bg-amber-50 border-b border-amber-200 px-4 py-3 md:px-6">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-amber-900 font-medium text-sm md:text-base">
              Trial Period Expired
            </p>
            <p className="text-amber-700 text-xs md:text-sm mt-1">
              {state.restrictionReason}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <a
            href="/account/subscription"
            className="inline-flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700 transition-colors"
          >
            <span>Activate Subscription</span>
            <ArrowRight className="w-4 h-4" aria-hidden="true" />
          </a>
          <button
            onClick={() => setIsVisible(false)}
            className="p-2 text-amber-600 hover:bg-amber-100 rounded-lg transition-colors"
            aria-label="Dismiss banner"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}