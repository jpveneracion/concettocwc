// src/app/api/payment-verifications/route.ts

import { NextResponse } from 'next/server';
import { getSession, requireSession } from '@/lib/auth';
import { requireAdmin } from '@/lib/permissions';
import {
  createPaymentVerification,
  getAllPaymentVerifications
} from '@/lib/db';
import { uploadToPinata, validateScreenshotFile } from '@/lib/pinata';
import { checkAutomaticVerificationMatch, updateVerificationWithAutomaticResult } from '@/lib/payment-verification';
import { validateReferenceNumberFormat } from '@/lib/reference-cleaning';
import type {
  CreateVerificationRequest,
  CreateVerificationResponse,
  VerificationListFilters
} from '@/types/payment';
import { VerificationStatus } from '@/types/payment';

/**
 * Validate UUID format
 */
function isValidUUID(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

/**
 * Sanitize user input to prevent injection attacks
 */
function sanitizeInput(input: string): string {
  return input
    .replace(/[<>]/g, '') // Remove potential HTML tags
    .replace(/['"]/g, '') // Remove quotes
    .trim()
    .slice(0, 1000); // Limit length
}

/**
 * POST /api/payment-verifications
 *
 * Creates a new payment verification with Pinata IPFS storage
 */
export async function POST(req: Request): Promise<NextResponse> {
  try {
    // 1. Authentication Check
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized - Please log in' },
        { status: 401 }
      );
    }

    // 2. Parse request body
    const body: { plan_id?: string; screenshot_base64?: string; reference_number?: string; notes?: string } = await req.json();

    if (!body.plan_id || !body.screenshot_base64 || !body.reference_number) {
      return NextResponse.json(
        { error: 'plan_id, screenshot_base64, and reference_number are required' },
        { status: 400 }
      );
    }

    // 3. Validate and sanitize plan_id
    if (!isValidUUID(body.plan_id)) {
      return NextResponse.json(
        { error: 'Invalid plan_id format' },
        { status: 400 }
      );
    }

    // 4. Validate reference number format
    const referenceNumberValidation = validateReferenceNumberFormat(body.reference_number);
    if (!referenceNumberValidation.valid) {
      return NextResponse.json(
        { error: referenceNumberValidation.message },
        { status: 400 }
      );
    }

    // 5. Validate and sanitize reference number and notes
    const sanitizedReferenceNumber = sanitizeInput(body.reference_number);
    const sanitizedNotes = body.notes ? sanitizeInput(body.notes) : undefined;

    // 6. Validate screenshot base64 and convert to File
    let file: File;
    try {
      const base64Data = body.screenshot_base64.split(',')[1];
      const byteCharacters = atob(base64Data);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'image/png' });

      file = new File([blob], 'screenshot.png', { type: 'image/png' });

      // Validate file
      const validation = validateScreenshotFile(file);
      if (!validation.valid) {
        return NextResponse.json(
          { error: validation.error },
          { status: 400 }
        );
      }
    } catch (error) {
      return NextResponse.json(
        { error: 'Invalid screenshot format' },
        { status: 400 }
      );
    }

    // 7. Upload to Pinata IPFS
    const uploadResult = await uploadToPinata(file, {
      name: `payment-proof-${session.userId}-${Date.now()}`,
      keyvalues: {
        user_id: session.userId,
        plan_id: body.plan_id,
        submitted_at: new Date().toISOString()
      }
    });

    if (!uploadResult.success || !uploadResult.cid) {
      return NextResponse.json(
        { error: uploadResult.error || 'Failed to upload screenshot' },
        { status: 500 }
      );
    }

    // 8. Create verification record
    const verification = await createPaymentVerification({
      user_id: session.userId,
      plan_id: body.plan_id,
      screenshot_url: uploadResult.cid,
      reference_number: sanitizedReferenceNumber,
      notes: sanitizedNotes
    });

    // 9. Trigger automatic verification (Trigger A)
    let matchResult;
    try {
      matchResult = await checkAutomaticVerificationMatch(verification);

      if (matchResult.shouldAutoApprove) {
        // Update verification with automatic result
        await updateVerificationWithAutomaticResult(verification.id, matchResult);
      }
    } catch (error) {
      console.error('Automatic verification check error:', error);
      // Continue with manual verification if automatic check fails
      matchResult = { shouldAutoApprove: false };
    }

    // 10. Return success response based on verification method
    const response: CreateVerificationResponse = {
      success: true,
      verification_id: verification.id,
      message: matchResult.shouldAutoApprove
        ? 'Payment verified automatically via GCash webhook!'
        : 'Payment verification submitted successfully. Our team will review your payment within 24 hours.',
      estimated_review_time: matchResult.shouldAutoApprove ? '0 minutes' : '24 hours',
      verification_method: matchResult.shouldAutoApprove ? 'automatic' : 'manual'
    };

    return NextResponse.json(response, { status: 200 });

  } catch (error) {
    console.error('Payment verification creation error:', error);

    // Check for JSON parsing errors
    if (error instanceof SyntaxError && error.message.includes('JSON')) {
      return NextResponse.json(
        { error: 'Invalid request format' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/payment-verifications
 *
 * Lists payment verifications (admin only)
 */
export async function GET(req: Request): Promise<NextResponse> {
  try {
    // 1. Authentication Check
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized - Please log in' },
        { status: 401 }
      );
    }

    // 2. Admin Authorization Check
    try {
      await requireAdmin(session.userId);
    } catch (authError) {
      if (authError instanceof Error && authError.message.includes('Forbidden')) {
        return NextResponse.json(
          { error: 'Forbidden - Admin access required' },
          { status: 403 }
        );
      }
      throw authError;
    }

    // 3. Parse query parameters
    const { searchParams } = new URL(req.url);
    const statusParam = searchParams.get('status');

    // Validate status parameter if provided
    let validStatus: VerificationStatus | undefined;
    if (statusParam) {
      const validStatuses = Object.values(VerificationStatus);
      if (validStatuses.includes(statusParam as VerificationStatus)) {
        validStatus = statusParam as VerificationStatus;
      } else {
        return NextResponse.json(
          { error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` },
          { status: 400 }
        );
      }
    }

    // 4. Validate and sanitize user_id and plan_id if provided
    const userIdParam = searchParams.get('user_id');
    const planIdParam = searchParams.get('plan_id');

    if (userIdParam && !isValidUUID(userIdParam)) {
      return NextResponse.json(
        { error: 'Invalid user_id format' },
        { status: 400 }
      );
    }

    if (planIdParam && !isValidUUID(planIdParam)) {
      return NextResponse.json(
        { error: 'Invalid plan_id format' },
        { status: 400 }
      );
    }

    // 5. Sanitize search parameter
    const searchParam = searchParams.get('search');
    const sanitizedSearch = searchParam ? sanitizeInput(searchParam) : undefined;

    // 6. Validate pagination parameters
    const limitParam = searchParams.get('limit');
    const offsetParam = searchParams.get('offset');

    let limit = 50;
    let offset = 0;

    if (limitParam) {
      limit = parseInt(limitParam);
      if (isNaN(limit) || limit < 1 || limit > 100) {
        return NextResponse.json(
          { error: 'Limit must be between 1 and 100' },
          { status: 400 }
        );
      }
    }

    if (offsetParam) {
      offset = parseInt(offsetParam);
      if (isNaN(offset) || offset < 0) {
        return NextResponse.json(
          { error: 'Offset must be a non-negative number' },
          { status: 400 }
        );
      }
    }

    const filters: VerificationListFilters = {
      status: validStatus,
      user_id: userIdParam || undefined,
      plan_id: planIdParam || undefined,
      date_from: searchParams.get('date_from') || undefined,
      date_to: searchParams.get('date_to') || undefined,
      search: sanitizedSearch,
      limit,
      offset
    };

    // 7. Get verifications from database
    const result = await getAllPaymentVerifications(filters);

    // 8. Return paginated response
    return NextResponse.json({
      verifications: result.verifications,
      total: result.total,
      pagination: {
        limit,
        offset,
        has_more: result.total > offset + limit
      }
    }, { status: 200 });

  } catch (error) {
    console.error('Payment verifications list error:', error);

    // Check for authorization errors
    if (error instanceof Error && error.message.includes('Forbidden')) {
      return NextResponse.json(
        { error: 'Forbidden - Admin access required' },
        { status: 403 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}