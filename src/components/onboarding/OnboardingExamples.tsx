'use client';

import React, { useState } from 'react';
import { OnboardingModal, FeatureOnboardingModal } from './index';
import { allOnboardingContent } from './onboarding-content';

/**
 * Example component demonstrating how to use the onboarding modals
 *
 * This shows two main usage patterns:
 * 1. General onboarding (OnboardingModal) - First-time user experience
 * 2. Feature-specific onboarding (FeatureOnboardingModal) - Targeted feature guidance
 */
export default function OnboardingExamples() {
  const [showGeneralOnboarding, setShowGeneralOnboarding] = useState(false);
  const [showFeatureOnboarding, setShowFeatureOnboarding] = useState<string | null>(null);

  const openFeatureOnboarding = (featureId: string) => {
    setShowFeatureOnboarding(featureId);
  };

  const closeFeatureOnboarding = () => {
    setShowFeatureOnboarding(null);
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold mb-4">Onboarding Examples</h1>
        <p className="text-gray-600 mb-6">
          Click the buttons below to see different onboarding experiences:
        </p>
      </div>

      {/* General Onboarding Section */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold mb-3">General Platform Onboarding</h2>
        <p className="text-gray-600 mb-4">
          First-time user experience covering all main features. Shows automatically for new users.
        </p>
        <button
          onClick={() => setShowGeneralOnboarding(true)}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
        >
          Launch General Onboarding
        </button>
      </div>

      {/* Feature-Specific Onboarding Section */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold mb-3">Feature-Specific Onboarding</h2>
        <p className="text-gray-600 mb-4">
          Targeted guidance for specific features. Use these when users need help with particular functionality.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <button
            onClick={() => openFeatureOnboarding('dashboard')}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
          >
            Dashboard Guide
          </button>
          <button
            onClick={() => openFeatureOnboarding('quotes')}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm"
          >
            Quotes Guide
          </button>
          <button
            onClick={() => openFeatureOnboarding('products')}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm"
          >
            Products Guide
          </button>
          <button
            onClick={() => openFeatureOnboarding('settings')}
            className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors text-sm"
          >
            Settings Guide
          </button>
        </div>
      </div>

      {/* Usage Instructions */}
      <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
        <h3 className="text-lg font-semibold mb-3">Implementation Guide</h3>
        <div className="space-y-4 text-sm">
          <div>
            <h4 className="font-medium text-gray-900">General Onboarding:</h4>
            <pre className="mt-2 p-3 bg-white rounded border overflow-x-auto">
{`import { OnboardingModal } from '@/components/onboarding';

<OnboardingModal
  isOpen={showOnboarding}
  onClose={() => setShowOnboarding(false)}
/>`}
            </pre>
          </div>
          <div>
            <h4 className="font-medium text-gray-900">Feature Onboarding:</h4>
            <pre className="mt-2 p-3 bg-white rounded border overflow-x-auto">
{`import { FeatureOnboardingModal, allOnboardingContent } from '@/components/onboarding';

<FeatureOnboardingModal
  isOpen={showFeatureGuide}
  onClose={() => setShowFeatureGuide(false)}
  content={allOnboardingContent.dashboard}
  onComplete={() => console.log('Completed!')}
/>`}
            </pre>
          </div>
        </div>
      </div>

      {/* General Onboarding Modal */}
      <OnboardingModal
        isOpen={showGeneralOnboarding}
        onClose={() => setShowGeneralOnboarding(false)}
      />

      {/* Feature Onboarding Modals */}
      {showFeatureOnboarding && allOnboardingContent[showFeatureOnboarding] && (
        <FeatureOnboardingModal
          isOpen={!!showFeatureOnboarding}
          onClose={closeFeatureOnboarding}
          content={allOnboardingContent[showFeatureOnboarding]}
          onComplete={closeFeatureOnboarding}
        />
      )}
    </div>
  );
}