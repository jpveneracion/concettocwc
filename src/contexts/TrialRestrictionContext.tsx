'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode, useMemo } from 'react';
import { usePathname } from 'next/navigation';
import type { RestrictionState, RestrictionLevel } from '@/types/trial-restrictions';

interface TrialRestrictionContextType {
  // Current restriction state
  state: RestrictionState;

  // Convenient boolean flags for common checks
  canCreateFutureOrders: boolean;
  canViewDashboard: boolean;
  canCreatePastOrders: boolean;
  /**
   * Maximum allowed order date (YYYY-MM-DD) for the date input max attribute.
   * null = no limit (subscribed).
   */
  maxOrderDate: string | null;

  // Loading/error states
  isLoading: boolean;
  error: string | null;

  // Refresh function (call after subscription changes)
  refreshRestrictions: () => Promise<void>;
}

const TrialRestrictionContext = createContext<TrialRestrictionContextType | undefined>(undefined);

interface TrialRestrictionProviderProps {
  children: ReactNode;
}

export function TrialRestrictionProvider({ children }: TrialRestrictionProviderProps) {
  const pathname = usePathname();
  // Default to restrictive - block future orders until server confirms trial is active
  const [state, setState] = useState<RestrictionState>({
    level: 'partial' as RestrictionLevel,
    trialExpired: true,
    trialExpiresAt: null,
    subscriptionActive: false,
    allowedOperations: [],
    canCreatePastOrders: true,
    canCreateFutureOrders: false,
    maxOrderDate: null
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRestrictionState = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await fetch('/api/trial/restrictions');

      if (!response.ok) {
        throw new Error('Failed to fetch restriction state');
      }

      const restrictionState = await response.json();
      setState(restrictionState);
    } catch (err) {
      console.error('Failed to fetch restriction state:', err);
      setError('Failed to load restriction state');
      // Fail closed - assume user is restricted if we can't verify their trial status
      setState({
        level: 'partial' as RestrictionLevel,
        trialExpired: true,
        trialExpiresAt: null,
        subscriptionActive: false,
        allowedOperations: [],
        canCreatePastOrders: true,
        canCreateFutureOrders: false,
        maxOrderDate: null
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRestrictionState();
  }, [fetchRestrictionState, pathname]);

  const refreshRestrictions = useCallback(async () => {
    await fetchRestrictionState();
  }, [fetchRestrictionState]);

  // Memoized computed values for performance
  const contextValue = useMemo(() => ({
    state,
    canCreateFutureOrders: state.canCreateFutureOrders,
    canViewDashboard: true, // Always true after trial
    canCreatePastOrders: state.canCreatePastOrders,
    maxOrderDate: state.maxOrderDate,
    isLoading,
    error,
    refreshRestrictions
  }), [state, isLoading, error, refreshRestrictions]);

  return (
    <TrialRestrictionContext.Provider value={contextValue}>
      {children}
    </TrialRestrictionContext.Provider>
  );
}

export function useTrialRestrictions() {
  const context = useContext(TrialRestrictionContext);
  if (context === undefined) {
    // Context not available - return safe defaults instead of throwing error
    console.warn('useTrialRestrictions called outside of TrialRestrictionProvider - using safe defaults');
    return {
      state: {
        level: 'partial' as RestrictionLevel,
        trialExpired: true,
        trialExpiresAt: null,
        subscriptionActive: false,
        allowedOperations: [],
        canCreatePastOrders: true,
        canCreateFutureOrders: false,
        maxOrderDate: null
      },
      canCreateFutureOrders: false,
      canViewDashboard: true,
      canCreatePastOrders: true,
      maxOrderDate: null,
      isLoading: false,
      error: null,
      refreshRestrictions: async () => {
        console.warn('refreshRestrictions called outside of TrialRestrictionProvider - no-op');
      }
    };
  }
  return context;
}