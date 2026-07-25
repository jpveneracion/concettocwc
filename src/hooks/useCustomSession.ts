'use client';

import { useState, useEffect } from 'react';
import { useSession as useNextAuthSession } from 'next-auth/react';

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
 * but works with our custom cookie-based session system
 * Uses document.cookie for client-side session access
 */
export function useSession(): UseSessionReturn {
  const [session, setSession] = useState<Session | null>(null);
  const [status, setStatus] = useState<'loading' | 'authenticated' | 'unauthenticated'>('loading');

  useEffect(() => {
    function loadSessionFromCookie() {
      try {
        // Access session cookie directly from client-side
        const sessionCookie = document.cookie
          .split('; ')
          .find(row => row.startsWith('session='));

        if (!sessionCookie) {
          setSession(null);
          setStatus('unauthenticated');
          return;
        }

        // Parse the cookie value
        const cookieValue = sessionCookie.split('=')[1];
        const sessionData = JSON.parse(decodeURIComponent(cookieValue)) as Session;

        setSession(sessionData);
        setStatus('authenticated');
      } catch (error) {
        console.error('Failed to parse session cookie:', error);
        setSession(null);
        setStatus('unauthenticated');
      }
    }

    loadSessionFromCookie();

    // Set up interval to check for session changes
    const interval = setInterval(loadSessionFromCookie, 5000); // Check every 5 seconds

    return () => clearInterval(interval);
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