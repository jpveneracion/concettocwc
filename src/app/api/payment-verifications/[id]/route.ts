// src/app/api/payment-verifications/[id]/route.ts

import { NextResponse } from 'next/server';
import { getSession, requireAdmin } from '@/lib/auth';
import { getPaymentVerificationById, sql } from '@/lib/db';
import { getPinataUrl } from '@/lib/pinata';
import type { PaymentVerification, VerificationStatus } from '@/types/payment';

/**
 * GET /api/payment-verifications/[id]
 *
 * Gets detailed information about a specific verification
 * Accessible by admin and the verification owner
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 1. Authentication Check
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized - Please log in' },
        { status: 401 }
      );
    }

    // 2. Await params and get verification record
    const { id } = await params;
    const verification = await getPaymentVerificationById(id);
    if (!verification) {
      return NextResponse.json(
        { error: 'Verification not found' },
        { status: 404 }
      );
    }

    // 3. Authorization Check - allow admin or verification owner
    const isAdmin = await requireAdmin().catch(() => null);
    const isOwner = verification.user_id === session.userId;

    if (!isAdmin && !isOwner) {
      return NextResponse.json(
        { error: 'Forbidden - You do not have access to this verification' },
        { status: 403 }
      );
    }

    // 4. Get user and plan details for response
    let userEmail: string | undefined, userName: string | undefined, planName: string | undefined, planAmount: number | undefined;

    try {
      // Get user info
      const userResult = await sql('SELECT email, name FROM users WHERE id = $1', [verification.user_id]);
      if (userResult.length > 0) {
        const user = userResult[0];
        userEmail = user.email;
        userName = user.name;
      }

      // Get plan info
      const planResult = await sql('SELECT name, amount FROM subscription_plans WHERE id = $1', [verification.plan_id]);
      if (planResult.length > 0) {
        const plan = planResult[0];
        planName = plan.name;
        planAmount = parseFloat(plan.amount);
      }
    } catch (error) {
      console.error('Error fetching joined data:', error);
    }

    // 5. Build response with gateway URL and proper type conversion
    const response: PaymentVerification & {
      user_email?: string;
      user_name?: string;
      plan_name?: string;
      plan_amount?: number;
    } = {
      id: verification.id,
      user_id: verification.user_id,
      plan_id: verification.plan_id,
      screenshot_url: getPinataUrl(verification.screenshot_url),
      reference_number: verification.reference_number,
      notes: verification.notes,
      status: verification.status as VerificationStatus,
      admin_notes: verification.admin_notes,
      admin_id: verification.admin_id,
      submitted_at: new Date(verification.submitted_at),
      reviewed_at: verification.reviewed_at ? new Date(verification.reviewed_at) : undefined,
      created_at: new Date(verification.created_at),
      updated_at: new Date(verification.updated_at),
      user_email: userEmail,
      user_name: userName,
      plan_name: planName,
      plan_amount: planAmount
    };

    return NextResponse.json(response, { status: 200 });

  } catch (error) {
    console.error('Get verification error:', error);

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}