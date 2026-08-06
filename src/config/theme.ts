import { ThemeTokens } from '@/types/theme';

export const lightTheme: ThemeTokens = {
  bg: '#ffffff',
  surface: '#f8fafc',
  surface2: '#f1f5f9',
  border: '#e2e8f0',
  text: '#0f172a',
  'text-muted': '#64748b',
  primary: '#3b82f6',
  'primary-foreground': '#ffffff',
  success: '#22c55e',
  warning: '#f59e0b',
  danger: '#ef4444',
  ring: '#3b82f6',
};

export const darkTheme: ThemeTokens = {
  bg: '#0f172a',
  surface: '#1e293b',
  surface2: '#334155',
  border: '#475569',
  text: '#f8fafc',
  'text-muted': '#94a3b8',
  primary: '#60a5fa',
  'primary-foreground': '#0f172a',
  success: '#4ade80',
  warning: '#fbbf24',
  danger: '#f87171',
  ring: '#60a5fa',
};

export const concettoBlueTheme: ThemeTokens = {
  bg: '#ffffff',
  surface: '#eff6ff',
  surface2: '#dbeafe',
  border: '#bfdbfe',
  text: '#1e3a8a',
  'text-muted': '#64748b',
  primary: '#2563eb',
  'primary-foreground': '#ffffff',
  success: '#16a34a',
  warning: '#ea580c',
  danger: '#dc2626',
  ring: '#2563eb',
};

export const presetThemes: Record<string, ThemeTokens> = {
  light: lightTheme,
  dark: darkTheme,
  'concetto-blue': concettoBlueTheme,
};

export const defaultThemeId = 'light';
