import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { requireAdmin } from '@/lib/permissions';
import { rollbackPricing, invalidatePricingCache } from '@/lib/pricing-service';
import type { PricingConfig } from '@/lib/pricing-service';

/**
 * POST /api/admin/pricing/rollback
 *
 * Rolls back to a previous pricing configuration
 * Request body:
 * - history_id: ID of the history entry to rollback to
 * - reason: Reason for the rollback
 */
export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    await requireAdmin(session.userId);

    const body = await req.json();

    // Validate required fields
    if (!body.history_id || typeof body.history_id !== 'string' || body.history_id.trim().length === 0) {
      return NextResponse.json(
        { error: 'history_id is required and cannot be empty' },
        { status: 400 }
      );
    }

    if (!body.reason || typeof body.reason !== 'string' || body.reason.trim().length === 0) {
      return NextResponse.json(
        { error: 'reason is required and cannot be empty' },
        { status: 400 }
      );
    }

    // Perform rollback
    const restoredPricing = await rollbackPricing(
      body.history_id,
      session.userId,
      body.reason
    );

    // Invalidate cache to ensure restored pricing is used
    invalidatePricingCache();

    return NextResponse.json({
      success: true,
      data: restoredPricing,
      message: 'Pricing configuration rolled back successfully'
    });

  } catch (error) {
    console.error('Rollback pricing error:', error);

    if (error instanceof Error && error.message.includes('History entry not found')) {
      return NextResponse.json(
        { error: 'History entry not found' },
        { status: 404 }
      );
    }

    if (error instanceof Error && error.message.includes('No previous configuration found')) {
      return NextResponse.json(
        { error: 'No previous configuration found in history entry' },
        { status: 400 }
      );
    }

    if (error instanceof Error && error.message.includes('Forbidden')) {
      return NextResponse.json(
        { error: 'Forbidden - Admin access required' },
        { status: 403 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to rollback pricing configuration' },
      { status: 500 }
    );
  }
}
