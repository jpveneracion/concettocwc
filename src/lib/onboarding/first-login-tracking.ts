/**
 * First Login Detection System
 * Tracks whether a user has completed their first login onboarding
 */

const FIRST_LOGIN_KEY = 'concetto_first_login_onboarding_completed';

/**
 * Check if user has completed first login onboarding
 */
export function hasCompletedFirstLoginOnboarding(): boolean {
  if (typeof window === 'undefined') return false;

  try {
    return localStorage.getItem(FIRST_LOGIN_KEY) === 'true';
  } catch {
    return false;
  }
}

/**
 * Mark first login onboarding as completed
 */
export function markFirstLoginOnboardingCompleted(): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.setItem(FIRST_LOGIN_KEY, 'true');
  } catch (error) {
    console.error('Error marking first login onboarding complete:', error);
  }
}

/**
 * Reset first login onboarding (for testing or manual re-trigger)
 */
export function resetFirstLoginOnboarding(): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.removeItem(FIRST_LOGIN_KEY);
  } catch (error) {
    console.error('Error resetting first login onboarding:', error);
  }
}

/**
 * Check if this is eligible for first login onboarding
 * (authenticated + hasn't completed it yet)
 */
export function shouldShowFirstLoginOnboarding(): boolean {
  if (typeof window === 'undefined') return false;

  try {
    const sessionStr = localStorage.getItem('session');
    if (!sessionStr) return false;

    const session = JSON.parse(sessionStr);
    const isAuthenticated = !!session.userId;
    const isAdmin = session.isAdmin || session.userId === '1';

    return isAuthenticated && !isAdmin && !hasCompletedFirstLoginOnboarding();
  } catch {
    return false;
  }
}