// src/app/api/payments/pi/approve/route.ts
// Called by the client when the Pi SDK fires onReadyForServerApproval.
// Validates the payment against the server-side quote, records it, and
// approves it with the Pi platform.

import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getSubscriptionPlanById } from '@/lib/subscription-plans';
import { validateActivationCodeWithDetails } from '@/lib/activation';
import { approvePiPayment, computePiAmount, upsertPiPayment } from '@/lib/pi-payments';

const AMOUNT_EPSILON = 0.01;

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized - Please log in' }, { status: 401 });
    }

    let body: { payment_id?: string; amount?: number; plan_id?: string; promo_code?: string | null };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid request format' }, { status: 400 });
    }

    const { payment_id: paymentId, amount, plan_id: planId, promo_code: promoCode } = body;
    if (!paymentId) {
      return NextResponse.json({ error: 'Payment ID required' }, { status: 400 });
    }
    if (!planId) {
      return NextResponse.json({ error: 'Plan ID required' }, { status: 400 });
    }

    const rlsContext = {
      companyId: session.companyId,
      userRole: (session.role || 'user') as 'user' | 'admin' | 'superadmin',
    };

    // Validate the plan exists (server-side price check, not client-trusted)
    const plan = await getSubscriptionPlanById(planId, rlsContext);
    if (!plan) {
      return NextResponse.json({ error: 'Plan not found' }, { status: 404 });
    }

    const planPrice = Number(plan.price ?? 0);

    // Server-side promo validation (mirrors /api/validate-promo-code)
    let effectivePrice = planPrice;
    if (promoCode) {
      const validationResult = await validateActivationCodeWithDetails(promoCode, planId, rlsContext);
      if (!validationResult.valid || !validationResult.activationCode) {
        return NextResponse.json(
          { error: validationResult.error || 'Invalid or expired promo code' },
          { status: 400 }
        );
      }
      const discountPercent = Number(validationResult.activationCode.discount_percent) || 0;
      effectivePrice = Math.max(0, planPrice * (1 - discountPercent / 100));
    }

    const expectedPi = computePiAmount(effectivePrice);

    const paidPi = Number(amount ?? 0);
    if (Math.abs(paidPi - expectedPi) > AMOUNT_EPSILON) {
      return NextResponse.json(
        {
          error: `Amount mismatch: Pi payment (${paidPi}) does not match plan price (${expectedPi.toFixed(6)})`,
        },
        { status: 409 }
      );
    }

    // Approve with the Pi platform (idempotent on conflict)
    await approvePiPayment(paymentId);

    // Record the payment locally
    await upsertPiPayment(
      {
        payment_id: paymentId,
        user_id: session.userId,
        company_id: session.companyId,
        plan_id: planId,
        amount_pi: paidPi,
        amount_php: Math.round(effectivePrice * 100) / 100,
        memo: `${plan.name} subscription`,
        metadata: { plan_id: planId, promo_code: promoCode },
        status: 'approved',
      },
      rlsContext
    );

    return NextResponse.json({ success: true, payment_id: paymentId });
  } catch (error) {
    console.error('POST /api/payments/pi/approve error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to approve Pi payment' },
      { status: 500 }
    );
  }
}
