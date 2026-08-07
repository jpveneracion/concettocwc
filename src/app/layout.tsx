import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import './globals.css';
import { Providers } from './providers';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { getSession } from '@/lib/auth';
import { query } from '@/lib/db';
import { canUseThemeEditor } from '@/lib/theme-entitlement';
import { resolveEffectiveThemeId, THEME_COOKIE_NAME, type ThemeMode } from '@/lib/theme-utils';
import type { ThemePreference } from '@/lib/theme-schema';

export const metadata: Metadata = {
  title: 'Concetto Window Blinds',
  description: 'Invoicing and order management for window blinds',
};

function buildFoucScript(effectiveThemeId: string, customTokens?: Record<string, string>): string {
  // Body only - the <script id="theme-prevent-fouc"> wrapper lives on the
  // React element itself. Embedding <script> tags in dangerouslySetInnerHTML
  // produces nested <script> elements, which the HTML parser truncates and
  // React hydration rejects as a server/client mismatch.
  const tokenStyles = customTokens
    ? Object.entries(customTokens)
        .map(
          ([key, value]) =>
            `document.documentElement.style.setProperty('--${key}', '${value}');`
        )
        .join('')
    : '';

  return [
    '(function() {',
    `  document.documentElement.dataset.theme = '${effectiveThemeId}';`,
    `  ${tokenStyles}`,
    '})();',
  ].join('');
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();

  let themePreference: ThemePreference | null = null;
  let anonymousMode: ThemeMode | null = null;
  let themeEditorEntitled = false;

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

    // Defense in depth: custom tokens are premium; never seed them without entitlement
    themeEditorEntitled = await canUseThemeEditor(session.userId);
  } else {
    const cookieStore = await cookies();
    const cookieMode = cookieStore.get(THEME_COOKIE_NAME)?.value;
    if (cookieMode === 'light' || cookieMode === 'dark' || cookieMode === 'system') {
      anonymousMode = cookieMode;
    }
  }

  let themeScript = '';
  if (themePreference) {
    const hasTokens =
      !!themePreference.customTokens &&
      Object.keys(themePreference.customTokens).length > 0;
    themeScript = buildFoucScript(
      resolveEffectiveThemeId(themePreference.themeId, themePreference.mode, false),
      themeEditorEntitled && hasTokens ? themePreference.customTokens : undefined
    );
  } else if (anonymousMode) {
    themeScript = buildFoucScript(resolveEffectiveThemeId('light', anonymousMode, false));
  }

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        {themeScript && (
          <script
            id="theme-prevent-fouc"
            dangerouslySetInnerHTML={{ __html: themeScript }}
          />
        )}
      </head>
      <body>
        <ErrorBoundary>
          <Providers themePreference={themePreference} themeEditorEntitled={themeEditorEntitled} isLoggedIn={Boolean(session?.userId)}>
            {children}
          </Providers>
        </ErrorBoundary>
      </body>
    </html>
  );
}
