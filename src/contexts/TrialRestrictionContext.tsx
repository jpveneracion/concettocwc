'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode, useMemo } from 'react';
import type { RestrictionState, RestrictionLevel } from '@/types/trial-restrictions';

interface TrialRestrictionContextType {
  // Current restriction state
  state: RestrictionState;

  // Convenient boolean flags for common checks
  canCreateFutureOrders: boolean;
  canViewDashboard: boolean;
  canCreatePastOrders: boolean;

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
  const [state, setState] = useState<RestrictionState>({
    level: 'none' as RestrictionLevel,
    trialExpired: false,
    trialExpiresAt: null,
    subscriptionActive: false,
    allowedOperations: [],
    canCreatePastOrders: true,
    canCreateFutureOrders: true
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
      // Set safe defaults on error
      setState({
        level: 'none' as RestrictionLevel,
        trialExpired: false,
        trialExpiresAt: null,
        subscriptionActive: false,
        allowedOperations: [],
        canCreatePastOrders: true,
        canCreateFutureOrders: true
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRestrictionState();
  }, [fetchRestrictionState]);

  const refreshRestrictions = useCallback(async () => {
    await fetchRestrictionState();
  }, [fetchRestrictionState]);

  // Memoized computed values for performance
  const contextValue = useMemo(() => ({
    state,
    canCreateFutureOrders: state.canCreateFutureOrders,
    canViewDashboard: true, // Always true after trial
    canCreatePastOrders: state.canCreatePastOrders,
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
        level: 'none' as RestrictionLevel,
        trialExpired: false,
        trialExpiresAt: null,
        subscriptionActive: false,
        allowedOperations: [],
        canCreatePastOrders: true,
        canCreateFutureOrders: true
      },
      canCreateFutureOrders: true,
      canViewDashboard: true,
      canCreatePastOrders: true,
      isLoading: false,
      error: null,
      refreshRestrictions: async () => {
        console.warn('refreshRestrictions called outside of TrialRestrictionProvider - no-op');
      }
    };
  }
  return context;
}