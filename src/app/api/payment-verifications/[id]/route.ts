// src/app/api/payment-verifications/[id]/route.ts

import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { requireAdmin } from '@/lib/permissions';
import { getPaymentVerificationById, query, sql } from '@/lib/db';
import { getPinataUrl } from '@/lib/pinata';
import { decryptPII } from '@/lib/crypto';
import type { PaymentVerification, VerificationStatus } from '@/types/payment';

/**
 * Validate UUID format
 */
function isValidUUID(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

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

    // 2. Await params and validate ID format
    const { id } = await params;
    if (!isValidUUID(id)) {
      return NextResponse.json(
        { error: 'Invalid verification ID format' },
        { status: 400 }
      );
    }

    // 3. Get verification record
    const verification = await getPaymentVerificationById(id, {
      companyId: session.companyId,
      userRole: (session.role || 'user') as 'user' | 'admin' | 'superadmin'
    });
    if (!verification) {
      return NextResponse.json(
        { error: 'Verification not found' },
        { status: 404 }
      );
    }

    // 4. Authorization Check - allow admin or verification owner
    let isAdmin = false;
    try {
      await requireAdmin(session.userId);
      isAdmin = true;
    } catch {
      // User is not admin, check if they are the owner
    }

    const isOwner = verification.user_id === session.userId;

    if (!isAdmin && !isOwner) {
      return NextResponse.json(
        { error: 'Forbidden - You do not have access to this verification' },
        { status: 403 }
      );
    }

    // 5. Get user and plan details for response using SECURITY DEFINER functions
    let userEmail: string | undefined, planName: string | undefined, planAmount: number | undefined;

    // Helper: driver auto-parses json columns into objects; fall back to JSON.parse for strings
    const parseJsonColumn = (value: unknown): Record<string, unknown> | null => {
      if (value === null || value === undefined) return null;
      if (typeof value === 'string') {
        try { return JSON.parse(value); } catch { return null; }
      }
      if (typeof value === 'object') return value as Record<string, unknown>;
      return null;
    };

    try {
      // Get user info using SECURITY DEFINER function
      const userResult = await sql('SELECT get_user_by_id($1::uuid) as user_data', [verification.user_id]);
      if (userResult.length > 0) {
        const userData = parseJsonColumn(userResult[0].user_data);
        userEmail = userData?.email as string | undefined;
      }

      // Get plan info using SECURITY DEFINER function
      const planResult = await sql('SELECT get_subscription_plan_by_id($1::uuid) as plan_data', [verification.plan_id]);
      if (planResult.length > 0) {
        const planData = parseJsonColumn(planResult[0].plan_data);
        planName = planData?.name as string | undefined;
        planAmount = (planData?.amount || planData?.price) as number | undefined;
      }
    } catch (error) {
      console.error('Error fetching joined data:', error);
    }

    // Fetch and decrypt user email (plaintext column is nulled after PII encryption)
    try {
      const userRows = await query(
        'SELECT email_encrypted FROM users WHERE id = $1',
        [verification.user_id],
        session.companyId,
        (session.role || 'user') as 'user' | 'admin' | 'superadmin'
      );
      const encryptedEmail = userRows.rows[0]?.email_encrypted;
      if (encryptedEmail) {
        let encryptedData = encryptedEmail as string | Buffer;
        // Fix PostgreSQL hex format - remove '\x' prefix if present
        if (typeof encryptedData === 'string' && encryptedData.startsWith('\\x')) {
          encryptedData = encryptedData.substring(2);
        }
        const decrypted = decryptPII(encryptedData);
        if (decrypted && decrypted !== '[Protected Data]') {
          userEmail = decrypted;
        }
      }
    } catch (error) {
      console.error('Error decrypting user email:', error);
    }

    // 6. Build response with gateway URL and proper type conversion
    const response: PaymentVerification & {
      user_email?: string;
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
      plan_name: planName,
      plan_amount: planAmount
    };

    return NextResponse.json(response, { status: 200 });

  } catch (error) {
    console.error('Get verification error:', error);

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