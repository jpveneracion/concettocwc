/**
 * Onboarding System - Main Entry Point
 * Re-exports all onboarding functionality for backward compatibility
 */

// Route configuration exports
export {
  TARGET_ROUTES,
  getFeatureForRoute,
  hasOnboardingContent,
  getRoutePriority,
  isTargetRoute,
  getConfiguredRoutes,
  getRouteConfig,
  matchRoute,
  shouldTriggerForPath
} from './route-config';

export type {
  RoutePattern,
  RouteOnboardingConfig
} from './route-config';

// User tracking exports
export {
  getCurrentUserId,
  isAdminUser,
  getUserTrackingState,
  saveUserTrackingState,
  recordRouteVisit,
  getRouteVisit,
  isFirstVisit,
  hasCompletedOnboarding,
  hasSkippedOnboarding,
  markOnboardingCompleted,
  markOnboardingSkipped,
  getCompletedRoutes,
  getSkippedRoutes,
  getVisitedRoutes,
  resetUserTracking,
  needsOnboarding
} from './user-tracking';

export type {
  RouteVisit,
  UserOnboardingState
} from './user-tracking';

// Legacy type aliases for backward compatibility
export type OnboardingTrigger = {
  route: string;
  featureId: string;
  priority: number;
  enabled: boolean;
};

// Route triggers exports - Main interface for onboarding system
export {
  shouldTriggerOnboarding,
  shouldExcludeAdmin,
  getHighestPriorityOnboarding,
  getUserOnboardingStatsExport as getUserOnboardingStats
} from './route-triggers';

// Legacy function aliases for backward compatibility
export { getUserTrackingState as getUserOnboardingState } from './user-tracking';
export { saveUserTrackingState as saveUserOnboardingState } from './user-tracking';
export { resetUserTracking as resetUserOnboarding } from './user-tracking';
export { getRouteConfig as getOnboardingTriggers } from './route-config';
