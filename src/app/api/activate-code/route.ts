// src/app/api/activate-code/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth';
import {
  redeemActivationCode
} from '@/lib/activation';
import {
  RedeemActivationCodeRequest,
  TrialStatusResponse
} from '@/types/subscription';
import { getTrialStatusResponse, activateSubscription } from '@/lib/subscription';

export async function POST(req: NextRequest) {
  try {
    const session = await requireSession();

    const body: RedeemActivationCodeRequest = await req.json();
    const { code, subscription_plan } = body;

    if (!code || !subscription_plan) {
      return NextResponse.json(
        { error: 'Code and subscription plan are required' },
        { status: 400 }
      );
    }

    // Get IP address for audit
    const ipAddress = req.headers.get('x-forwarded-for') ||
                     req.headers.get('x-real-ip') ||
                     'unknown';

    const userId = session.userId;

    // Validate and redeem code
    try {
      const redeemedCode = await redeemActivationCode(
        code,
        userId,
        ipAddress,
        subscription_plan
      );

      // Activate user subscription
      await activateSubscription(
        userId,
        code,
        redeemedCode.discount_percent,
        subscription_plan
      );

      // Get updated trial status
      const updatedStatus = await getTrialStatusResponse(userId);

      return NextResponse.json({
        success: true,
        code: redeemedCode.code,
        discount_percent: redeemedCode.discount_percent,
        subscription_plan,
        updated_status: updatedStatus as TrialStatusResponse
      });

    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Invalid activation code' },
        { status: 400 }
      );
    }

  } catch (error) {
    console.error('Error activating code:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}