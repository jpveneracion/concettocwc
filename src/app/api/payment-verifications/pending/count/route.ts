// src/app/api/payment-verifications/pending/count/route.ts

import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { getPendingVerificationCount } from '@/lib/db';

/**
 * GET /api/payment-verifications/pending/count
 *
 * Returns the count of pending payment verifications for admin dashboard badges
 * Requires admin authorization
 */
export async function GET(req: Request) {
  try {
    // 1. Admin Authorization Check
    await requireAdmin();

    // 2. Get pending verification count from database
    const count = await getPendingVerificationCount();

    // 3. Return count response
    return NextResponse.json({ count }, { status: 200 });

  } catch (error) {
    console.error('Pending verification count error:', error);

    // Check if admin authorization failed
    if (error instanceof Error && error.message.includes('Forbidden')) {
      return NextResponse.json(
        { error: 'Forbidden - Admin access required' },
        { status: 403 }
      );
    }

    // Check if unauthorized
    if (error instanceof Error && error.message.includes('Unauthorized')) {
      return NextResponse.json(
        { error: 'Unauthorized - Please log in' },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}