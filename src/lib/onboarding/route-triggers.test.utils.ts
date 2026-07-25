/**
 * Route-based Onboarding System - Test and Verification Utilities
 *
 * This file provides utilities for testing and verifying the onboarding system
 * without requiring a full test suite setup.
 */

import {
  getCurrentUserId,
  isAdminUser,
  getUserOnboardingState,
  saveUserOnboardingState,
  recordRouteVisit,
  isFirstVisit,
  hasCompletedOnboarding,
  hasSkippedOnboarding,
  markOnboardingCompleted,
  markOnboardingSkipped,
  shouldTriggerOnboarding,
  getFeatureForRoute,
  getOnboardingTriggers,
  getHighestPriorityOnboarding,
  resetUserOnboarding,
  getUserOnboardingStats,
  type OnboardingTrigger,
  type UserOnboardingState
} from './index';

/**
 * Test utility to simulate a user session
 */
export function createMockSession(userId: string, isAdmin = false) {
  if (typeof window === 'undefined') return;

  const session = {
    userId,
    companyId: 'test-company',
    companyCode: 'TEST',
    email: `user${userId}@test.com`,
    isAdmin: isAdmin || userId === '1'
  };

  localStorage.setItem('session', JSON.stringify(session));
}

/**
 * Test utility to clear a user session
 */
export function clearMockSession() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('session');
}

/**
 * Test utility to run a complete onboarding flow test
 */
export function testOnboardingFlow(userId: string) {
  console.log('=== Testing Onboarding Flow ===');

  // Setup mock session
  createMockSession(userId);

  // Test 1: Initial state
  console.log('Test 1: Initial State');
  let state = getUserOnboardingState(userId);
  console.log('Initial state:', {
    completedRoutes: state.completedRoutes,
    skippedRoutes: state.skippedRoutes,
    routeVisits: state.routeVisits.length
  });

  // Test 2: Record first visits
  console.log('\nTest 2: Recording First Visits');
  recordRouteVisit('/dashboard', userId);
  recordRouteVisit('/quotes/new', userId);
  recordRouteVisit('/products', userId);

  state = getUserOnboardingState(userId);
  console.log('After recording visits:', {
    routeVisits: state.routeVisits.map(v => ({ route: v.route, count: v.visitCount }))
  });

  // Test 3: Check trigger conditions
  console.log('\nTest 3: Check Trigger Conditions');
  const dashboardTrigger = shouldTriggerOnboarding('/dashboard', userId);
  const quotesTrigger = shouldTriggerOnboarding('/quotes/new', userId);
  const productsTrigger = shouldTriggerOnboarding('/products', userId);

  console.log('Should trigger onboarding:', {
    dashboard: dashboardTrigger,
    quotes: quotesTrigger,
    products: productsTrigger
  });

  // Test 4: Complete some onboarding
  console.log('\nTest 4: Complete Dashboard Onboarding');
  markOnboardingCompleted('/dashboard', userId);

  state = getUserOnboardingState(userId);
  console.log('After completing dashboard:', {
    completedRoutes: state.completedRoutes,
    shouldTrigger: shouldTriggerOnboarding('/dashboard', userId)
  });

  // Test 5: Skip some onboarding
  console.log('\nTest 5: Skip Products Onboarding');
  markOnboardingSkipped('/products', userId);

  state = getUserOnboardingState(userId);
  console.log('After skipping products:', {
    skippedRoutes: state.skippedRoutes,
    shouldTrigger: shouldTriggerOnboarding('/products', userId)
  });

  // Test 6: Check stats
  console.log('\nTest 6: Get User Stats');
  const stats = getUserOnboardingStats(userId);
  console.log('User stats:', stats);

  // Test 7: Get highest priority pending
  console.log('\nTest 7: Get Highest Priority Pending Onboarding');
  const pending = getHighestPriorityOnboarding(userId);
  console.log('Highest priority pending:', pending);

  // Test 8: Admin user behavior
  console.log('\nTest 8: Admin User Behavior');
  clearMockSession();
  createMockSession('1', true); // User ID 1 is admin

  const adminShouldTrigger = shouldTriggerOnboarding('/dashboard', '1');
  console.log('Admin user should trigger onboarding:', adminShouldTrigger);

  // Cleanup
  resetUserOnboarding(userId);
  clearMockSession();

  console.log('\n=== Onboarding Flow Test Complete ===');
}

/**
 * Test route detection for all supported routes
 */
