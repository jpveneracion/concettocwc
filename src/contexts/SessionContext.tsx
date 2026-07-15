'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import type { Session } from '@/lib/auth';

interface SessionContextType {
  session: Session | null;
  isLoading: boolean;
  error: string | null;
  refreshSession: () => Promise<void>;
}

const SessionContext = createContext<SessionContextType | undefined>(undefined);

interface SessionProviderProps {
  children: ReactNode;
}

export function SessionProvider({ children }: SessionProviderProps) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSession = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await fetch('/api/auth/session');
      if (response.ok) {
        const sessionData = await response.json();
        setSession(sessionData);
      } else {
        setSession(null);
      }
    } catch (err) {
      console.error('Failed to fetch session:', err);
      setError('Failed to fetch session');
      setSession(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSession();
  }, [fetchSession]);

  const refreshSession = useCallback(async () => {
    await fetchSession();
  }, [fetchSession]);

  return (
    <SessionContext.Provider value={{ session, isLoading, error, refreshSession }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  const context = useContext(SessionContext);
  if (context === undefined) {
    console.warn('useSession called outside of SessionProvider - using safe defaults');
    return {
      session: null,
      isLoading: false,
      error: null,
      refreshSession: async () => {
        console.warn('refreshSession called outside of SessionProvider - no-op');
      }
    };
  }
  return context;
}