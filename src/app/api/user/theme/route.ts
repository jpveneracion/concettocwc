import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { query } from '@/lib/db';
import {
  validateAndSanitizeThemePreference,
  isThemePreferenceSizeValid,
} from '@/lib/theme-schema';
import { canUseThemeEditor, PREMIUM_FEATURE_ERROR } from '@/lib/theme-entitlement';

const DEFAULT_PREFERENCE = {
  themeId: 'light',
  mode: 'system',
  customTokens: null,
};

/**
 * GET /api/user/theme
 *
 * Retrieves the authenticated user's theme preference.
 * Custom tokens are stripped unless the user is entitled to the theme editor
 * (redeemed an activation code). Returns the default preference when none saved.
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const entitled = await canUseThemeEditor(session.userId);

    const result = await query(
      'SELECT theme_preference FROM users WHERE id = $1',
      [session.userId],
      session.companyId,
      session.role || 'user'
    );

    const preference = (result.rows[0]?.theme_preference as Record<string, unknown> | undefined)
      || DEFAULT_PREFERENCE;

    // Defense in depth: never leak custom tokens to non-entitled users
    if (!entitled && preference && typeof preference === 'object') {
      delete (preference as { customTokens?: unknown }).customTokens;
    }

    return NextResponse.json({
      preference,
      entitlement: { themeEditor: entitled },
    });
  } catch (error) {
    console.error('Error fetching theme preference:', error);
    return NextResponse.json(
      { error: 'Failed to fetch theme preference' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/user/theme
 *
 * Validates and persists the authenticated user's theme preference.
 * Mode and themeId are free; customTokens (the theme editor) require
 * activation code entitlement (403 otherwise).
 */
export async function PUT(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();

    const sanitized = validateAndSanitizeThemePreference(body);
    if (!sanitized) {
      return NextResponse.json(
        { error: 'Invalid theme preference format' },
        { status: 400 }
      );
    }

    if (!isThemePreferenceSizeValid(sanitized)) {
      return NextResponse.json(
        { error: 'Theme preference too large (max 4KB)' },
        { status: 400 }
      );
    }

    // Server enforcement: customTokens require the premium tier
    if (sanitized.customTokens && Object.keys(sanitized.customTokens).length > 0) {
      const entitled = await canUseThemeEditor(session.userId);
      if (!entitled) {
        return NextResponse.json(PREMIUM_FEATURE_ERROR, { status: 403 });
      }
    }

    await query(
      'UPDATE users SET theme_preference = $1 WHERE id = $2',
      [JSON.stringify(sanitized), session.userId],
      session.companyId,
      session.role || 'user'
    );

    return NextResponse.json({
      preference: sanitized,
      message: 'Theme preference updated',
    });
  } catch (error) {
    console.error('Error updating theme preference:', error);
    return NextResponse.json(
      { error: 'Failed to update theme preference' },
      { status: 500 }
    );
  }
}
