import { NextResponse } from 'next/server';
import type { PiUserInfo } from '@/types/oauth';
import { findOAuthAccount } from '@/lib/oauth';
import { query } from '@/lib/db';
import { cookies } from 'next/headers';

export async function POST(req: Request) {
  try {
    const { access_token } = await req.json();

    if (!access_token) {
      return NextResponse.json({ error: 'Access token required' }, { status: 400 });
    }

    // Validate token with Pi Network API
    const piResponse = await fetch('https://api.minepi.com/v2/me', {
      headers: { 'Authorization': `Bearer ${access_token}` }
    });

    if (!piResponse.ok) {
      return NextResponse.json({ error: 'Invalid Pi token' }, { status: 401 });
    }

    const piUser: PiUserInfo = await piResponse.json();

    // Check for existing Pi account
    const existingAccount = await findOAuthAccount('pi', piUser.uid);

    if (existingAccount) {
      // Create session for existing user.
      // NOTE: must use the SECURITY DEFINER lookup (find_user_by_id) - a raw
      // SELECT on users is blocked by RLS before tenant context exists, which
      // previously made existing users look company-less and routed them back
      // to account-choice, where linking the Pi account failed with a
      // duplicate key violation.
      const userResult = await query<{
        user_id: string;
        user_email: string | null;
        user_company_id: string | null;
      }>(
        'SELECT * FROM find_user_by_id($1)',
        [existingAccount.user_id]
      );
      const user = userResult.rows[0];

      if (!user || !user.user_company_id) {
        // User exists but no company - redirect to account choice
        return NextResponse.json({
          redirect: '/auth/account-choice',
          tempToken: access_token,
          piUser: piUser
        });
      }

      // Set session cookie
      const cookieStore = await cookies();
      cookieStore.set('session', JSON.stringify({
        userId: user.user_id,
        companyId: user.user_company_id,
        email: user.user_email,
        provider: 'pi'
      }), {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 7,
        path: '/',
      });

      return NextResponse.json({ success: true, redirect: '/dashboard' });
    }

    // New Pi user - redirect to account choice
    return NextResponse.json({
      redirect: '/auth/account-choice',
      tempToken: access_token,
      piUser: piUser
    });

  } catch (error) {
    console.error('Pi callback error:', error);
    return NextResponse.json({ error: 'Authentication failed' }, { status: 500 });
  }
}