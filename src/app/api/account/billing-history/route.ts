// src/app/api/account/billing-history/route.ts

import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { query } from '@/lib/db';

interface PaymentRow {
  id: string;
  company_id: string;
  user_id: string;
  plan_id: string;
  amount: string | number;
  payment_method: string | null;
  reference_number: string | null;
  promo_code: string | null;
  discount_amount: string | number;
  verified_at: string | null;
  created_at: string;
}

interface PlanRow {
  id: string;
  name: string;
}

/**
 * GET /api/account/billing-history
 *
 * Returns the company's payment history (approved payments from the
 * payments ledger), newest first.
 *
 * @returns { payments: Array<{ id, plan_id, plan_name, amount,
 *   payment_method, reference_number, promo_code, discount_amount,
 *   verified_at, created_at }> }
 */
export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const rlsContext = {
      companyId: session.companyId,
      userRole: (session.role || 'user') as 'user' | 'admin' | 'superadmin'
    };

    const result = await query<PaymentRow>(
      `SELECT id, company_id, user_id, plan_id, amount, payment_method,
              reference_number, promo_code, discount_amount, verified_at, created_at
       FROM payments
       WHERE company_id = $1
       ORDER BY created_at DESC
       LIMIT 100`,
      [session.companyId],
      rlsContext.companyId,
      rlsContext.userRole
    );

    const payments = result.rows;

    const planIds: string[] = [...new Set(payments.map((p) => p.plan_id))];
    let planNames = new Map<string, string>();
    if (planIds.length > 0) {
      const plans = await query<PlanRow>(
        'SELECT id, name FROM subscription_plans WHERE id = ANY($1::uuid[])',
        [planIds] as unknown as import('@/lib/db').QueryParams[],
        rlsContext.companyId,
        rlsContext.userRole
      );
      planNames = new Map(plans.rows.map((p) => [p.id, p.name]));
    }

    const response = payments.map((p) => ({
      id: p.id,
      plan_id: p.plan_id,
      plan_name: planNames.get(p.plan_id) || null,
      amount: Number(p.amount),
      payment_method: p.payment_method,
      reference_number: p.reference_number,
      promo_code: p.promo_code,
      discount_amount: Number(p.discount_amount),
      verified_at: p.verified_at,
      created_at: p.created_at
    }));

    return NextResponse.json({ payments: response }, { status: 200 });
  } catch (error) {
    console.error('Billing history API error:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve billing history' },
      { status: 500 }
    );
  }
}
