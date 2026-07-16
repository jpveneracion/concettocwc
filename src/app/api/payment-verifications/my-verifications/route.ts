import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getPaymentVerificationsByUserId } from '@/lib/db';
import { getPinataUrl } from '@/lib/pinata';

/**
 * GET /api/payment-verifications/my-verifications
 *
 * Gets current user's verification history
 */
export async function GET(req: Request) {
  try {
    // 1. Authentication Check
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized - Please log in' },
        { status: 401 }
      );
    }

    // 2. Parse query parameters
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');

    // 3. Get user's verifications
    const verifications = await getPaymentVerificationsByUserId(
      session.userId,
      status || undefined
    );

    // 4. Add gateway URLs and return
    const verificationsWithUrls = verifications.map(v => ({
      ...v,
      screenshot_url: getPinataUrl(v.screenshot_url)
    }));

    return NextResponse.json({
      verifications: verificationsWithUrls,
      total: verificationsWithUrls.length
    }, { status: 200 });

  } catch (error) {
    console.error('My verifications error:', error);

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}