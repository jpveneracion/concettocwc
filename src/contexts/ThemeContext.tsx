'use client';

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from 'react';
import { ThemeTokens, TokenName, TOKEN_NAMES } from '@/types/theme';
import { presetThemes } from '@/config/theme';
import type { ThemePreference } from '@/lib/theme-schema';
import {
  resolveEffectiveThemeId,
  setThemeModeCookie,
  getThemeModeCookie,
  isThemeMode,
  type ThemeMode,
} from '@/lib/theme-utils';

interface ThemeContextValue {
  mode: ThemeMode;
  themeId: string;
  tokens: ThemeTokens;
  setMode: (mode: ThemeMode) => void;
  setTheme: (themeId: string) => void;
  updateTokens: (tokens: Partial<ThemeTokens>) => void;
  resetTokens: () => void;
  save: () => Promise<void>;
  saving: boolean;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
}

interface ThemeProviderProps {
  children: React.ReactNode;
  initialPreference?: ThemePreference | null;
}

export function ThemeProvider({ children, initialPreference }: ThemeProviderProps) {
  const [mode, setModeState] = useState<ThemeMode>(() => {
    if (initialPreference?.mode && isThemeMode(initialPreference.mode)) {
      return initialPreference.mode;
    }
    const cookieMode = getThemeModeCookie();
    if (cookieMode && isThemeMode(cookieMode)) {
      return cookieMode;
    }
    return 'system';
  });
  const [themeId, setThemeIdState] = useState<string>(
    initialPreference?.themeId || 'light'
  );
  const [customTokens, setCustomTokens] = useState<Partial<ThemeTokens>>(
    initialPreference?.customTokens || {}
  );
  const [saving, setSaving] = useState(false);
  const [prefersDark, setPrefersDark] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isLoggedIn = Boolean(initialPreference);

  // Track OS dark mode preference (for 'system' mode)
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    setPrefersDark(mediaQuery.matches);

    const handler = (e: MediaQueryListEvent) => setPrefersDark(e.matches);
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  const effectiveThemeId = resolveEffectiveThemeId(themeId, mode, prefersDark);

  // Apply theme to the document
  useEffect(() => {
    document.documentElement.dataset.theme = effectiveThemeId;

    Object.entries(customTokens).forEach(([key, value]) => {
      document.documentElement.style.setProperty(`--${key}`, value);
    });

    TOKEN_NAMES.forEach((tokenName) => {
      if (!(tokenName in customTokens)) {
        document.documentElement.style.removeProperty(`--${tokenName}`);
      }
    });
  }, [effectiveThemeId, customTokens]);

  const save = useCallback(async () => {
    if (!isLoggedIn) return;
    setSaving(true);
    try {
      const response = await fetch('/api/user/theme', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          themeId,
          mode,
          customTokens: Object.keys(customTokens).length > 0 ? customTokens : undefined,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save theme preference');
      }
    } catch (error) {
      console.error('Failed to save theme:', error);
      throw error;
    } finally {
      setSaving(false);
    }
  }, [isLoggedIn, themeId, mode, customTokens]);

  const setMode = useCallback((newMode: ThemeMode) => {
    setModeState(newMode);
    if (!isLoggedIn) {
      setThemeModeCookie(newMode);
    }
  }, [isLoggedIn]);

  const setTheme = useCallback((newThemeId: string) => {
    setThemeIdState(newThemeId);
    // Neutral presets ('light'/'dark') also drive the mode so both pickers stay consistent
    if (newThemeId === 'light' || newThemeId === 'dark') {
      setModeState(newThemeId);
      if (!isLoggedIn) {
        setThemeModeCookie(newThemeId);
      }
    }
  }, [isLoggedIn]);

  const updateTokens = useCallback((newTokens: Partial<ThemeTokens>) => {
    setCustomTokens((prev) => ({ ...prev, ...newTokens }));
  }, []);

  const resetTokens = useCallback(() => {
    setCustomTokens({});
  }, []);

  // Debounced save for token edits; immediate save for mode/theme changes
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(() => {
      save().catch(() => {
        // Never block the UI on a failed save
      });
    }, 500);
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [save]);

  const tokens: ThemeTokens = {
    ...presetThemes[effectiveThemeId],
    ...customTokens,
  };

  return (
    <ThemeContext.Provider
      value={{
        mode,
        themeId,
        tokens,
        setMode,
        setTheme,
        updateTokens,
        resetTokens,
        save,
        saving,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export type { TokenName };
