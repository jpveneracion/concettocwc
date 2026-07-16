// src/app/api/payment-verifications/stats/route.ts

import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { requireAdmin } from '@/lib/permissions';
import { getVerificationStats } from '@/lib/db';
import type { VerificationStats } from '@/types/payment';

/**
 * GET /api/payment-verifications/stats
 *
 * Returns comprehensive verification statistics for admin dashboard
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

    // 3. Get verification statistics from database
    const stats = await getVerificationStats();

    // 4. Return stats response with proper typing
    const response: VerificationStats = {
      total_pending: stats.total_pending,
      pending_today: stats.pending_today,
      approved_today: stats.approved_today,
      rejected_today: stats.rejected_today,
      total_approved: stats.total_approved,
      total_rejected: stats.total_rejected
    };

    return NextResponse.json(response, { status: 200 });

  } catch (error) {
    console.error('Verification statistics error:', error);

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
        { error: 'Failed to retrieve verification statistics' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}