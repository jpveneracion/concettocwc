// src/app/api/payment-verifications/pending/count/route.ts

import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { requireAdmin } from '@/lib/permissions';
import { getPendingVerificationCount } from '@/lib/db';

/**
 * GET /api/payment-verifications/pending/count
 *
 * Returns the count of pending payment verifications for admin dashboard badges
 * Requires admin authorization
 */
export async function GET(req: Request) {
  try {
    // 1. Authentication Check
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized - Please log in' },
        { status: 401 }
      );
    }

    // 2. Admin Authorization Check
    try {
      await requireAdmin(session.userId);
    } catch (authError) {
      if (authError instanceof Error && authError.message.includes('Forbidden')) {
        return NextResponse.json(
          { error: 'Forbidden - Admin access required' },
          { status: 403 }
        );
      }
      throw authError;
    }

    // 3. Get pending verification count from database
    const count = await getPendingVerificationCount();

    // 4. Return count response
    return NextResponse.json({ count }, { status: 200 });

  } catch (error) {
    console.error('Pending verification count error:', error);

    // Handle authorization errors
    if (error instanceof Error && error.message.includes('Forbidden')) {
      return NextResponse.json(
        { error: 'Forbidden - Admin access required' },
        { status: 403 }
      );
    }

    // Handle database errors
    if (error instanceof Error) {
      return NextResponse.json(
        { error: 'Failed to retrieve pending count' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}