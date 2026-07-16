import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getPaymentVerificationsByUserId } from '@/lib/db';
import { getPinataUrl } from '@/lib/pinata';
import { VerificationStatus } from '@/types/payment';

/**
 * GET /api/payment-verifications/my-verifications
 *
 * Gets current user's verification history
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

    // 2. Parse query parameters
    const { searchParams } = new URL(req.url);
    const statusParam = searchParams.get('status');

    // Validate status parameter if provided
    let validStatus: string | undefined;
    if (statusParam) {
      const validStatuses = Object.values(VerificationStatus);
      if (validStatuses.includes(statusParam as VerificationStatus)) {
        validStatus = statusParam;
      } else {
        return NextResponse.json(
          { error: `Invalid status parameter. Must be one of: ${validStatuses.join(', ')}` },
          { status: 400 }
        );
      }
    }

    // 3. Get user's verifications
    const verifications = await getPaymentVerificationsByUserId(
      session.userId,
      validStatus
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

    // Handle database errors
    if (error instanceof Error) {
      return NextResponse.json(
        { error: 'Failed to retrieve verification history' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}