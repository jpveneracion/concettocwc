/**
 * User Tracking System for Onboarding
 * Handles user-specific route visit tracking and onboarding completion state
 */

import { getRouteConfig } from './route-config';

/**
 * Individual route visit record
 */
export interface RouteVisit {
  route: string;
  firstVisit: string;
  visitCount: number;
  lastVisit: string;
}

/**
 * User onboarding state
 */
export interface UserOnboardingState {
  completedRoutes: string[];
  skippedRoutes: string[];
  routeVisits: RouteVisit[];
  lastUpdated: string;
}

/**
 * Storage key prefix for user onboarding data
 * Using same format as original implementation for backward compatibility
 */
const STORAGE_KEY_PREFIX = 'concetto_user_onboarding_';

/**
 * Get current user ID from session
 * This assumes a session storage format with userId field
 */
export function getCurrentUserId(): string | null {
  if (typeof window === 'undefined') return null;

  try {
    const sessionStr = localStorage.getItem('session');
    if (!sessionStr) return null;

    const session = JSON.parse(sessionStr);
    return session.userId || null;
  } catch {
    return null;
  }
}

/**
 * Check if current user is admin
 * Admin users bypass onboarding triggers
 */
export function isAdminUser(): boolean {
  if (typeof window === 'undefined') return false;

  try {
    const sessionStr = localStorage.getItem('session');
    if (!sessionStr) return false;

    const session = JSON.parse(sessionStr);
    // Check for admin flag or admin user ID
    return session.isAdmin || session.userId === '1' || false;
  } catch {
    return false;
  }
}

/**
 * Get storage key for user data
 */
function getStorageKey(userId: string): string {
  return `${STORAGE_KEY_PREFIX}${userId}`;
}

/**
 * Create empty user state
 */
function createEmptyState(): UserOnboardingState {
  return {
    completedRoutes: [],
    skippedRoutes: [],
    routeVisits: [],
    lastUpdated: new Date().toISOString()
  };
}

/**
 * Get user onboarding state from localStorage
 */
export function getUserTrackingState(userId?: string): UserOnboardingState {
  if (typeof window === 'undefined') {
    return createEmptyState();
  }

  const currentUserId = userId || getCurrentUserId();
  if (!currentUserId) {
    return createEmptyState();
  }

  try {
    const stateStr = localStorage.getItem(getStorageKey(currentUserId));
    if (stateStr) {
      return JSON.parse(stateStr) as UserOnboardingState;
    }
  } catch (error) {
    console.warn('Error parsing user tracking state:', error);
  }

  return createEmptyState();
}

/**
 * Save user onboarding state to localStorage
 */
export function saveUserTrackingState(state: UserOnboardingState, userId?: string): void {
  if (typeof window === 'undefined') return;

  const currentUserId = userId || getCurrentUserId();
  if (!currentUserId) return;

  try {
    state.lastUpdated = new Date().toISOString();
    localStorage.setItem(getStorageKey(currentUserId), JSON.stringify(state));
  } catch (error) {
    console.error('Error saving user tracking state:', error);
  }
}

/**
 * Record a route visit for a user
 */
export function recordRouteVisit(route: string, userId?: string): void {
  if (typeof window === 'undefined') return;

  const currentUserId = userId || getCurrentUserId();
  if (!currentUserId) return;

  const state = getUserTrackingState(currentUserId);
  const now = new Date().toISOString();

  // Find existing route visit
  const existingVisitIndex = state.routeVisits.findIndex(v => v.route === route);

  if (existingVisitIndex >= 0) {
    // Update existing visit
    state.routeVisits[existingVisitIndex].visitCount++;
    state.routeVisits[existingVisitIndex].lastVisit = now;
  } else {
    // Create new route visit
    state.routeVisits.push({
      route,
      firstVisit: now,
      visitCount: 1,
      lastVisit: now
    });
  }

  saveUserTrackingState(state, currentUserId);
}

/**
 * Get visit record for a specific route
 */
export function getRouteVisit(route: string, userId?: string): RouteVisit | null {
  if (typeof window === 'undefined') return null;

  const currentUserId = userId || getCurrentUserId();
  if (!currentUserId) return null;

  const state = getUserTrackingState(currentUserId);
  return state.routeVisits.find(v => v.route === route) || null;
}

/**
 * Check if this is the first visit to a route for the user
 */
export function isFirstVisit(route: string, userId?: string): boolean {
  const routeVisit = getRouteVisit(route, userId);

  // First visit if no record exists or visit count is 0
  return !routeVisit || routeVisit.visitCount === 0;
}

/**
 * Check if user has completed onboarding for a specific route
 */
export function hasCompletedOnboarding(route: string, userId?: string): boolean {
  if (typeof window === 'undefined') return false;

  const currentUserId = userId || getCurrentUserId();
  if (!currentUserId) return false;

  const state = getUserTrackingState(currentUserId);
  return state.completedRoutes.includes(route);
}

/**
 * Check if user has skipped onboarding for a specific route
 */
