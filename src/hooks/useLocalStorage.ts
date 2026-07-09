'use client';

import { useState, useEffect, useCallback } from 'react';

/**
 * Custom React hook for localStorage with SSR safety and mobile browser error handling
 * @param key - The localStorage key
 * @param initialValue - The initial value if no stored value exists
 * @returns [storedValue, setValue] tuple like useState
 */
function useLocalStorage<T>(key: string, initialValue: T): [T, (value: T | ((val: T) => T)) => void] {
  // State to store our value
  const [storedValue, setStoredValue] = useState<T>(initialValue);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);

    try {
      // Get from local storage by key
      const item = window.localStorage.getItem(key);

      if (item !== null) {
        // Parse stored json or if none return initialValue
        setStoredValue(JSON.parse(item));
      }
    } catch (error) {
      // Handle mobile browser quirks (iOS Safari private browsing, quota limits, etc.)
      console.warn(`Error reading localStorage key "${key}":`, error);
      // Keep initial value on error
    }
  }, [key]);

  // Return a wrapped version of useState's setter function that persists the new value to localStorage
  const setValue = useCallback((value: T | ((val: T) => T)) => {
    try {
      // Allow value to be a function so we have same API as useState
      const valueToStore = value instanceof Function ? value(storedValue) : value;

      // Save state
      setStoredValue(valueToStore);

      // Save to local storage (only if mounted and window is available)
      if (isMounted && typeof window !== 'undefined') {
        window.localStorage.setItem(key, JSON.stringify(valueToStore));
      }
    } catch (error) {
      // Handle mobile browser quirks (iOS Safari private browsing, quota limits, etc.)
      console.warn(`Error setting localStorage key "${key}":`, error);
      // State update still succeeds even if localStorage fails
    }
  }, [key, storedValue, isMounted]);

  return [storedValue, setValue];
}

/**
 * Hook to clear a specific localStorage key
 * @param key - The localStorage key to clear
 */
export function useClearLocalStorage() {
  const clearKey = useCallback((key: string) => {
    try {
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem(key);
      }
    } catch (error) {
      console.warn(`Error clearing localStorage key "${key}":`, error);
    }
  }, []);

  return clearKey;
}

export default useLocalStorage;