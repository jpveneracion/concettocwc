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

export async function getSession(): Promise<Session | null> {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('session');

    if (!sessionCookie) {
      return null;
    }

    const session = JSON.parse(sessionCookie.value) as Session;
    return session;
  } catch {
    return null;
  }
}

export async function requireSession(): Promise<Session> {
  const session = await getSession();

  if (!session) {
    throw new Error('Unauthorized');
  }

  return session;
}

export async function getCompanyId(): Promise<string> {
  const session = await requireSession();
  return session.companyId;
}

/**
 * Check if user has admin privileges
 * For production: Verify against database role field
 * For now: Check against admin user IDs (temporary solution)
 */
const ADMIN_USER_IDS: Set<string> = new Set(['1']); // User ID 1 is admin

export async function requireAdmin(): Promise<Session> {
  const session = await requireSession();

  // Check if user is in admin set (temporary solution)
  if (!ADMIN_USER_IDS.has(session.userId)) {
    throw new Error('Forbidden: Admin access required');
  }

  return session;
}

/**
 * Check if current session has admin privileges
 */
export async function isAdmin(): Promise<boolean> {
  try {
    const session = await requireSession();
    return ADMIN_USER_IDS.has(session.userId);
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
    console.log('✅ RLS context set for session:', session.userId, 'company:', session.companyId, 'role:', userRole);
  } catch (error) {
    console.error('❌ Failed to set RLS context for session:', error);
    // Don't fail session if RLS context setting fails
  }

  return session;
}

/**
 * Require session with RLS context
 * Ensures user is authenticated and RLS context is properly set
 *
 * @returns Session with RLS context established
 * @throws Error if not authenticated or RLS context fails
 */
export async function requireSessionWithRLS(): Promise<Session> {
  const session = await requireSession();

  // Set RLS context for this session
  try {
    const userRole = session.role || 'user';
    await setTenantContext(session.companyId, userRole);
    console.log('✅ RLS context set for required session:', session.userId, 'company:', session.companyId, 'role:', userRole);
  } catch (error) {
    console.error('❌ Failed to set RLS context for required session:', error);
    throw new Error('Failed to establish tenant context');
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
  if (!session.role || !['user', 'admin', 'superadmin'].includes(session.role)) {
    return {
      ...session,
      role: 'user'
    };
  }

  return session;
}

/**
 * Check if session has admin role (modern version using role field)
 * This replaces the temporary ADMIN_USER_IDS check
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
    console.log('✅ Session context reset');
  } catch (error) {
    console.error('❌ Failed to reset session context:', error);
    // Don't throw - this is cleanup code
  }
}
