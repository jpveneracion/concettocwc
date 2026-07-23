'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
  shouldTriggerOnboarding,
  recordRouteVisit,
  markOnboardingCompleted,
  markOnboardingSkipped,
  getFeatureForRoute,
  getUserOnboardingStats,
  getCurrentUserId,
  isFirstVisit,
  hasCompletedOnboarding,
  hasSkippedOnboarding,
  getHighestPriorityOnboarding
} from '@/lib/onboarding';

export interface OnboardingTriggerState {
  shouldShow: boolean;
  featureId: string | null;
  route: string | null;
  isLoading: boolean;
  stats: {
    completed: number;
    skipped: number;
    pending: number;
    total: number;
  };
}

export interface UseOnboardingTriggerOptions {
  enabled?: boolean;
  respectAdminExclusion?: boolean;
  triggerDelay?: number; // Delay in ms before showing modal
  autoTrigger?: boolean; // Automatically show modal when route matches
}

export interface UseOnboardingTriggerReturn extends OnboardingTriggerState {
  triggerOnboarding: (route?: string) => void;
  completeOnboarding: (route?: string) => void;
  skipOnboarding: (route?: string) => void;
  resetCurrentTrigger: () => void;
  canShowForRoute: (route: string) => boolean;
}

const DEFAULT_OPTIONS: UseOnboardingTriggerOptions = {
  enabled: true,
  respectAdminExclusion: true,
  triggerDelay: 1000, // 1 second delay
  autoTrigger: true
};

/**
 * Custom hook for route-based onboarding triggering
 * Monitors route changes and user authentication to show appropriate onboarding modals
 */
