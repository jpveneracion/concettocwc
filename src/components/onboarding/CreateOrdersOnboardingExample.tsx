/**
 * CreateOrdersOnboardingModal Usage Example
 *
 * This example shows how to integrate the CreateOrdersOnboardingModal into your create orders page.
 * The modal provides comprehensive instructions for both Traditional Form and Wizard Mode approaches.
 *
 * Installation and Usage:
 *
 * 1. Import the modal component:
 *    import { CreateOrdersOnboardingModal } from '@/components/onboarding';
 *
 * 2. Add state management to your component:
 *    const [showOnboarding, setShowOnboarding] = useState(false);
 *
 * 3. Add a trigger button (optional, for manual launch):
 *    <button onClick={() => setShowOnboarding(true)}>
 *      Show Create Orders Guide
 *    </button>
 *
 * 4. Add the modal component:
 *    <CreateOrdersOnboardingModal
 *      isOpen={showOnboarding}
 *      onClose={() => setShowOnboarding(false)}
 *      onComplete={() => setShowOnboarding(false)}
 *    />
 *
 * 5. For automatic onboarding, check localStorage on component mount:
 *    useEffect(() => {
 *      const completedOnboarding = localStorage.getItem('concetto_onboarding_create-orders_completed');
 *      if (!completedOnboarding) {
 *        setShowOnboarding(true);
 *      }
 *    }, []);
 *
 * Features:
 * - Comprehensive 9-step onboarding covering both Traditional Form and Wizard Mode
 * - Mobile-optimized responsive design
 * - Progress tracking with localStorage
 * - User-friendly, non-technical language
 * - Practical tips for blinds business workflow
 * - Clear visual hierarchy and navigation
 *
 * The modal content focuses on:
 * - When to use each mode (Traditional Form vs Wizard Mode)
 * - Step-by-step guidance for Wizard Mode workflow
 * - Benefits of each approach
 * - Practical examples for blinds business
 * - Pro tips for efficient quote creation
 */

'use client';

import { useState, useEffect } from 'react';
import { CreateOrdersOnboardingModal } from '@/components/onboarding';

export default function CreateOrdersPageWithOnboarding() {
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [useWizard, setUseWizard] = useState(false);

  // Check if user has completed onboarding
  useEffect(() => {
    const completedOnboarding = localStorage.getItem('concetto_onboarding_create-orders_completed');
    if (!completedOnboarding) {
      // Auto-show onboarding for first-time users
      setShowOnboarding(true);
    }
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header with onboarding trigger */}
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Create New Quote</h1>
          <div className="flex gap-2">
            {/* Manual onboarding trigger button */}
            <button
              onClick={() => setShowOnboarding(true)}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm"
            >
              Show Guide
            </button>
            {/* Mode toggle button */}
            <button
              onClick={() => setUseWizard(!useWizard)}
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50"
            >
              {useWizard ? '📝 Traditional Form' : '🧙 Wizard Mode'}
            </button>
          </div>
        </div>

        {/* Main content area */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          {useWizard ? (
            <div className="text-center py-8">
              <div className="text-4xl mb-4">🧙</div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Wizard Mode</h3>
              <p className="text-gray-600">Step-by-step guidance for creating quotes</p>
            </div>
          ) : (
            <div className="text-center py-8">
              <div className="text-4xl mb-4">📝</div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Traditional Form</h3>
              <p className="text-gray-600">All fields on one page for experienced users</p>
            </div>
          )}
        </div>

        {/* Create Orders Onboarding Modal */}
        <CreateOrdersOnboardingModal
          isOpen={showOnboarding}
          onClose={() => setShowOnboarding(false)}
          onComplete={() => setShowOnboarding(false)}
        />
      </div>
    </div>
  );
}