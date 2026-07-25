'use client';

import React, { useEffect, createContext, useContext } from 'react';
import { useOnboardingTrigger } from '@/hooks/useOnboardingTrigger';
import { FeatureOnboardingModal } from '@/components/onboarding';
import { allOnboardingContent } from '@/components/onboarding/onboarding-content';

interface OnboardingContextType {
  triggerOnboarding: (route?: string) => void;
  completeOnboarding: (route?: string) => void;
  skipOnboarding: (route?: string) => void;
  canShowForRoute: (route: string) => boolean;
  stats: {
    completed: number;
    skipped: number;
    pending: number;
    total: number;
  };
}

const OnboardingContext = createContext<OnboardingContextType | undefined>(undefined);

interface OnboardingProviderProps {
  children: React.ReactNode;
  enabled?: boolean;
  respectAdminExclusion?: boolean;
  triggerDelay?: number;
  autoTrigger?: boolean;
}

/**
 * OnboardingProvider - Route-based onboarding modal system
 *
 * This provider automatically shows appropriate onboarding modals based on:
 * 1. User's current route
 * 2. User's authentication status
 * 3. User's onboarding completion history
 * 4. Admin exclusion (optional)
 *
 * Features:
 * - User-specific tracking via localStorage
 * - Route-based detection for /dashboard, /quotes/new, /products, /settings
 * - Manual and automatic triggering
 * - Mobile-optimized modals
 * - TypeScript type safety
 */
export function OnboardingProvider({
  children,
  enabled = true,
  respectAdminExclusion = true,
  triggerDelay = 1000,
  autoTrigger = true
}: OnboardingProviderProps) {

  const {
    shouldShow,
    featureId,
    route,
    triggerOnboarding,
    completeOnboarding,
    skipOnboarding,
    resetCurrentTrigger,
    canShowForRoute,
    stats,
    isLoading
  } = useOnboardingTrigger({
    enabled,
    respectAdminExclusion,
    triggerDelay,
    autoTrigger
  });

  // Handle modal close
  const handleClose = () => {
    resetCurrentTrigger();
  };

  // Handle modal completion
  const handleComplete = () => {
    if (route) {
      completeOnboarding(route);
    } else {
      handleClose();
    }
  };

  // Get the appropriate content for the feature
  const getContent = () => {
    if (!featureId || !allOnboardingContent[featureId]) {
      return null;
    }
    return allOnboardingContent[featureId];
  };

  const content = getContent();

  // Context value for manual triggering
  const contextValue: OnboardingContextType = {
    triggerOnboarding,
    completeOnboarding,
    skipOnboarding,
    canShowForRoute,
    stats
  };

  return (
    <OnboardingContext.Provider value={contextValue}>
      {children}

      {/* Show onboarding modal when appropriate */}
      {!isLoading && shouldShow && content && (
        <FeatureOnboardingModal
          isOpen={shouldShow}
          onClose={handleClose}
          content={content}
          onComplete={handleComplete}
        />
      )}
    </OnboardingContext.Provider>
  );
}

/**
 * Hook to access onboarding context for manual triggering
 *
 * @example
 * ```tsx
 * const { triggerOnboarding, completeOnboarding } = useOnboardingContext();
 *
 * <button onClick={() => triggerOnboarding('/products')}>
 *   Show Products Guide
 * </button>
 * ```
 */
export function useOnboardingContext(): OnboardingContextType {
  const context = useContext(OnboardingContext);

  if (context === undefined) {
    throw new Error('useOnboardingContext must be used within an OnboardingProvider');
  }

  return context;
}

/**
 * HOC to add manual onboarding controls to a component
 *
 * @example
 * ```tsx
 * const MyComponent = withOnboardingControls(({ triggerOnboarding }) => (
 *   <button onClick={() => triggerOnboarding('/settings')}>
 *     Show Settings Guide
 *   </button>
 * ));
 * ```
 */
export function withOnboardingControls<P extends object>(
  Component: React.ComponentType<P & { onboarding: OnboardingContextType }>
) {
  return function WithOnboardingControls(props: P) {
    const onboarding = useOnboardingContext();

    return <Component {...props} onboarding={onboarding} />;
  };
}

/**
 * Hook for components that want to show onboarding manually
 * without being inside the provider
 */
export function useManualOnboarding() {
  const {
    triggerOnboarding,
    completeOnboarding,
    skipOnboarding,
    canShowForRoute,
    stats
  } = useOnboardingTrigger({
    enabled: true,
    autoTrigger: false // Manual mode
  });

  return {
    triggerOnboarding,
    completeOnboarding,
    skipOnboarding,
    canShowForRoute,
    stats
  };
}