import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { requireAdmin } from '@/lib/permissions';
import {
  createPromoCode,
  listActivationCodes,
  updateActivationCode,
  deactivateActivationCode
} from '@/lib/activation';
import { SubscriptionPlan } from '@/types/subscription';

/**
 * GET /api/admin/promo-codes
 *
 * List all promo codes (admin only)
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

    const { searchParams } = new URL(req.url);
    const is_active = searchParams.get('is_active');
    const campaign_name = searchParams.get('campaign_name');

    const filters: { is_active?: boolean; used_by?: number; campaign_name?: string } = {};
    if (is_active === 'true' || is_active === 'false') {
      filters.is_active = is_active === 'true';
    }
    if (campaign_name) {
      filters.campaign_name = campaign_name;
    }

    const promoCodes = await listActivationCodes(filters);

    return NextResponse.json(promoCodes);

  } catch (error) {
    console.error('Get promo codes error:', error);

    if (error instanceof Error && error.message.includes('Forbidden')) {
      return NextResponse.json(
        { error: 'Forbidden - Admin access required' },
        { status: 403 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to retrieve promo codes' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/promo-codes
 *
 * Create new promo code with QR codes (admin only)
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
    const {
      code,
      discount_percent,
      applicable_plans,
      expires_at,
      campaign_name,
      notes,
      gcash_qr_url,
      gotyme_qr_url,
      usage_limit
    } = body;

    // Validate required fields
    if (!discount_percent || !applicable_plans || applicable_plans.length === 0) {
      return NextResponse.json(
        { error: 'Discount percent and applicable plans are required' },
        { status: 400 }
      );
    }

    // Validate custom code format if provided
    if (code && !/^[A-Z0-9]{6,20}$/.test(code)) {
      return NextResponse.json(
        { error: 'Custom code must be 6-20 characters, letters and numbers only' },
        { status: 400 }
      );
    }

    // Validate applicable plans
    const validPlans = ['monthly', 'quarterly', 'annual'];
    const invalidPlans = applicable_plans.filter((plan: string) => !validPlans.includes(plan));

    if (invalidPlans.length > 0) {
      return NextResponse.json(
        { error: `Invalid plan(s): ${invalidPlans.join(', ')}` },
        { status: 400 }
      );
    }

    // Create promo code
    const promoCode = await createPromoCode(
      discount_percent,
      applicable_plans,
      expires_at ? new Date(expires_at) : undefined,
      campaign_name,
      notes,
      session.userId,
      {
        gcash: gcash_qr_url,
        gotyme: gotyme_qr_url
      },
      usage_limit,
      code // Pass custom code if provided
    );

    return NextResponse.json({
      success: true,
      promoCode,
      message: 'Promo code created successfully'
    });

  } catch (error) {
    console.error('Create promo code error:', error);

    if (error instanceof Error && error.message.includes('Forbidden')) {
      return NextResponse.json(
        { error: 'Forbidden - Admin access required' },
        { status: 403 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to create promo code' },
      { status: 500 }
    );
  }
}