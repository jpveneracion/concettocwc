/**
 * Simple route-based onboarding trigger system
 * Handles basic route detection and onboarding triggering
 */

import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

export type OnboardingType = 'general' | 'orders' | 'dashboard' | 'products' | 'settings';

interface RouteOnboardingMap {
  [route: string]: OnboardingType;
}

const ROUTE_ONBOARDING_MAP: RouteOnboardingMap = {
  '/dashboard': 'dashboard',
  '/quotes/new': 'orders',
  '/quotes': 'dashboard',
  '/products': 'products',
  '/settings': 'settings',
};

/**
 * Simple hook to detect if onboarding should be shown for current route
 */
export function useRouteOnboarding() {
  const pathname = usePathname();
  const [shouldShowOnboarding, setShouldShowOnboarding] = useState<OnboardingType | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check if user has completed onboarding for this route
    const checkOnboardingStatus = () => {
      const onboardingType = ROUTE_ONBOARDING_MAP[pathname];

      if (!onboardingType) {
        setShouldShowOnboarding(null);
        setIsLoading(false);
        return;
      }

      // Check if user has already seen this onboarding
      const storageKey = `concetto_onboarding_${onboardingType}_completed`;
      const hasCompleted = localStorage.getItem(storageKey);

      if (!hasCompleted) {
        setShouldShowOnboarding(onboardingType);
      } else {
        setShouldShowOnboarding(null);
      }

      setIsLoading(false);
    };

    checkOnboardingStatus();
  }, [pathname]);

  const markOnboardingComplete = (type: OnboardingType) => {
    const storageKey = `concetto_onboarding_${type}_completed`;
    localStorage.setItem(storageKey, 'true');
    setShouldShowOnboarding(null);
  };

  const markOnboardingSkipped = (type: OnboardingType) => {
    const storageKey = `concetto_onboarding_${type}_completed`;
    localStorage.setItem(storageKey, 'true');
    setShouldShowOnboarding(null);
  };

  return {
    shouldShowOnboarding,
    isLoading,
    markOnboardingComplete,
    markOnboardingSkipped,
  };
}

/**
 * Get onboarding type for a specific route
 */
export function getOnboardingTypeForRoute(route: string): OnboardingType | null {
  return ROUTE_ONBOARDING_MAP[route] || null;
}