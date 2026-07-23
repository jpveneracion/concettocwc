/**
 * Simple onboarding provider that triggers modals based on route visits
 */

'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouteOnboarding } from '@/lib/onboarding/simple-route-triggers';
import OnboardingModal from '@/components/onboarding/OnboardingModal';
import CreateOrdersOnboardingModal from '@/components/onboarding/CreateOrdersOnboardingModal';
import FeatureOnboardingModal from '@/components/onboarding/FeatureOnboardingModal';
import { allOnboardingContent } from '@/components/onboarding/onboarding-content';

interface OnboardingContextType {
  showOnboarding: (type: string) => void;
  hideOnboarding: () => void;
}

const OnboardingContext = createContext<OnboardingContextType | undefined>(undefined);

export function useOnboarding() {
  const context = useContext(OnboardingContext);
  if (!context) {
    throw new Error('useOnboarding must be used within OnboardingProvider');
  }
  return context;
}

export function OnboardingTriggerProvider({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const { shouldShowOnboarding, isLoading, markOnboardingComplete, markOnboardingSkipped } = useRouteOnboarding();
  const [manualShowType, setManualShowType] = useState<string | null>(null);

  // Check if user is admin
  const isAdmin = session?.user?.id === '1'; // Based on existing auth logic

  const showOnboarding = (type: string) => {
    setManualShowType(type);
  };

  const hideOnboarding = () => {
    setManualShowType(null);
  };

  // Don't show onboarding to admin users or if session is loading
  if (isAdmin || status === 'loading' || isLoading) {
    return (
      <OnboardingContext.Provider value={{ showOnboarding, hideOnboarding }}>
        {children}
      </OnboardingContext.Provider>
    );
  }

  // Determine which modal to show based on onboarding type
  const renderOnboardingModal = () => {
    const onboardingType = manualShowType || shouldShowOnboarding;

    if (!onboardingType) return null;

    const handleComplete = () => {
      if (!manualShowType && shouldShowOnboarding) {
        markOnboardingComplete(shouldShowOnboarding);
      }
      hideOnboarding();
    };

    const handleSkip = () => {
      if (!manualShowType && shouldShowOnboarding) {
        markOnboardingSkipped(shouldShowOnboarding);
      }
      hideOnboarding();
    };

    switch (onboardingType) {
      case 'general':
        return (
          <OnboardingModal
            isOpen={true}
            onClose={handleSkip}
          />
        );

      case 'orders':
        return (
          <CreateOrdersOnboardingModal
            isOpen={true}
            onClose={handleSkip}
            onComplete={handleComplete}
          />
        );

      case 'dashboard':
        return (
          <FeatureOnboardingModal
            isOpen={true}
            onClose={handleSkip}
            onComplete={handleComplete}
            content={allOnboardingContent.dashboard}
          />
        );

      case 'products':
        return (
          <FeatureOnboardingModal
            isOpen={true}
            onClose={handleSkip}
            onComplete={handleComplete}
            content={allOnboardingContent.products}
          />
        );

      case 'settings':
        return (
          <FeatureOnboardingModal
            isOpen={true}
            onClose={handleSkip}
            onComplete={handleComplete}
            content={allOnboardingContent.settings}
          />
        );

      default:
        return null;
    }
  };

  return (
    <OnboardingContext.Provider value={{ showOnboarding, hideOnboarding }}>
      {children}
      {renderOnboardingModal()}
    </OnboardingContext.Provider>
  );
}