import { ThemeTokens, TOKEN_NAMES } from '@/types/theme';
import { presetThemes } from '@/config/theme';

export interface ThemePreference {
  themeId: string;
  mode: 'light' | 'dark' | 'system';
  customTokens?: Partial<ThemeTokens>;
}

const HEX_COLOR_REGEX = /^#[0-9A-Fa-f]{6}$/;

const MAX_THEME_PREFERENCE_SIZE = 4096; // 4 KB

export function isThemePreference(obj: unknown): obj is ThemePreference {
  if (typeof obj !== 'object' || obj === null) return false;

  const pref = obj as ThemePreference;

  // Check themeId
  if (typeof pref.themeId !== 'string' || !(pref.themeId in presetThemes)) {
    return false;
  }

  // Check mode
  if (pref.mode !== 'light' && pref.mode !== 'dark' && pref.mode !== 'system') {
    return false;
  }

  // Check customTokens if present
  if (pref.customTokens) {
    if (typeof pref.customTokens !== 'object' || Array.isArray(pref.customTokens)) {
      return false;
    }

    for (const [key, value] of Object.entries(pref.customTokens)) {
      if (typeof value !== 'string' || !HEX_COLOR_REGEX.test(value)) {
        return false;
      }
    }
  }

  return true;
}

export function validateAndSanitizeThemePreference(input: unknown): ThemePreference | null {
  if (!isThemePreference(input)) return null;

  const sanitized: ThemePreference = {
    themeId: input.themeId,
    mode: input.mode,
  };

  // Sanitize: drop unknown keys from customTokens, keep only known tokens
  if (input.customTokens) {
    const clampedTokens: Partial<ThemeTokens> = {};
    for (const key of Object.keys(input.customTokens)) {
      if ((TOKEN_NAMES as readonly string[]).includes(key)) {
        clampedTokens[key as keyof ThemeTokens] = input.customTokens[key as keyof ThemeTokens];
      }
    }
    if (Object.keys(clampedTokens).length > 0) {
      sanitized.customTokens = clampedTokens;
    }
  }

  return sanitized;
}

export function calculateJsonSize(obj: unknown): number {
  return JSON.stringify(obj).length;
}

export function isThemePreferenceSizeValid(pref: ThemePreference): boolean {
  return calculateJsonSize(pref) <= MAX_THEME_PREFERENCE_SIZE;
}
