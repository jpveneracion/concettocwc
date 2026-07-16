// src/app/api/payment-verifications/route.ts

import { NextResponse } from 'next/server';
import { getSession, requireAdmin } from '@/lib/auth';
import {
  createPaymentVerification,
  getAllPaymentVerifications
} from '@/lib/db';
import { uploadToPinata, validateScreenshotFile } from '@/lib/pinata';
import type {
  CreateVerificationRequest,
  CreateVerificationResponse,
  VerificationListFilters,
  VerificationStatus
} from '@/types/payment';

/**
 * POST /api/payment-verifications
 *
 * Creates a new payment verification with Pinata IPFS storage
 */
export async function POST(req: Request) {
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
    const body = await req.json();

    if (!body.plan_id || !body.screenshot_base64) {
      return NextResponse.json(
        { error: 'plan_id and screenshot_base64 are required' },
        { status: 400 }
      );
    }

    // 3. Validate screenshot base64 and convert to File
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

    // 4. Upload to Pinata IPFS
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

    // 5. Create verification record
    const verification = await createPaymentVerification({
      user_id: session.userId,
      plan_id: body.plan_id,
      screenshot_url: uploadResult.cid,
      reference_number: body.reference_number,
      notes: body.notes
    });

    // 6. Return success response
    const response: CreateVerificationResponse = {
      success: true,
      verification_id: verification.id,
      message: 'Payment verification submitted successfully. Our team will review your payment within 24 hours.',
      estimated_review_time: '24 hours'
    };

    return NextResponse.json(response, { status: 200 });

  } catch (error) {
    console.error('Payment verification creation error:', error);

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
export async function GET(req: Request) {
  try {
    // 1. Admin Authorization Check
    const session = await requireAdmin();

    // 2. Parse query parameters
    const { searchParams } = new URL(req.url);
    const statusParam = searchParams.get('status');
    const filters: VerificationListFilters = {
      status: statusParam && ['pending', 'approved', 'rejected', 'expired'].includes(statusParam)
        ? statusParam as VerificationStatus
        : undefined,
      user_id: searchParams.get('user_id') || undefined,
      plan_id: searchParams.get('plan_id') || undefined,
      date_from: searchParams.get('date_from') || undefined,
      date_to: searchParams.get('date_to') || undefined,
      search: searchParams.get('search') || undefined,
      limit: parseInt(searchParams.get('limit') || '50'),
      offset: parseInt(searchParams.get('offset') || '0')
    };

    // 3. Get verifications from database
    const result = await getAllPaymentVerifications(filters);

    // 4. Return paginated response
    return NextResponse.json({
      verifications: result.verifications,
      total: result.total,
      pagination: {
        limit: filters.limit,
        offset: filters.offset,
        has_more: result.total > filters.offset + filters.limit
      }
    }, { status: 200 });

  } catch (error) {
    console.error('Payment verifications list error:', error);

    // Check if admin authorization failed
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