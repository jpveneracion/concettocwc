import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import './globals.css';
import { Providers } from './providers';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { getSession } from '@/lib/auth';
import { query } from '@/lib/db';
import { resolveEffectiveThemeId, THEME_COOKIE_NAME, type ThemeMode } from '@/lib/theme-utils';
import type { ThemePreference } from '@/lib/theme-schema';

export const metadata: Metadata = {
  title: 'Concetto Window Blinds',
  description: 'Invoicing and order management for window blinds',
};

function buildFoucScript(effectiveThemeId: string, customTokens?: Record<string, string>): string {
  const tokenStyles = customTokens
    ? Object.entries(customTokens)
        .map(
          ([key, value]) =>
            `document.documentElement.style.setProperty('--${key}', '${value}');`
        )
        .join('')
    : '';

  return [
    '<script id="theme-prevent-fouc">',
    '(function() {',
    `  document.documentElement.dataset.theme = '${effectiveThemeId}';`,
    `  ${tokenStyles}`,
    '})();',
    '</script>',
  ].join('');
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();

  let themePreference: ThemePreference | null = null;
  let anonymousMode: ThemeMode | null = null;

  if (session?.userId) {
    try {
      const result = await query(
        'SELECT theme_preference FROM users WHERE id = $1',
        [session.userId],
        session.companyId,
        session.role || 'user'
      );
      themePreference = (result.rows[0]?.theme_preference as ThemePreference | undefined) ?? null;
    } catch (error) {
      console.error('Failed to load theme preference for FOUC seed:', error);
    }
  } else {
    const cookieStore = await cookies();
    const cookieMode = cookieStore.get(THEME_COOKIE_NAME)?.value;
    if (cookieMode === 'light' || cookieMode === 'dark' || cookieMode === 'system') {
      anonymousMode = cookieMode;
    }
  }

  let themeScript = '';
  if (themePreference) {
    // Server cannot detect prefers-color-scheme; client re-resolves system mode
    themeScript = buildFoucScript(
      resolveEffectiveThemeId(themePreference.themeId, themePreference.mode, false),
      themePreference.customTokens
    );
  } else if (anonymousMode) {
    themeScript = buildFoucScript(resolveEffectiveThemeId('light', anonymousMode, false));
  }

  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        {themeScript && (
          <div dangerouslySetInnerHTML={{ __html: themeScript }} />
        )}
      </head>
      <body>
        <ErrorBoundary>
          <Providers themePreference={themePreference}>
            {children}
          </Providers>
        </ErrorBoundary>
      </body>
    </html>
  );
}
