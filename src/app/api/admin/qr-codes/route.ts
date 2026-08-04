import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { requireAdmin } from '@/lib/permissions';
import { updatePlanQrCodes, updatePromoQrCode } from '@/lib/qr-service';
import { sql } from '@/lib/db';

/**
 * GET /api/admin/qr-codes
 *
 * Retrieve plan QR codes (admin only)
 */
export async function GET(req: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    await requireAdmin(session.userId);

    // Fetch plan QR codes from the normalized payment_qr_codes table
    const result = await sql`
      SELECT payment_method, billing_period, qr_url
      FROM payment_qr_codes
    `;

    const planQrCodes: Record<string, string | null> = {
      gcash_monthly: null,
      gcash_quarterly: null,
      gcash_annual: null,
      gotyme_monthly: null,
      gotyme_quarterly: null,
      gotyme_annual: null
    };

    result.forEach((row) => {
      const key = `${row.payment_method}_${row.billing_period}`;
      if (key in planQrCodes) {
        planQrCodes[key] = row.qr_url || null;
      }
    });

    return NextResponse.json(planQrCodes);

  } catch (error) {
    console.error('Get QR codes error:', error);

    if (error instanceof Error && error.message.includes('Forbidden')) {
      return NextResponse.json(
        { error: 'Forbidden - Admin access required' },
        { status: 403 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to retrieve QR codes' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/qr-codes
 *
 * Update plan QR codes (admin only)
 */
export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    await requireAdmin(session.userId);

    const { type, ...qrData } = await req.json();

    if (type === 'plan') {
      const userRole = (session.role || (session.isAdmin ? 'superadmin' : 'user')) as 'user' | 'admin' | 'superadmin';
      const success = await updatePlanQrCodes(qrData, {
        companyId: session.companyId,
        userRole
      });
      if (success) {
        return NextResponse.json({
          success: true,
          message: 'Plan QR codes updated successfully'
        });
      } else {
        return NextResponse.json(
          { error: 'Failed to update plan QR codes' },
          { status: 500 }
        );
      }
    } else if (type === 'promo') {
      const { promo_code, gcash_qr_url, gotyme_qr_url } = qrData;
      if (!promo_code) {
        return NextResponse.json(
          { error: 'Promo code is required' },
          { status: 400 }
        );
      }

      const success = await updatePromoQrCode(promo_code, {
        gcash: gcash_qr_url,
        gotyme: gotyme_qr_url
      });

      if (success) {
        return NextResponse.json({
          success: true,
          message: 'Promo QR codes updated successfully'
        });
      } else {
        return NextResponse.json(
          { error: 'Failed to update promo QR codes' },
          { status: 500 }
        );
      }
    } else {
      return NextResponse.json(
        { error: 'Invalid type. Must be "plan" or "promo"' },
        { status: 400 }
      );
    }

  } catch (error) {
    console.error('Update QR codes error:', error);

    if (error instanceof Error && error.message.includes('Forbidden')) {
      return NextResponse.json(
        { error: 'Forbidden - Admin access required' },
        { status: 403 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to update QR codes' },
      { status: 500 }
    );
  }
}