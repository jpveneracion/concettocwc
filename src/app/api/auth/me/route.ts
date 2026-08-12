// src/app/api/auth/me/route.ts

import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';

/**
 * Client-side session bridge.
 * Reads the httpOnly session cookie server-side and returns the session payload,
 * so client hooks (useCustomSession, onboarding triggers) can authenticate reliably.
 */
export async function GET() {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json({
        userId: null,
        companyId: null,
        companyCode: null,
        email: null,
        role: null,
        isAdmin: false
      });
    }

    return NextResponse.json({
      userId: session.userId,
      companyId: session.companyId,
      companyCode: session.companyCode,
      email: session.email,
      role: session.role ?? null,
      isAdmin: session.isAdmin ?? false
    });
  } catch (error) {
    console.error('GET /api/auth/me error:', error);
    return NextResponse.json({
      userId: null,
      companyId: null,
      companyCode: null,
      email: null,
      role: null,
      isAdmin: false
    });
  }
}
