// src/app/api/payment-verifications/[id]/reject/route.ts

import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { requireAdmin } from '@/lib/permissions';
import { getPaymentVerificationById, updatePaymentVerificationStatus } from '@/lib/db';
import type { RejectVerificationRequest, RejectVerificationResponse } from '@/types/payment';

/**
 * POST /api/payment-verifications/[id]/reject
 *
 * Rejects a payment verification with a required reason
 * Admin only
 */
export async function POST(
  req: Request,
  { params }: { params: { id: string } }
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

    const userId = session.userId;

    // 2. Authorization Check - Require admin access
    await requireAdmin(userId);

    // 3. Parse request body
    const body = await req.json() as RejectVerificationRequest;
    const { reason, admin_notes } = body;

    // 4. Validate required fields
    if (!reason || reason.trim().length === 0) {
      return NextResponse.json(
        { error: 'Rejection reason is required' },
        { status: 400 }
      );
    }

    // 5. Get verification record
    const verification = await getPaymentVerificationById(params.id);
    if (!verification) {
      return NextResponse.json(
        { error: 'Verification not found' },
        { status: 404 }
      );
    }

    // 6. Check verification status - only pending verifications can be rejected
    if (verification.status !== 'pending') {
      return NextResponse.json(
        {
          error: `Cannot reject verification with status '${verification.status}'.
                  Only pending verifications can be rejected.`
        },
        { status: 400 }
      );
    }

    // 7. Update verification status to rejected with reason
    const updatedVerification = await updatePaymentVerificationStatus(
      params.id,
      'rejected',
      userId,
      admin_notes ? `${admin_notes}\n\nRejection reason: ${reason}` : `Rejection reason: ${reason}`
    );

    if (!updatedVerification) {
      return NextResponse.json(
        { error: 'Failed to update verification status' },
        { status: 500 }
      );
    }

    // 8. Send payment rejection notification
    // TODO: This function will be implemented in later tasks
    // For now, we'll add a placeholder comment
    // await sendPaymentRejectionNotification(
    //   verification.user_id,
    //   verification.plan_id,
    //   params.id,
    //   reason
    // );

    const userNotified = false; // Placeholder until notification function is implemented

    // 9. Build success response
    const response: RejectVerificationResponse = {
      success: true,
      message: 'Payment verification rejected successfully',
      user_notified: userNotified
    };

    return NextResponse.json(response, { status: 200 });

  } catch (error) {
    console.error('POST /api/payment-verifications/[id]/reject error:', error);

    // Handle authorization errors
    if (error instanceof Error && error.message.includes('Forbidden')) {
      return NextResponse.json(
        { error: error.message },
        { status: 403 }
      );
    }

    // Handle other errors
    return NextResponse.json(
      { error: 'Failed to reject payment verification' },
      { status: 500 }
    );
  }
}