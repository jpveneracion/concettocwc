/**
 * Theme utilities shared between server (FOUC seed) and client (ThemeContext).
 */

export type ThemeMode = 'light' | 'dark' | 'system';

export const THEME_COOKIE_NAME = 'cw-theme-mode';

export function isThemeMode(value: unknown): value is ThemeMode {
  return value === 'light' || value === 'dark' || value === 'system';
}

/**
 * Resolve which CSS theme block applies for a given preference.
 *
 * Rules:
 * - Branded presets (e.g. 'concetto-blue') are self-contained themes and win.
 * - Neutral presets ('light'/'dark') follow the mode (light | dark | system).
 * - 'system' mode resolves to the OS preference (`prefersDark`); on the server
 *   no OS preference is available, so it defaults to light.
 */
export function resolveEffectiveThemeId(
  themeId: string,
  mode: ThemeMode,
  prefersDark: boolean
): string {
  if (themeId !== 'light' && themeId !== 'dark') {
    return themeId;
  }
  if (mode === 'system') {
    return prefersDark ? 'dark' : 'light';
  }
  return mode;
}

export function getThemeModeCookie(): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(/(^|;) ?cw-theme-mode=([^;]*)(;|$)/);
  return match ? match[2] : null;
}

export function setThemeModeCookie(mode: ThemeMode): void {
  if (typeof document === 'undefined') return;
  document.cookie = `${THEME_COOKIE_NAME}=${mode}; path=/; max-age=31536000; SameSite=Lax`;
}