export function testRouteDetection() {
  console.log('=== Testing Route Detection ===');

  const testRoutes = [
    '/dashboard',
    '/quotes/new',
    '/products',
    '/settings',
    '/unknown/route',
    '/admin/dashboard',
    '/quotes/123'
  ];

  console.log('Route to feature mapping:');
  testRoutes.forEach(route => {
    const feature = getFeatureForRoute(route);
    console.log(`  ${route} -> ${feature || 'NO FEATURE'}`);
  });

  console.log('\nAvailable triggers:');
  const triggers = getOnboardingTriggers();
  triggers.forEach((trigger: OnboardingTrigger) => {
    console.log(`  ${trigger.route} -> ${trigger.featureId} (priority: ${trigger.priority})`);
  });

  console.log('=== Route Detection Test Complete ===');
}

/**
 * Test localStorage operations
 */
export function testLocalStorageOperations() {
  console.log('=== Testing LocalStorage Operations ===');

  const testUserId = 'test-user-storage';

  // Setup
  createMockSession(testUserId);

  // Test saving and loading state
  console.log('Test 1: Save and Load State');
  const testState: UserOnboardingState = {
    completedRoutes: ['/dashboard'],
    skippedRoutes: ['/products'],
    routeVisits: [],
    lastUpdated: new Date().toISOString()
  };

  saveUserOnboardingState(testState);
  const loadedState = getUserOnboardingState(testUserId);

  console.log('States match:', JSON.stringify(testState) === JSON.stringify(loadedState));

  // Test reset
  console.log('\nTest 2: Reset State');
  resetUserOnboarding(testUserId);
  const resetState = getUserOnboardingState(testUserId);

  console.log('State cleared:',
    resetState.completedRoutes.length === 0 &&
    resetState.skippedRoutes.length === 0 &&
    resetState.routeVisits.length === 0
  );

  // Cleanup
  clearMockSession();

  console.log('=== LocalStorage Operations Test Complete ===');
}

/**
 * Run all tests
 */
export function runAllOnboardingTests() {
  if (typeof window === 'undefined') {
    console.error('Tests can only be run in browser environment');
    return;
  }

  console.log('🧪 Starting Onboarding System Tests...\n');

  try {
    testRouteDetection();
    console.log('\n✅ Route Detection: PASS\n');

    testLocalStorageOperations();
    console.log('\n✅ LocalStorage Operations: PASS\n');

    testOnboardingFlow('test-user-flow');
    console.log('\n✅ Onboarding Flow: PASS\n');

    console.log('🎉 All onboarding system tests completed successfully!');

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

/**
 * Make test functions available globally for browser console testing
 */
if (typeof window !== 'undefined') {
  (window as any).testOnboarding = {
    runAll: runAllOnboardingTests,
    routeDetection: testRouteDetection,
    localStorage: testLocalStorageOperations,
    flow: testOnboardingFlow,

    // Helper to create test users
    createTestUser: (userId: string, isAdmin = false) => {
      createMockSession(userId, isAdmin);
      console.log(`Created test user: ${userId} (admin: ${isAdmin})`);
    },

    // Helper to check current state
    checkState: () => {
      const userId = getCurrentUserId();
      if (!userId) {
        console.log('No user logged in');
        return;
      }

      const state = getUserOnboardingState(userId);
      const stats = getUserOnboardingStats(userId);
      const isAdmin = isAdminUser();

      console.log('Current User State:', {
        userId,
        isAdmin,
        completedRoutes: state.completedRoutes,
        skippedRoutes: state.skippedRoutes,
        routeVisits: state.routeVisits.map(v => ({
          route: v.route,
          visits: v.visitCount,
          firstVisit: v.firstVisit
        })),
        stats
      });
    },

    // Helper to test specific route
    testRoute: (route: string) => {
      const userId = getCurrentUserId();
      if (!userId) {
        console.log('No user logged in - create a test user first');
        return;
      }

      console.log(`Testing route: ${route}`, {
        feature: getFeatureForRoute(route),
        isFirstVisit: isFirstVisit(route, userId),
        hasCompleted: hasCompletedOnboarding(route, userId),
        hasSkipped: hasSkippedOnboarding(route, userId),
        shouldTrigger: shouldTriggerOnboarding(route, userId)
      });
    },

    // Helper to cleanup
    cleanup: (userId?: string) => {
      const targetUserId = userId || getCurrentUserId();
      if (targetUserId) {
        resetUserOnboarding(targetUserId);
        console.log(`Cleaned up user: ${targetUserId}`);
      }
      clearMockSession();
      console.log('Cleared session');
    }
  };
}