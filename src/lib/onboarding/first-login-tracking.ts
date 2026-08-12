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
 * Minimal session shape used for the first-login eligibility check.
 * Avoids importing server-only modules (next/headers) into client code.
 */
export interface FirstLoginSessionLike {
  userId?: string | null;
  role?: string | null;
  isAdmin?: boolean;
}

/**
 * Check if this is eligible for first login onboarding
 * (authenticated + not an admin + hasn't completed it yet)
 *
 * @param session The client session (from useSession). When provided, the
 *        session is trusted; otherwise falls back to the legacy localStorage
 *        'session' key for backward compatibility.
 */
export function shouldShowFirstLoginOnboarding(session?: FirstLoginSessionLike | null): boolean {
  if (typeof window === 'undefined') return false;

  try {
    let isAuthenticated = false;
    let isAdmin = false;

    if (session) {
      isAuthenticated = !!session.userId;
      const userRole = session.role || 'user';
      isAdmin = userRole === 'admin' || userRole === 'superadmin' || session.isAdmin === true;
    } else {
      // Legacy fallback: read the session from localStorage if present
      const sessionStr = localStorage.getItem('session');
      if (!sessionStr) return false;

      const legacySession = JSON.parse(sessionStr);
      isAuthenticated = !!legacySession.userId;
      isAdmin = legacySession.isAdmin || legacySession.userId === '1';
    }

    return isAuthenticated && !isAdmin && !hasCompletedFirstLoginOnboarding();
  } catch {
    return false;
  }
}