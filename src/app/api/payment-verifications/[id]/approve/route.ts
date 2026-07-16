// src/app/api/payment-verifications/[id]/approve/route.ts

import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { requireAdmin } from '@/lib/permissions';
import { getPaymentVerificationById, updatePaymentVerificationStatus } from '@/lib/db';
import { activateSubscriptionWithVerification } from '@/lib/subscription-activation';
import type { ApproveVerificationRequest, ApproveVerificationResponse } from '@/types/payment';
import { VerificationStatus } from '@/types/payment';

/**
 * Validate UUID format
 */
function isValidUUID(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

/**
 * Sanitize admin notes
 */
function sanitizeAdminNotes(notes?: string): string | undefined {
  if (!notes) return undefined;
  return notes
    .replace(/[<>]/g, '') // Remove potential HTML tags
    .replace(/['"]/g, '') // Remove quotes
    .trim()
    .slice(0, 1000); // Limit length
}

/**
 * POST /api/payment-verifications/[id]/approve
 *
 * Approves a payment verification and activates the user's subscription
 * Admin only
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
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

    // 2. Validate ID format
    if (!isValidUUID(id)) {
      return NextResponse.json(
        { error: 'Invalid verification ID format' },
        { status: 400 }
      );
    }

    // 3. Authorization Check - Require admin access
    try {
      await requireAdmin(userId);
    } catch (authError) {
      if (authError instanceof Error && authError.message.includes('Forbidden')) {
        return NextResponse.json(
          { error: 'Forbidden - Admin access required' },
          { status: 403 }
        );
      }
      throw authError;
    }

    // 4. Parse request body
    let admin_notes: string | undefined;
    try {
      const body = await req.json() as ApproveVerificationRequest;
      admin_notes = sanitizeAdminNotes(body.admin_notes);
    } catch (parseError) {
      return NextResponse.json(
        { error: 'Invalid request format' },
        { status: 400 }
      );
    }

    // 5. Get verification record
    const verification = await getPaymentVerificationById(id);
    if (!verification) {
      return NextResponse.json(
        { error: 'Verification not found' },
        { status: 404 }
      );
    }

    // 6. Check verification status - only pending verifications can be approved
    if (verification.status !== VerificationStatus.PENDING) {
      return NextResponse.json(
        {
          error: `Cannot approve verification with status '${verification.status}'. Only pending verifications can be approved.`
        },
        { status: 400 }
      );
    }

    // 7. Update verification status to approved
    const updatedVerification = await updatePaymentVerificationStatus(
      id,
      VerificationStatus.APPROVED,
      userId,
      admin_notes
    );

    if (!updatedVerification) {
      return NextResponse.json(
        { error: 'Failed to update verification status' },
        { status: 500 }
      );
    }

    // 8. Activate subscription with verification
    const subscriptionResult = await activateSubscriptionWithVerification(
      verification.user_id,
      verification.plan_id,
      id
    );

    if (!subscriptionResult.success) {
      // Rollback verification status if subscription activation fails
      await updatePaymentVerificationStatus(
        id,
        VerificationStatus.PENDING,
        userId,
        'Subscription activation failed - rolled back to pending'
      );

      return NextResponse.json(
        { error: subscriptionResult.error || 'Failed to activate subscription' },
        { status: 500 }
      );
    }

    const subscriptionId = subscriptionResult.subscription_id;

    // 9. Send payment approval notification
    // TODO: This function will be implemented in later tasks
    // For now, we'll add a placeholder comment
    // await sendPaymentApprovalNotification(
    //   verification.user_id,
    //   verification.plan_id,
    //   id
    // );

    const userNotified = false; // Placeholder until notification function is implemented

    // 10. Build success response
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
        { error: 'Forbidden - Admin access required' },
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