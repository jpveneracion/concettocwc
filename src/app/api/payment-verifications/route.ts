// src/app/api/payment-verifications/route.ts

import { NextResponse } from 'next/server';
import { getSession, requireSession } from '@/lib/auth';
import { requireAdmin } from '@/lib/permissions';
import {
  createPaymentVerification,
  createPaymentRecord,
  deletePaymentVerification,
  getAllPaymentVerifications,
  query,
  sql
} from '@/lib/db';
import { decryptPII } from '@/lib/crypto';
import { uploadToPinata, validateScreenshotFile } from '@/lib/pinata';
import { checkAutomaticVerificationMatch, updateVerificationWithAutomaticResult } from '@/lib/payment-verification';
import { validateReferenceNumberFormat } from '@/lib/reference-cleaning';
import { activateSubscriptionWithVerification } from '@/lib/subscription-activation';
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
    const body: { plan_id?: string; screenshot_base64?: string; reference_number?: string; notes?: string; promo_code?: string; final_amount?: number; payment_method?: string } = await req.json();

    if (!body.plan_id || !body.screenshot_base64 || !body.reference_number) {
      return NextResponse.json(
        { error: 'plan_id, screenshot_base64, and reference_number are required' },
        { status: 400 }
      );
    }

    // 3. Validate payment method and amount
    const allowedPaymentMethods = ['gcash', 'gotyme', 'usdc', 'pi', 'card', 'bank_transfer'];
    if (body.payment_method && !allowedPaymentMethods.includes(body.payment_method.toLowerCase())) {
      return NextResponse.json(
        { error: 'Invalid payment_method. Must be one of: ' + allowedPaymentMethods.join(', ') },
        { status: 400 }
      );
    }

    if (body.final_amount !== undefined && (!Number.isFinite(body.final_amount) || body.final_amount < 0)) {
      return NextResponse.json(
        { error: 'Invalid final_amount. Must be a non-negative number' },
        { status: 400 }
      );
    }

    // 4. Validate and sanitize plan_id
    if (!isValidUUID(body.plan_id)) {
      return NextResponse.json(
        { error: 'Invalid plan_id format' },
        { status: 400 }
      );
    }

    // 5. Validate reference number format
    const referenceNumberValidation = validateReferenceNumberFormat(body.reference_number);
    if (!referenceNumberValidation.valid) {
      return NextResponse.json(
        { error: referenceNumberValidation.message },
        { status: 400 }
      );
    }

    // 6. Validate and sanitize reference number and notes
    const sanitizedReferenceNumber = sanitizeInput(body.reference_number);
    const sanitizedNotes = body.notes ? sanitizeInput(body.notes) : undefined;

    // 7. Validate screenshot base64 and convert to File
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

    // 9. Create verification record
    const verification = await createPaymentVerification({
      user_id: session.userId,
      plan_id: body.plan_id,
      screenshot_url: uploadResult.cid,
      reference_number: sanitizedReferenceNumber,
      notes: sanitizedNotes,
      promo_code: body.promo_code ? sanitizeInput(body.promo_code).toUpperCase() : undefined,
      amount: body.final_amount !== undefined ? Number(body.final_amount) : undefined,
      payment_method: body.payment_method ? body.payment_method.toLowerCase() : undefined
    }, {
      companyId: session.companyId,
      userRole: (session.role || 'user') as 'user' | 'admin' | 'superadmin'
    });

    // 10. Trigger automatic verification (Trigger A)
    let matchResult;
    try {
      matchResult = await checkAutomaticVerificationMatch(verification, {
        companyId: session.companyId,
        userRole: (session.role || 'user') as 'user' | 'admin' | 'superadmin'
      });

      if (matchResult.shouldAutoApprove) {
        // Activate subscription first - fail hard if activation fails
        const activation = await activateSubscriptionWithVerification(
          verification.user_id,
          verification.plan_id,
          verification.id,
          {},
          {
            companyId: session.companyId,
            userRole: (session.role || 'user') as 'user' | 'admin' | 'superadmin'
          }
        );
        if (!activation.success) {
          throw new Error(activation.error || 'Failed to activate subscription');
        }

        // Update verification with automatic result
        await updateVerificationWithAutomaticResult(verification.id, matchResult, {
          companyId: session.companyId,
          userRole: (session.role || 'user') as 'user' | 'admin' | 'superadmin'
        });

        // Move verified payment into the payments ledger
        const webhookAmount = matchResult.webhookData?.amount != null
          ? Number(matchResult.webhookData.amount)
          : verification.amount;
        await createPaymentRecord({
          company_id: verification.company_id,
          user_id: verification.user_id,
          plan_id: verification.plan_id,
          amount: webhookAmount,
          payment_method: 'gcash',
          reference_number: verification.reference_number,
          promo_code: verification.promo_code
        }, {
          companyId: session.companyId,
          userRole: (session.role || 'user') as 'user' | 'admin' | 'superadmin'
        });

        await deletePaymentVerification(verification.id, {
          companyId: session.companyId,
          userRole: (session.role || 'user') as 'user' | 'admin' | 'superadmin'
        });
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
    const result = await getAllPaymentVerifications(filters, {
      companyId: session.companyId,
      userRole: (session.role || 'user') as 'user' | 'admin' | 'superadmin'
    });

    // 8. Enrich with decrypted user info and plan details
    const rlsContext = {
      companyId: session.companyId,
      userRole: (session.role || 'user') as 'user' | 'admin' | 'superadmin'
    };

    const userIds = [...new Set(result.verifications.map(v => v.user_id))];
    const planIds = [...new Set(result.verifications.map(v => v.plan_id))];

    let userMap = new Map<string, { name?: string; email?: string }>();
    let planMap = new Map<string, { name?: string; amount?: number }>();

    try {
      // Batch fetch encrypted user PII (with RLS context for admin visibility)
      if (userIds.length > 0) {
        const userRows = await query(
          'SELECT id, name_encrypted, email_encrypted FROM users WHERE id = ANY($1::uuid[])',
          [userIds as unknown as string],
          rlsContext.companyId,
          rlsContext.userRole
        );

        const decryptField = (value: unknown): string | undefined => {
          if (!value) return undefined;
          let data = value as string | Buffer;
          if (typeof data === 'string' && data.startsWith('\\x')) data = data.substring(2);
          const decrypted = decryptPII(data);
          return decrypted && decrypted !== '[Protected Data]' ? decrypted : undefined;
        };

        for (const row of userRows.rows) {
          userMap.set(row.id as string, {
            name: decryptField(row.name_encrypted),
            email: decryptField(row.email_encrypted)
          });
        }
      }

      // Fetch plan details via SECURITY DEFINER function
      for (const planId of planIds) {
        try {
          const planResult = await sql('SELECT get_subscription_plan_by_id($1::uuid) as plan_data', [planId]);
          if (planResult.length > 0) {
            const planData = typeof planResult[0].plan_data === 'string'
              ? JSON.parse(planResult[0].plan_data)
              : planResult[0].plan_data;
            if (planData) {
              planMap.set(planId, {
                name: planData.name,
                amount: planData.amount || planData.price
              });
            }
          }
        } catch (planError) {
          console.error('Error fetching plan details for verification:', planError);
        }
      }
    } catch (enrichError) {
      console.error('Error enriching verification list:', enrichError);
    }

    const enrichedVerifications = result.verifications.map(v => ({
      ...v,
      user_name: userMap.get(v.user_id)?.name,
      user_email: userMap.get(v.user_id)?.email,
      plan_name: planMap.get(v.plan_id)?.name,
      plan_amount: planMap.get(v.plan_id)?.amount
    }));

    // 9. Return paginated response
    return NextResponse.json({
      verifications: enrichedVerifications,
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