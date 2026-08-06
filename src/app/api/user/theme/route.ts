import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { query } from '@/lib/db';
import {
  validateAndSanitizeThemePreference,
  isThemePreferenceSizeValid,
} from '@/lib/theme-schema';

const DEFAULT_PREFERENCE = {
  themeId: 'light',
  mode: 'system',
  customTokens: null,
};

/**
 * GET /api/user/theme
 *
 * Retrieves the authenticated user's theme preference.
 * Returns the default preference when none has been saved.
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const result = await query(
      'SELECT theme_preference FROM users WHERE id = $1',
      [session.userId],
      session.companyId,
      session.role || 'user'
    );

    const preference = result.rows[0]?.theme_preference;
    return NextResponse.json({
      preference: preference || DEFAULT_PREFERENCE,
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
