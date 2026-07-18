import { NextResponse } from 'next/server';
import { validatePromoCode } from '@/lib/qr-service';

/**
 * POST /api/validate-promo-qr
 *
 * Validates promo code and returns QR code information
 */
export async function POST(req: Request) {
  try {
    const { promo_code, plan_price } = await req.json();

    if (!promo_code || !plan_price) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const validation = await validatePromoCode(promo_code, parseFloat(plan_price));

    return NextResponse.json(validation);

  } catch (error) {
    console.error('Promo validation error:', error);
    return NextResponse.json(
      { error: 'Failed to validate promo code' },
      { status: 500 }
    );
  }
}