export function hasSkippedOnboarding(route: string, userId?: string): boolean {
  if (typeof window === 'undefined') return false;

  const currentUserId = userId || getCurrentUserId();
  if (!currentUserId) return false;

  const state = getUserTrackingState(currentUserId);
  return state.skippedRoutes.includes(route);
}

/**
 * Mark onboarding as completed for a route
 */
export function markOnboardingCompleted(route: string, userId?: string): void {
  if (typeof window === 'undefined') return;

  const currentUserId = userId || getCurrentUserId();
  if (!currentUserId) return;

  const state = getUserTrackingState(currentUserId);

  if (!state.completedRoutes.includes(route)) {
    state.completedRoutes.push(route);
  }

  // Remove from skipped if it was there
  state.skippedRoutes = state.skippedRoutes.filter(r => r !== route);

  saveUserTrackingState(state, currentUserId);
}

/**
 * Mark onboarding as skipped for a route
 */
export function markOnboardingSkipped(route: string, userId?: string): void {
  if (typeof window === 'undefined') return;

  const currentUserId = userId || getCurrentUserId();
  if (!currentUserId) return;

  const state = getUserTrackingState(currentUserId);

  if (!state.skippedRoutes.includes(route)) {
    state.skippedRoutes.push(route);
  }

  saveUserTrackingState(state, currentUserId);
}

/**
 * Get onboarding statistics for a user
 */
export function getUserOnboardingStats(userId?: string): {
  completed: number;
  skipped: number;
  pending: number;
  total: number;
  visited: number;
} {
  const state = getUserTrackingState(userId);
  const configuredRoutes = getRouteConfig();

  const completed = state.completedRoutes.length;
  const skipped = state.skippedRoutes.length;
  const total = configuredRoutes.length;
  const visited = state.routeVisits.length;
  const pending = total - completed - skipped;

  return { completed, skipped, pending, total, visited };
}

/**
 * Get all completed onboarding routes for a user
 */
export function getCompletedRoutes(userId?: string): string[] {
  const state = getUserTrackingState(userId);
  return [...state.completedRoutes];
}

/**
 * Get all skipped onboarding routes for a user
 */
export function getSkippedRoutes(userId?: string): string[] {
  const state = getUserTrackingState(userId);
  return [...state.skippedRoutes];
}

/**
 * Get all visited routes for a user
 */
export function getVisitedRoutes(userId?: string): RouteVisit[] {
  const state = getUserTrackingState(userId);
  return [...state.routeVisits];
}

/**
 * Reset onboarding state for a user (useful for testing)
 */
export function resetUserTracking(userId?: string): void {
  if (typeof window === 'undefined') return;

  const currentUserId = userId || getCurrentUserId();
  if (!currentUserId) return;

  localStorage.removeItem(getStorageKey(currentUserId));
}

/**
 * Check if user needs onboarding for a specific route
 */
export function needsOnboarding(route: string, userId?: string): boolean {
  return !hasCompletedOnboarding(route, userId) &&
         !hasSkippedOnboarding(route, userId);
}

/**
 * Check if onboarding should trigger for current route
 * Combines admin check, route eligibility, and user state
 */
export function shouldTriggerOnboarding(route: string, userId?: string): boolean {
  // Skip for admin users
  if (isAdminUser()) {
    return false;
  }

  const currentUserId = userId || getCurrentUserId();
  if (!currentUserId) {
    return false; // No user, no onboarding
  }

  // Import dynamically to avoid circular dependency
  const { hasOnboardingContent } = require('./route-config');

  // Check if route has onboarding content
  if (!hasOnboardingContent(route)) {
    return false; // No content for this route
  }

  // Check if already completed or skipped
  if (hasCompletedOnboarding(route, currentUserId) ||
      hasSkippedOnboarding(route, currentUserId)) {
    return false;
  }

  // Check if this is a first/recent visit
  return isFirstVisit(route, currentUserId);
}

/**
 * Get the highest priority pending onboarding for a user
 */
export function getHighestPriorityOnboarding(userId?: string): {
  route: string;
  featureId: string;
  priority: number;
} | null {
  const currentUserId = userId || getCurrentUserId();
  if (!currentUserId) return null;

  // Skip for admin users
  if (isAdminUser()) {
    return null;
  }

  const state = getUserTrackingState(currentUserId);

  // Import dynamically to avoid circular dependency
  const { getRouteConfig } = require('./route-config');
  const triggers = getRouteConfig();

  // Filter out completed and skipped routes
  const pendingTriggers = triggers.filter(
    (trigger: { route: string; priority: number }) => !state.completedRoutes.includes(trigger.route) &&
                !state.skippedRoutes.includes(trigger.route)
  );

  // Sort by priority and return the highest priority one
  pendingTriggers.sort((a: { route: string; priority: number }, b: { route: string; priority: number }) => a.priority - b.priority);

  return pendingTriggers.length > 0 ? pendingTriggers[0] : null;
}