// src/app/api/payments/pi/complete/route.ts
// Called by the client when the Pi SDK fires onReadyForServerCompletion.
// Completes the payment with the Pi platform, activates the subscription,
// redeems the promo code (if any), and records the payment in the ledger.

import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { completePiPayment, getPiPaymentByPaymentId, upsertPiPayment } from '@/lib/pi-payments';
import { activateSubscriptionWithVerification, mapPlanIdToSubscriptionPlan } from '@/lib/subscription-activation';
import { redeemActivationCode } from '@/lib/activation';
import { createPaymentRecord, sql } from '@/lib/db';

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized - Please log in' }, { status: 401 });
    }

    let body: { paymentId?: string; txid?: string };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid request format' }, { status: 400 });
    }

    const { paymentId, txid } = body;
    if (!paymentId) {
      return NextResponse.json({ error: 'Payment ID required' }, { status: 400 });
    }

    const rlsContext = {
      companyId: session.companyId,
      userRole: (session.role || 'user') as 'user' | 'admin' | 'superadmin',
    };

    // The payment must have been approved locally first
    const piPayment = await getPiPaymentByPaymentId(paymentId, rlsContext);
    if (!piPayment) {
      return NextResponse.json(
        { error: 'Pi payment not found. Please start the payment again.' },
        { status: 404 }
      );
    }

    if (piPayment.status === 'completed') {
      // Idempotent: a completed payment just returns success
      return NextResponse.json({ success: true, subscription_id: piPayment.subscription_id });
    }

    if (piPayment.status !== 'approved') {
      return NextResponse.json(
        { error: `Cannot complete Pi payment with status '${piPayment.status}'` },
        { status: 400 }
      );
    }

    // Complete with the Pi platform (idempotent server-side call)
    await completePiPayment(paymentId);

    // Activate the subscription (mirrors payment-verification approval flow)
    const subscriptionResult = await activateSubscriptionWithVerification(
      piPayment.user_id,
      piPayment.plan_id,
      paymentId,
      {},
      rlsContext
    );

    if (!subscriptionResult.success) {
      return NextResponse.json(
        { error: subscriptionResult.error || 'Failed to activate subscription' },
        { status: 500 }
      );
    }

    const subscriptionId = subscriptionResult.subscription_id;

    // Redeem promo code if present in metadata
    const promoCode = (piPayment.metadata as Record<string, unknown> | null)?.promo_code
      ? String((piPayment.metadata as Record<string, unknown>).promo_code)
      : null;

    if (promoCode) {
      try {
        const planMapping = await mapPlanIdToSubscriptionPlan(piPayment.plan_id);
        if (planMapping) {
          await redeemActivationCode(
            promoCode,
            piPayment.user_id,
            '127.0.0.1', // Pi payment completion (server-side call)
            planMapping.subscriptionPlan,
            rlsContext
          );
        }
      } catch (promoError) {
        // Log but never fail the payment because of promo issues
        console.error('Failed to redeem promo code from Pi payment:', promoError);
      }
    }

    // Record the payment in the ledger (revenue analytics source of truth)
    let planPrice: number | undefined;
    try {
      const planResult = await sql('SELECT get_subscription_plan_by_id($1::uuid) as plan_data', [piPayment.plan_id]);
      if (planResult.length > 0) {
        const planData =
          typeof planResult[0].plan_data === 'string'
            ? JSON.parse(planResult[0].plan_data)
            : planResult[0].plan_data;
        if (planData) {
          planPrice = Number(planData.price ?? planData.amount);
        }
      }
    } catch (planError) {
      console.error('Error fetching plan amount for payment record:', planError);
    }

    const discountAmount = planPrice != null ? Math.max(0, planPrice - piPayment.amount_php) : 0;

    await createPaymentRecord(
      {
        company_id: piPayment.company_id,
        user_id: piPayment.user_id,
        plan_id: piPayment.plan_id,
        amount: piPayment.amount_php,
        payment_method: 'pi',
        reference_number: paymentId,
        promo_code: promoCode || undefined,
        discount_amount: discountAmount,
        admin_notes: txid ? `Pi transaction: ${txid}` : 'Pi payment',
        verified_by: session.userId,
      },
      rlsContext
    );

    // Mark the payment completed locally
    await upsertPiPayment(
      {
        payment_id: paymentId,
        user_id: piPayment.user_id,
        company_id: piPayment.company_id,
        plan_id: piPayment.plan_id,
        amount_pi: piPayment.amount_pi,
        amount_php: piPayment.amount_php,
        memo: piPayment.memo,
        metadata: piPayment.metadata,
        status: 'completed',
        txid: txid ?? null,
        subscription_id: subscriptionId ?? null,
      },
      rlsContext
    );

    return NextResponse.json({
      success: true,
      subscription_id: subscriptionId,
      payment_id: paymentId,
    });
  } catch (error) {
    console.error('POST /api/payments/pi/complete error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to complete Pi payment' },
      { status: 500 }
    );
  }
}
