import { TOKEN_NAMES } from '@/types/theme';

/**
 * Wraps a function to force light theme during execution.
 * Used for PDF generation to ensure consistent print output
 * regardless of the user's dark mode or custom tokens.
 */
export async function withLightThemeForPrint<T>(fn: () => Promise<T>): Promise<T> {
  const originalTheme = document.documentElement.dataset.theme;
  const originalStyles = new Map<string, string>();

  TOKEN_NAMES.forEach((tokenName) => {
    const value = document.documentElement.style.getPropertyValue(`--${tokenName}`);
    if (value) {
      originalStyles.set(tokenName, value);
    }
  });

  try {
    // Force light theme
    document.documentElement.dataset.theme = 'light';

    // Clear custom inline styles
    TOKEN_NAMES.forEach((tokenName) => {
      document.documentElement.style.removeProperty(`--${tokenName}`);
    });

    return await fn();
  } finally {
    // Restore original theme
    document.documentElement.dataset.theme = originalTheme || 'light';

    // Restore custom inline styles
    originalStyles.forEach((value, tokenName) => {
      document.documentElement.style.setProperty(`--${tokenName}`, value);
    });
  }
}
