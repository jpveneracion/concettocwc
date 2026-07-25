import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { requireAdmin } from '@/lib/permissions';
import {
  getCurrentPricing,
  getAllPricingConfigs,
  updatePricing,
  invalidatePricingCache
} from '@/lib/pricing-service';
import type { PricingConfig, PricingUpdateRequest } from '@/lib/pricing-service';

/**
 * GET /api/admin/pricing
 *
 * Returns current pricing configuration and all scheduled configs
 */
export async function GET(req: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    await requireAdmin(session.userId);

    // Get current pricing and all configs
    const [currentPricing, allConfigs] = await Promise.all([
      getCurrentPricing(),
      getAllPricingConfigs()
    ]);

    // Separate current from scheduled configs
    const now = new Date();
    const scheduledConfigs = allConfigs.filter(config => {
      const validFrom = new Date(config.valid_from);
      // Config is scheduled if it starts in the future
      return validFrom > now;
    });

    return NextResponse.json({
      success: true,
      data: {
        current: currentPricing,
        scheduled: scheduledConfigs
      }
    });

  } catch (error) {
    console.error('Get pricing error:', error);

    if (error instanceof Error && error.message.includes('Forbidden')) {
      return NextResponse.json(
        { error: 'Forbidden - Admin access required' },
        { status: 403 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to retrieve pricing configuration' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/pricing
 *
 * Updates current pricing configuration with audit trail
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

    // Validate required change_reason field
    if (!body.change_reason || typeof body.change_reason !== 'string' || body.change_reason.trim().length === 0) {
      return NextResponse.json(
        { error: 'change_reason is required and cannot be empty' },
        { status: 400 }
      );
    }

    // Build update request with only provided fields
    const updates: PricingUpdateRequest = {
      change_reason: body.change_reason
    };

    // Add optional fields if provided with type validation
    if (body.monthly_base_rate !== undefined) {
      if (typeof body.monthly_base_rate !== 'number') {
        return NextResponse.json(
          { error: 'monthly_base_rate must be a number' },
          { status: 400 }
        );
      }
      updates.monthly_base_rate = body.monthly_base_rate;
    }
    if (body.quarterly_discount_percent !== undefined) {
      if (typeof body.quarterly_discount_percent !== 'number') {
        return NextResponse.json(
          { error: 'quarterly_discount_percent must be a number' },
          { status: 400 }
        );
      }
      updates.quarterly_discount_percent = body.quarterly_discount_percent;
    }
    if (body.annual_discount_percent !== undefined) {
      if (typeof body.annual_discount_percent !== 'number') {
        return NextResponse.json(
          { error: 'annual_discount_percent must be a number' },
          { status: 400 }
        );
      }
      updates.annual_discount_percent = body.annual_discount_percent;
    }
    if (body.monthly_threshold !== undefined) {
      if (typeof body.monthly_threshold !== 'number') {
        return NextResponse.json(
          { error: 'monthly_threshold must be a number' },
          { status: 400 }
        );
      }
      updates.monthly_threshold = body.monthly_threshold;
    }
    if (body.quarterly_threshold !== undefined) {
      if (typeof body.quarterly_threshold !== 'number') {
        return NextResponse.json(
          { error: 'quarterly_threshold must be a number' },
          { status: 400 }
        );
      }
      updates.quarterly_threshold = body.quarterly_threshold;
    }

    // Update pricing with admin user ID for audit trail
    const updatedPricing = await updatePricing(updates, session.userId);

    // Invalidate cache to ensure new pricing is used
    invalidatePricingCache();

    return NextResponse.json({
      success: true,
      data: updatedPricing,
      message: 'Pricing configuration updated successfully'
    });

  } catch (error) {
    console.error('Update pricing error:', error);

    if (error instanceof Error && error.message.includes('Invalid pricing data')) {
      return NextResponse.json(
        { error: error.message },
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
      { error: 'Failed to update pricing configuration' },
      { status: 500 }
    );
  }
}
