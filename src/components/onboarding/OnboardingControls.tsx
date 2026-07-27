'use client';

import React from 'react';
import { useOnboardingContext } from '@/components/onboarding';
import { resetFirstLoginOnboarding } from '@/lib/onboarding/first-login-tracking';
import { getUserTrackingState, saveUserTrackingState } from '@/lib/onboarding/user-tracking';
import { BookOpen, RotateCcw } from 'lucide-react';

/**
 * OnboardingControls - Component to manage onboarding state
 * Can be added to settings page or help menu
 */
export function OnboardingControls() {
  const { triggerOnboarding, triggerGeneralOnboarding, stats } = useOnboardingContext();

  const handleResetGeneralOnboarding = () => {
    resetFirstLoginOnboarding();
    triggerGeneralOnboarding();
  };

  const handleResetFeatureOnboarding = (featureId: string, route: string) => {
    const userId = getCurrentUserId();
    if (!userId) return;

    const state = getUserTrackingState(userId);

    // Remove from completed and skipped routes
    state.completedRoutes = state.completedRoutes.filter(r => r !== route);
    state.skippedRoutes = state.skippedRoutes.filter(r => r !== route);

    saveUserTrackingState(state, userId);

    // Trigger the onboarding for that route
    triggerOnboarding(route);
  };

  const handleResetAllOnboarding = () => {
    const userId = getCurrentUserId();
    if (!userId) return;

    // Reset first login
    resetFirstLoginOnboarding();

    // Reset all route onboarding
    const state = getUserTrackingState(userId);
    state.completedRoutes = [];
    state.skippedRoutes = [];
    saveUserTrackingState(state, userId);

    // Show general onboarding
    triggerGeneralOnboarding();
  };

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-lg shadow p-4">
        <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <BookOpen className="w-5 h-5" />
          Onboarding & Guides
        </h3>

        <div className="space-y-3">
          {/* General Onboarding */}
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div>
              <h4 className="font-medium text-gray-900">Platform Tour</h4>
              <p className="text-sm text-gray-600">General introduction to Concetto</p>
            </div>
            <button
              onClick={handleResetGeneralOnboarding}
              className="flex items-center gap-2 px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              View Again
            </button>
          </div>

          {/* Feature Onboarding */}
          <div className="space-y-2">
            <h4 className="font-medium text-gray-900">Feature Guides</h4>

            <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
              <span className="text-sm">Dashboard Guide</span>
              <button
                onClick={() => handleResetFeatureOnboarding('dashboard', '/dashboard')}
                className="text-xs px-2 py-1 bg-gray-200 hover:bg-gray-300 rounded transition-colors"
              >
                View Again
              </button>
            </div>

            <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
              <span className="text-sm">Quotes Guide</span>
              <button
                onClick={() => handleResetFeatureOnboarding('quotes', '/quotes/new')}
                className="text-xs px-2 py-1 bg-gray-200 hover:bg-gray-300 rounded transition-colors"
              >
                View Again
              </button>
            </div>

            <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
              <span className="text-sm">Products Guide</span>
              <button
                onClick={() => handleResetFeatureOnboarding('products', '/products')}
                className="text-xs px-2 py-1 bg-gray-200 hover:bg-gray-300 rounded transition-colors"
              >
                View Again
              </button>
            </div>

            <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
              <span className="text-sm">Settings Guide</span>
              <button
                onClick={() => handleResetFeatureOnboarding('settings', '/settings')}
                className="text-xs px-2 py-1 bg-gray-200 hover:bg-gray-300 rounded transition-colors"
              >
                View Again
              </button>
            </div>
          </div>

          {/* Reset All */}
          <button
            onClick={handleResetAllOnboarding}
            className="w-full py-2 px-4 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 transition-colors text-sm"
          >
            Reset All Onboarding
          </button>

          {/* Stats */}
          <div className="pt-3 border-t text-xs text-gray-500">
            <div className="flex justify-between">
              <span>Completed: {stats.completed}</span>
              <span>Pending: {stats.pending}</span>
              <span>Total: {stats.total}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Helper function to get current user ID
function getCurrentUserId(): string | null {
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