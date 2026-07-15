'use client';

import { TrialRestrictionProvider } from '@/contexts/TrialRestrictionContext';
import OnboardingModal from '@/components/onboarding/OnboardingModal';
import { useState, useEffect } from 'react';

interface ProvidersProps {
  children: React.ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    // Check if user is authenticated and first-time login
    const checkAuthStatus = () => {
      // This will work with existing NextAuth session
      const hasCompletedOnboarding = localStorage.getItem('concetto_onboarding_completed');
      const isFirstLogin = !hasCompletedOnboarding;

      // Only show onboarding for authenticated first-time users
      // This integrates with existing auth system without modifying it
      if (isFirstLogin && isAuthenticated) {
        setShowOnboarding(true);
      }
    };

    checkAuthStatus();
  }, [isAuthenticated]);

  return (
    <TrialRestrictionProvider>
      {children}
      {showOnboarding && (
        <OnboardingModal
          isOpen={showOnboarding}
          onClose={() => setShowOnboarding(false)}
        />
      )}
    </TrialRestrictionProvider>
  );
}