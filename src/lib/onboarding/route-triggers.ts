/**
 * Route-based onboarding trigger system
 * Main interface for onboarding functionality
 */

import { getCurrentUserId } from './user-tracking';
import { getFeatureForRoute, TARGET_ROUTES } from './route-config';
import {
  recordRouteVisit,
  isFirstVisit,
  hasCompletedOnboarding,
  hasSkippedOnboarding,
  markOnboardingCompleted,
  markOnboardingSkipped,
  getUserOnboardingStats
} from './user-tracking';

/**
 * Check if onboarding should be triggered for a given route and user
 */
export function shouldTriggerOnboarding(route: string, userId?: string | null): boolean {
  if (!userId) {
    userId = getCurrentUserId();
  }

  if (!userId) return false;

  // Check if route has onboarding content
  const featureId = getFeatureForRoute(route);
  if (!featureId) return false;

  // Only show on first visit
  return isFirstVisit(route, userId);
}

/**
 * Get user onboarding statistics
 */
export function getUserOnboardingStatsExport(userId?: string | null): {
  completed: number;
  skipped: number;
  pending: number;
  total: number;
} {
  if (!userId) {
    userId = getCurrentUserId();
  }

  if (!userId) {
    return { completed: 0, skipped: 0, pending: 0, total: 0 };
  }

  const stats = getUserOnboardingStats(userId);
  return stats;
}

/**
 * Get the highest priority onboarding that should be shown
 */
export function getHighestPriorityOnboarding(): { route: string; featureId: string } | null {
  const userId = getCurrentUserId();
  if (!userId) return null;

  // Priority order: dashboard (1), quotes (2), products (3), settings (4)
  const priorityRoutes = [
    '/dashboard',
    '/quotes/new',
    '/products',
    '/settings'
  ];

  for (const route of priorityRoutes) {
    if (shouldTriggerOnboarding(route, userId)) {
      const featureId = getFeatureForRoute(route);
      if (featureId) {
        return { route, featureId };
      }
    }
  }

  return null;
}

/**
 * Admin check - returns true if current user should be excluded from onboarding
 */
export function shouldExcludeAdmin(userId?: string | null): boolean {
  if (!userId) {
    userId = getCurrentUserId();
  }

  // Admin user ID is '1' based on existing auth logic
  return userId === '1';
}

/**
 * Re-export functions from user-tracking for convenience
 */
export {
  recordRouteVisit,
  markOnboardingCompleted,
  markOnboardingSkipped,
  isFirstVisit,
  hasCompletedOnboarding,
  hasSkippedOnboarding,
  getCurrentUserId,
  getFeatureForRoute
};