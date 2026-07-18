import { NextResponse } from 'next/server';
import { getPaymentQrCode } from '@/lib/qr-service';

/**
 * POST /api/payment-qr
 *
 * Gets the appropriate QR code for a given plan, payment method, and promo code
 */
export async function POST(req: Request) {
  try {
    const { method, amount, plan_name, promo_code } = await req.json();

    if (!method || !amount || !plan_name) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const plan = {
      id: plan_name.toLowerCase().replace(/\s+/g, '-'),
      name: plan_name,
      price: parseFloat(amount)
    };

    const paymentMethod = method === 'gcash' || method === 'gotyme' ? method : 'gcash';

    const qrResult = await getPaymentQrCode(plan, paymentMethod, promo_code);

    return NextResponse.json(qrResult);

  } catch (error) {
    console.error('Payment QR error:', error);
    return NextResponse.json(
      { error: 'Failed to get payment QR code' },
      { status: 500 }
    );
  }
}