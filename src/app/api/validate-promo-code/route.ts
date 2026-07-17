import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { validateActivationCode } from '@/lib/activation';
import { SubscriptionPlan } from '@/types/subscription';

/**
 * POST /api/validate-promo-code
 *
 * Validates a promo code and returns discount information
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

    // Validate the promo code using your existing activation system
    // Convert plan_id string to SubscriptionPlan enum
    const planEnum = plan_id as SubscriptionPlan;
    const validationResult = await validateActivationCode(code, planEnum);

    if (!validationResult) {
      return NextResponse.json(
        {
          valid: false,
          error: 'Invalid or expired promo code'
        },
        { status: 400 }
      );
    }

    // Check if the promo code applies to the selected plan
    if (!validationResult.applicable_plans.includes(planEnum)) {
      return NextResponse.json(
        {
          valid: false,
          error: `Promo code not applicable to ${plan_id} plan`
        },
        { status: 400 }
      );
    }

    // Return discount information
    return NextResponse.json({
      valid: true,
      code: code,
      discount_type: 'percent', // Activation codes use percent discounts
      discount_percent: validationResult.discount_percent,
      discount_amount: null,
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