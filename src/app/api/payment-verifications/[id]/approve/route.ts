// src/app/api/payment-verifications/[id]/approve/route.ts

import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { requireAdmin } from '@/lib/permissions';
import { getPaymentVerificationById, updatePaymentVerificationStatus } from '@/lib/db';
import type { ApproveVerificationRequest, ApproveVerificationResponse, VerificationStatus } from '@/types/payment';
import { VerificationStatus as VerificationStatusEnum } from '@/types/payment';

/**
 * POST /api/payment-verifications/[id]/approve
 *
 * Approves a payment verification and activates the user's subscription
 * Admin only
 */
export async function POST(
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

    const { id } = await params;
    const userId = session.userId;

    // 2. Authorization Check - Require admin access
    await requireAdmin(userId);

    // 3. Parse request body
    const body = await req.json() as ApproveVerificationRequest;
    const { admin_notes } = body;

    // 4. Get verification record
    const verification = await getPaymentVerificationById(id);
    if (!verification) {
      return NextResponse.json(
        { error: 'Verification not found' },
        { status: 404 }
      );
    }

    // 5. Check verification status - only pending verifications can be approved
    if (verification.status !== VerificationStatusEnum.PENDING) {
      return NextResponse.json(
        {
          error: `Cannot approve verification with status '${verification.status}'.
                  Only pending verifications can be approved.`
        },
        { status: 400 }
      );
    }

    // 6. Update verification status to approved
    const updatedVerification = await updatePaymentVerificationStatus(
      id,
      VerificationStatusEnum.APPROVED,
      userId,
      admin_notes
    );

    if (!updatedVerification) {
      return NextResponse.json(
        { error: 'Failed to update verification status' },
        { status: 500 }
      );
    }

    // 7. Activate subscription with verification
    // TODO: This function will be implemented in later tasks
    // For now, we'll add a placeholder comment
    // const subscriptionId = await activateSubscriptionWithVerification(
    //   verification.user_id,
    //   verification.plan_id,
    //   id
    // );

    const subscriptionId = undefined; // Placeholder until subscription function is implemented

    // 8. Send payment approval notification
    // TODO: This function will be implemented in later tasks
    // For now, we'll add a placeholder comment
    // await sendPaymentApprovalNotification(
    //   verification.user_id,
    //   verification.plan_id,
    //   id
    // );

    const userNotified = false; // Placeholder until notification function is implemented

    // 9. Build success response
    const response: ApproveVerificationResponse = {
      success: true,
      subscription_id: subscriptionId,
      message: 'Payment verification approved successfully',
      user_notified: userNotified
    };

    return NextResponse.json(response, { status: 200 });

  } catch (error) {
    console.error('POST /api/payment-verifications/[id]/approve error:', error);

    // Handle authorization errors
    if (error instanceof Error && error.message.includes('Forbidden')) {
      return NextResponse.json(
        { error: error.message },
        { status: 403 }
      );
    }

    // Handle other errors
    return NextResponse.json(
      { error: 'Failed to approve payment verification' },
      { status: 500 }
    );
  }
}