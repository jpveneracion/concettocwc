// src/app/api/payment-verifications/[id]/reject/route.ts

import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { requireAdmin } from '@/lib/permissions';
import { getPaymentVerificationById, updatePaymentVerificationStatus } from '@/lib/db';
import type { RejectVerificationRequest, RejectVerificationResponse } from '@/types/payment';
import { VerificationStatus } from '@/types/payment';

/**
 * Validate UUID format
 */
function isValidUUID(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

/**
 * Sanitize admin notes and rejection reason
 */
function sanitizeRejectionInput(reason: string, adminNotes?: string): { sanitizedReason: string; sanitizedNotes?: string } {
  const sanitizedReason = reason
    .replace(/[<>]/g, '') // Remove potential HTML tags
    .replace(/['"]/g, '') // Remove quotes
    .trim()
    .slice(0, 500); // Limit reason length

  const sanitizedNotes = adminNotes ? adminNotes
    .replace(/[<>]/g, '') // Remove potential HTML tags
    .replace(/['"]/g, '') // Remove quotes
    .trim()
    .slice(0, 1000) : undefined; // Limit notes length

  return { sanitizedReason, sanitizedNotes };
}

/**
 * POST /api/payment-verifications/[id]/reject
 *
 * Rejects a payment verification with a required reason
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

    const userId = session.userId;
    const { id } = await params;

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
    let reason: string, admin_notes: string | undefined;
    try {
      const body = await req.json() as RejectVerificationRequest;
      reason = body.reason;
      admin_notes = body.admin_notes;
    } catch (parseError) {
      return NextResponse.json(
        { error: 'Invalid request format' },
        { status: 400 }
      );
    }

    // 5. Validate required fields
    if (!reason || reason.trim().length === 0) {
      return NextResponse.json(
        { error: 'Rejection reason is required' },
        { status: 400 }
      );
    }

    // 6. Sanitize input
    const { sanitizedReason, sanitizedNotes } = sanitizeRejectionInput(reason, admin_notes);

    // 7. Get verification record
    const verification = await getPaymentVerificationById(id);
    if (!verification) {
      return NextResponse.json(
        { error: 'Verification not found' },
        { status: 404 }
      );
    }

    // 8. Check verification status - only pending verifications can be rejected
    if (verification.status !== VerificationStatus.PENDING) {
      return NextResponse.json(
        {
          error: `Cannot reject verification with status '${verification.status}'. Only pending verifications can be rejected.`
        },
        { status: 400 }
      );
    }

    // 9. Update verification status to rejected with reason
    const finalNotes = sanitizedNotes
      ? `${sanitizedNotes}\n\nRejection reason: ${sanitizedReason}`
      : `Rejection reason: ${sanitizedReason}`;

    const updatedVerification = await updatePaymentVerificationStatus(
      id,
      VerificationStatus.REJECTED,
      userId,
      finalNotes
    );

    if (!updatedVerification) {
      return NextResponse.json(
        { error: 'Failed to update verification status' },
        { status: 500 }
      );
    }

    // 10. Send payment rejection notification
    // TODO: This function will be implemented in later tasks
    // For now, we'll add a placeholder comment
    // await sendPaymentRejectionNotification(
    //   verification.user_id,
    //   verification.plan_id,
    //   id,
    //   sanitizedReason
    // );

    const userNotified = false; // Placeholder until notification function is implemented

    // 11. Build success response
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
        { error: 'Forbidden - Admin access required' },
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