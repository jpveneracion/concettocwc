// src/app/api/payment-verifications/stats/route.ts

import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
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
    // 1. Admin Authorization Check
    await requireAdmin();

    // 2. Get verification statistics from database
    const stats = await getVerificationStats();

    // 3. Return stats response with proper typing
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