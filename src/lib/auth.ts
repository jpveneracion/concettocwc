import { cookies } from 'next/headers';

export interface Session {
  userId: string;
  companyId: string;
  companyCode: string;
  email: string;
  role?: string;
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
