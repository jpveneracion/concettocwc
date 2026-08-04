import { cookies } from 'next/headers';
import { setTenantContext, resetTenantContext, type RLSUserRole } from './rls';

export interface Session {
  userId: string;
  companyId: string;
  companyCode: string;
  email: string;
  role?: RLSUserRole;
  isAdmin?: boolean;
}

export interface AuthError extends Error {
  code: 'SESSION_NOT_FOUND' | 'PARSE_ERROR' | 'UNAUTHORIZED' | 'FORBIDDEN' | 'CONTEXT_ERROR';
  mobileMessage: string;
}

class AuthErrorImpl extends Error implements AuthError {
  code: AuthError['code'];
  mobileMessage: string;

  constructor(code: AuthError['code'], message: string, mobileMessage: string) {
    super(message);
    this.name = 'AuthError';
    this.code = code;
    this.mobileMessage = mobileMessage;
  }
}

export async function getSession(): Promise<Session | null> {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('session');

    if (!sessionCookie) {
      return null;
    }

    const session = JSON.parse(sessionCookie.value) as Session;
    return session;
  } catch (error) {
    // Log parse errors but return null for graceful degradation
    if (error instanceof SyntaxError) {
      console.warn('Session parse error - clearing invalid cookie');
      // Could clear invalid cookie here if needed
    }
    return null;
  }
}

export async function requireSession(): Promise<Session> {
  const session = await getSession();

  if (!session) {
    throw new AuthErrorImpl(
      'UNAUTHORIZED',
      'Authentication required',
      'Please sign in to continue'
    );
  }

  return session;
}

export async function getCompanyId(): Promise<string> {
  const session = await requireSession();
  return session.companyId;
}

/**
 * Check if user has admin privileges
 * Uses role-based access control from Session
 */
export async function requireAdmin(): Promise<Session> {
  const session = await requireSession();

  // Use role-based check instead of hardcoded IDs
  const userRole = session.role || 'user';
  const hasAdminPrivileges = userRole === 'admin' || userRole === 'superadmin' || session.isAdmin === true;

  if (!hasAdminPrivileges) {
    throw new AuthErrorImpl(
      'FORBIDDEN',
      'Admin access required',
      'Admin access required for this action'
    );
  }

  return session;
}

/**
 * Check if current session has admin privileges
 */
export async function isAdmin(): Promise<boolean> {
  try {
    const session = await getSession();
    if (!session) {
      return false;
    }

    const userRole = session.role || 'user';
    return userRole === 'admin' || userRole === 'superadmin' || session.isAdmin === true;
  } catch {
    return false;
  }
}

/**
 * Get session with RLS context automatically set
 * This ensures tenant context is properly established for authenticated requests
 *
 * @returns Session with RLS context set, or null if no session
 */
export async function getSessionWithRLS(): Promise<Session | null> {
  const session = await getSession();

  if (!session) {
    return null;
  }

  // Set RLS context for this session
  try {
    const userRole = session.role || 'user';
    await setTenantContext(session.companyId, userRole);
    // Success - context set silently without console spam
  } catch (error) {
    // Log but don't fail - allow graceful degradation
    console.warn('RLS context warning:', error instanceof Error ? error.message : 'Unknown error');
    // Don't fail session if RLS context setting fails
  }

  return session;
}

/**
 * Require session with RLS context
 * Ensures user is authenticated and RLS context is properly set
 *
 * @returns Session with RLS context established
 * @throws AuthError if not authenticated or RLS context fails
 */
export async function requireSessionWithRLS(): Promise<Session> {
  const session = await requireSession();

  // Set RLS context for this session
  try {
    const userRole = session.role || 'user';
    await setTenantContext(session.companyId, userRole);
    // Success - context set silently
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown context error';
    throw new AuthErrorImpl(
      'CONTEXT_ERROR',
      `Failed to establish tenant context: ${errorMessage}`,
      'Session setup failed - please try again'
    );
  }

  return session;
}

/**
 * Validate and normalize session role
 * Ensures session has a valid role and handles legacy sessions without role
 *
 * @param session - The session to validate
 * @returns Session with guaranteed valid role
 */
export function validateSessionRole(session: Session): Session {
  // If no role or invalid role, default to 'user'
  const validRoles: RLSUserRole[] = ['user', 'admin', 'superadmin'];

  if (!session.role || !validRoles.includes(session.role)) {
    return {
      ...session,
      role: 'user'
    };
  }

  return session;
}

/**
 * Check if session has admin role (modern version using role field)
 *
 * @returns true if user has admin or superadmin role
 */
export async function hasAdminRole(): Promise<boolean> {
  try {
    const session = await getSession();
    if (!session) {
      return false;
    }

    const userRole = session.role || 'user';
    return userRole === 'admin' || userRole === 'superadmin';
  } catch {
    return false;
  }
}

/**
 * Check if session has superadmin role
 *
 * @returns true if user has superadmin role
 */
export async function hasSuperadminRole(): Promise<boolean> {
  try {
    const session = await getSession();
    if (!session) {
      return false;
    }

    return session.role === 'superadmin';
  } catch {
    return false;
  }
}

/**
 * Reset RLS context (should be called at the end of requests)
 * This ensures proper cleanup and context isolation
 */
export async function resetSessionContext(): Promise<void> {
  try {
    await resetTenantContext();
    // Silent success - no console spam
  } catch (error) {
    // Log but don't throw - this is cleanup code that shouldn't break requests
    console.warn('Session context reset warning:', error instanceof Error ? error.message : 'Unknown error');
  }
}
