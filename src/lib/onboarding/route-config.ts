/**
 * Route Configuration for Onboarding System
 * Defines route-to-onboarding mapping and detection utilities
 */

import { allOnboardingContent } from '@/components/onboarding/onboarding-content';

/**
 * Route pattern configuration
 */
export interface RoutePattern {
  pattern: string;
  matchType: 'exact' | 'startsWith' | 'regex';
  priority?: number;
}

/**
 * Route to onboarding mapping configuration
 */
export interface RouteOnboardingConfig {
  route: string;
  featureId: string;
  enabled: boolean;
  priority: number;
  pattern?: RoutePattern;
}

/**
 * Target routes for onboarding system
 */
export const TARGET_ROUTES = {
  DASHBOARD: '/dashboard',
  QUOTES_NEW: '/quotes/new',
  PRODUCTS: '/products',
  SETTINGS: '/settings'
} as const;

/**
 * Route to feature mapping
 */
const ROUTE_FEATURE_MAP: Record<string, string> = {
  [TARGET_ROUTES.DASHBOARD]: 'dashboard',
  [TARGET_ROUTES.QUOTES_NEW]: 'quotes',
  [TARGET_ROUTES.PRODUCTS]: 'products',
  [TARGET_ROUTES.SETTINGS]: 'settings'
};

/**
 * Priority order for showing onboarding (lower = higher priority)
 */
const ROUTE_PRIORITY: Record<string, number> = {
  [TARGET_ROUTES.DASHBOARD]: 1,
  [TARGET_ROUTES.QUOTES_NEW]: 2,
  [TARGET_ROUTES.PRODUCTS]: 3,
  [TARGET_ROUTES.SETTINGS]: 4
};

/**
 * Get feature ID for a specific route
 */
export function getFeatureForRoute(route: string): string | null {
  // Check for exact match first
  if (ROUTE_FEATURE_MAP[route]) {
    return ROUTE_FEATURE_MAP[route];
  }

  // Check for startsWith matches (for routes with parameters)
  for (const [mappedRoute, featureId] of Object.entries(ROUTE_FEATURE_MAP)) {
    if (route.startsWith(mappedRoute)) {
      return featureId;
    }
  }

  return null;
}

/**
 * Check if a route has onboarding content available
 */
export function hasOnboardingContent(route: string): boolean {
  const featureId = getFeatureForRoute(route);
  return featureId !== null && !!allOnboardingContent[featureId];
}

/**
 * Get route priority for onboarding display order
 */
export function getRoutePriority(route: string): number {
  return ROUTE_PRIORITY[route] ?? 999;
}

/**
 * Check if route matches any of the target routes
 */
export function isTargetRoute(route: string): boolean {
  return route in ROUTE_FEATURE_MAP ||
         Object.keys(ROUTE_FEATURE_MAP).some(targetRoute => route.startsWith(targetRoute));
}

/**
 * Get all configured routes
 */
export function getConfiguredRoutes(): string[] {
  return Object.keys(ROUTE_FEATURE_MAP);
}

/**
 * Get route configuration
 */
export function getRouteConfig(): RouteOnboardingConfig[] {
  return Object.entries(ROUTE_FEATURE_MAP).map(([route, featureId]) => ({
    route,
    featureId,
    enabled: !!allOnboardingContent[featureId],
    priority: ROUTE_PRIORITY[route] ?? 999
  })).filter(config => config.enabled);
}

/**
 * Match current path to configured route
 * Handles both exact matches and pattern matching
 */
export function matchRoute(currentPath: string): string | null {
  // Normalize the path (remove trailing slashes, query params)
  const normalizedPath = currentPath.split('?')[0].replace(/\/$/, '') || '/';

  // Check exact match
  if (ROUTE_FEATURE_MAP[normalizedPath]) {
    return normalizedPath;
  }

  // Check prefix matches
  for (const route of Object.keys(ROUTE_FEATURE_MAP)) {
    if (normalizedPath.startsWith(route)) {
      return route;
    }
  }

  return null;
}

/**
 * Check if current path should trigger onboarding
 */
export function shouldTriggerForPath(currentPath: string): boolean {
  const matchedRoute = matchRoute(currentPath);
  return matchedRoute !== null && hasOnboardingContent(matchedRoute);
}