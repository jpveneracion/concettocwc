'use client';

import { useState, useEffect } from 'react';

export interface Session {
  userId: string;
  companyId: string;
  companyCode: string;
  email: string;
  role?: string;
  isAdmin?: boolean;
}

export interface UseSessionReturn {
  data: Session | null;
  status: 'loading' | 'authenticated' | 'unauthenticated';
}

/**
 * Custom hook that provides the same interface as next-auth's useSession
 * but works with our custom cookie-based session system.
 *
 * The session cookie is httpOnly, so it cannot be read via document.cookie.
 * Instead we fetch /api/auth/me which reads the cookie server-side.
 */
export function useSession(): UseSessionReturn {
  const [session, setSession] = useState<Session | null>(null);
  const [status, setStatus] = useState<'loading' | 'authenticated' | 'unauthenticated'>('loading');

  useEffect(() => {
    let cancelled = false;
    let inFlight = false;

    async function loadSession() {
      if (inFlight) return;
      inFlight = true;

      try {
        const response = await fetch('/api/auth/me', {
          method: 'GET',
          credentials: 'same-origin',
          headers: { Accept: 'application/json' }
        });

        if (!response.ok) {
          throw new Error(`Session endpoint returned ${response.status}`);
        }

        const data = await response.json();

        if (cancelled) return;

        if (data.userId) {
          setSession(data as Session);
          setStatus('authenticated');
        } else {
          setSession(null);
          setStatus('unauthenticated');
        }
      } catch (error) {
        console.error('Failed to fetch session:', error);
        if (!cancelled) {
          setSession(null);
          setStatus('unauthenticated');
        }
      } finally {
        inFlight = false;
      }
    }

    void loadSession();

    // Poll periodically so login/logout are picked up without a page reload
    const interval = setInterval(() => void loadSession(), 5000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return { data: session, status };
}

/**
 * Hook to get current company ID from session
 */
export function useCompanyId(): string | null {
  const { data: session } = useSession();
  return session?.companyId || null;
}

/**
 * Hook to check if current user is admin
 */
export function useIsAdmin(): boolean {
  const { data: session } = useSession();
  return session?.isAdmin || false;
}
