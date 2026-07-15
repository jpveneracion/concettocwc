import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getSubscriptionByCompanyId, cancelSubscriptionAtPeriodEnd } from '@/lib/subscription';
import { getUTCNow, addUTCDays } from '@/lib/utc-utils';

const GRACE_PERIOD_DAYS = 7;

export async function POST(): Promise<NextResponse> {
  try {
    // 1. Authentication Check
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized - No active session found' },
        { status: 401 }
      );
    }

    // 2. Subscription Validation
    const subscription = await getSubscriptionByCompanyId(session.companyId);

    if (!subscription) {
      return NextResponse.json(
        { error: 'No subscription found for this company' },
        { status: 404 }
      );
    }

    // Check if already cancelled
    if (subscription.cancel_at_period_end) {
      return NextResponse.json(
        { error: 'Subscription is already set to cancel at period end' },
        { status: 400 }
      );
    }

    // 3. Cancellation Logic
    await cancelSubscriptionAtPeriodEnd(subscription.id);

    // 4. Calculate Grace Period
    const gracePeriodEnd = addUTCDays(getUTCNow(), GRACE_PERIOD_DAYS);

    // 5. PayMongo Integration (TODO)
    // TODO: Call PayMongo API to cancel subscription
    // For now, we only update the database

    // 6. Return Success Response
    return NextResponse.json({
      message: 'Subscription will be cancelled at the end of the current billing period',
      final_access_date: gracePeriodEnd.toISOString(),
      status: 'cancelled'
    });

  } catch (error: unknown) {
    console.error('POST /api/account/subscription/cancel', error);
    return NextResponse.json(
      { error: 'Failed to process subscription cancellation' },
      { status: 500 }
    );
  }
}