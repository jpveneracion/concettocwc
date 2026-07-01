import { cookies } from 'next/headers';

export interface Session {
  userId: string;
  companyId: string;
  companyCode: string;
  email: string;
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
