import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { validateActivationCodeWithDetails } from '@/lib/activation';
import { SubscriptionPlan } from '@/types/subscription';

/**
 * POST /api/validate-promo-code
 *
 * Validates a promo code and returns discount information with QR codes
 */
export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized - Please log in' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { code, plan_id } = body;

    if (!code || !plan_id) {
      return NextResponse.json(
        { error: 'Code and plan_id are required' },
        { status: 400 }
      );
    }

    // Validate the promo code using enhanced validation
    // The validation function now handles both UUID and enum values
    const validationResult = await validateActivationCodeWithDetails(code, plan_id);

    if (!validationResult.valid) {
      return NextResponse.json(
        {
          valid: false,
          error: validationResult.error || 'Invalid or expired promo code'
        },
        { status: 400 }
      );
    }

    const activationCode = validationResult.activationCode!;

    // Calculate final amount with discount
    // Note: The pricing should ideally come from the subscription plan in the database
    // For now, we'll return the discount info without specific pricing
    const discountedPercent = activationCode.discount_percent;

    // Return enhanced discount information with QR codes
    return NextResponse.json({
      valid: true,
      code: code,
      discount_type: 'percent',
      discount_percent: discountedPercent,
      gcash_qr_url: activationCode.gcash_qr_url,
      gotyme_qr_url: activationCode.gotyme_qr_url,
      usage_limit: activationCode.usage_limit,
      current_usage: activationCode.current_usage,
      expires_at: activationCode.expires_at,
      message: 'Promo code applied successfully'
    });

  } catch (error) {
    console.error('Promo code validation error:', error);
    return NextResponse.json(
      { error: 'Failed to validate promo code' },
      { status: 500 }
    );
  }
}