import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { validateActivationCode } from '@/lib/activation';

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
    const validationResult = await validateActivationCode(code, {
      user_id: session.userId,
      company_id: session.companyId,
      plan_id: plan_id
    });

    if (!validationResult.valid) {
      return NextResponse.json(
        {
          valid: false,
          error: validationResult.error || 'Invalid promo code'
        },
        { status: 400 }
      );
    }

    // Return discount information
    return NextResponse.json({
      valid: true,
      code: code,
      discount_type: validationResult.discount_type,
      discount_percent: validationResult.discount_percent,
      discount_amount: validationResult.discount_amount,
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