export function useOnboardingTrigger(
  options: UseOnboardingTriggerOptions = {}
): UseOnboardingTriggerReturn {
  const mergedOptions = { ...DEFAULT_OPTIONS, ...options };
  const {
    enabled,
    respectAdminExclusion,
    triggerDelay,
    autoTrigger
  } = mergedOptions;

  const pathname = usePathname();
  const router = useRouter();
  const { data: session, status } = useSession();
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // State management
  const [triggerState, setTriggerState] = useState<OnboardingTriggerState>({
    shouldShow: false,
    featureId: null,
    route: null,
    isLoading: true,
    stats: { completed: 0, skipped: 0, pending: 0, total: 0 }
  });

  /**
   * Update trigger state based on current route and user
   */
  const updateTriggerState = useCallback(() => {
    if (!enabled || typeof window === 'undefined') {
      setTriggerState(prev => ({ ...prev, isLoading: false }));
      return;
    }

    // Wait for session to be determined
    if (status === 'loading') {
      setTriggerState(prev => ({ ...prev, isLoading: true }));
      return;
    }

    // Must be authenticated
    if (!session) {
      setTriggerState(prev => ({
        ...prev,
        shouldShow: false,
        featureId: null,
        route: null,
        isLoading: false
      }));
      return;
    }

    // Get current user ID
    const userId = getCurrentUserId();
    if (!userId) {
      setTriggerState(prev => ({
        ...prev,
        shouldShow: false,
        featureId: null,
        route: null,
        isLoading: false
      }));
      return;
    }

    // Check if should trigger for current route
    const shouldTrigger = shouldTriggerOnboarding(pathname, userId);
    const featureId = getFeatureForRoute(pathname);
    const stats = getUserOnboardingStats(userId);

    setTriggerState({
      shouldShow: shouldTrigger && (autoTrigger ?? false),
      featureId: shouldTrigger ? featureId : null,
      route: shouldTrigger ? pathname : null,
      isLoading: false,
      stats
    });

    // Record the route visit
    if (pathname) {
      recordRouteVisit(pathname, userId);
    }
  }, [enabled, status, session, pathname, autoTrigger]);

  /**
   * Manually trigger onboarding for a specific route
   */
  const triggerOnboarding = useCallback((route?: string) => {
    const targetRoute = route || pathname;
    const userId = getCurrentUserId();

    if (!userId) {
      console.warn('Cannot trigger onboarding: no user logged in');
      return;
    }

    if (!isFirstVisit(targetRoute, userId) &&
        !hasCompletedOnboarding(targetRoute, userId) &&
        !hasSkippedOnboarding(targetRoute, userId)) {
      // It's a revisit but not completed/skipped, allow manual trigger
      const featureId = getFeatureForRoute(targetRoute);
      const stats = getUserOnboardingStats(userId);

      setTriggerState({
        shouldShow: true,
        featureId,
        route: targetRoute,
        isLoading: false,
        stats
      });
    } else {
      // Try to trigger even if visited before (for manual triggers)
      const featureId = getFeatureForRoute(targetRoute);
      if (featureId) {
        const stats = getUserOnboardingStats(userId);
        setTriggerState({
          shouldShow: true,
          featureId,
          route: targetRoute,
          isLoading: false,
          stats
        });
      }
    }
  }, [pathname]);

  /**
   * Mark onboarding as completed for a route
   */
  const completeOnboarding = useCallback((route?: string) => {
    const targetRoute = route || pathname;
    const userId = getCurrentUserId();

    if (!userId) return;

    markOnboardingCompleted(targetRoute, userId);

    setTriggerState(prev => ({
      ...prev,
      shouldShow: false,
      featureId: null,
      route: null,
      stats: getUserOnboardingStats(userId)
    }));
  }, [pathname]);

  /**
   * Skip onboarding for a route
   */
  const skipOnboarding = useCallback((route?: string) => {
    const targetRoute = route || pathname;
    const userId = getCurrentUserId();

    if (!userId) return;

    markOnboardingSkipped(targetRoute, userId);

    setTriggerState(prev => ({
      ...prev,
      shouldShow: false,
      featureId: null,
      route: null,
      stats: getUserOnboardingStats(userId)
    }));
  }, [pathname]);

  /**
   * Reset current trigger state
   */
  const resetCurrentTrigger = useCallback(() => {
    setTriggerState(prev => ({
      ...prev,
      shouldShow: false,
      featureId: null,
      route: null
    }));
  }, []);

  /**
   * Check if onboarding can be shown for a specific route
   */
  const canShowForRoute = useCallback((route: string) => {
    const userId = getCurrentUserId();
    return shouldTriggerOnboarding(route, userId);
  }, []);

  // Effect to monitor route changes and update trigger state
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Clear any existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Add delay before showing modal (for better UX)
    timeoutRef.current = setTimeout(() => {
      updateTriggerState();
    }, triggerDelay);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [pathname, status, session, updateTriggerState, triggerDelay]);

  // Record initial visit on mount
  useEffect(() => {
    if (typeof window === 'undefined' || status !== 'authenticated') return;

    const userId = getCurrentUserId();
    if (userId && pathname) {
      recordRouteVisit(pathname, userId);
    }
  }, [status, pathname]);

  return {
    ...triggerState,
    triggerOnboarding,
    completeOnboarding,
    skipOnboarding,
    resetCurrentTrigger,
    canShowForRoute
  };
}

/**
 * Simpler hook that just returns whether to show onboarding for current route
 */
export function useShouldShowOnboarding(): boolean {
  const { shouldShow, featureId, isLoading } = useOnboardingTrigger();
  return shouldShow && featureId !== null && !isLoading;
}

/**
 * Hook to get onboarding statistics
 */
export function useOnboardingStats() {
  const [stats, setStats] = useState({
    completed: 0,
    skipped: 0,
    pending: 0,
    total: 0
  });
  const { status } = useSession();

  useEffect(() => {
    if (status === 'authenticated') {
      setStats(getUserOnboardingStats());
    }
  }, [status]);

  return stats;
}

/**
 * Hook to get the highest priority pending onboarding
 */
export function useNextOnboarding() {
  const [nextOnboarding, setNextOnboarding] = useState<{
    route: string;
    featureId: string;
  } | null>(null);
  const { status } = useSession();

  useEffect(() => {
    if (status === 'authenticated') {
      const trigger = getHighestPriorityOnboarding();
      if (trigger) {
        setNextOnboarding({
          route: trigger.route,
          featureId: trigger.featureId
        });
      } else {
        setNextOnboarding(null);
      }
    }
  }, [status]);

  return nextOnboarding;
}