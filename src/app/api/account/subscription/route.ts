import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import {
  getSubscriptionByCompanyId,
  getSubscriptionPlan,
  buildSubscriptionDetails
} from '@/lib/subscription';
import type { SubscriptionDetails } from '@/types/subscription';

/**
 * GET /api/account/subscription
 *
 * Retrieves the current subscription details for the authenticated user's company.
 *
 * @returns Subscription details with usage statistics
 * @throws 401 - Unauthorized (no session)
 * @throws 404 - No subscription found (includes checkoutUrl)
 * @throws 500 - Server error
 */
export async function GET(req: NextRequest) {
  try {
    // 1. Authentication Check
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // 2. Subscription Retrieval
    const subscription = await getSubscriptionByCompanyId(session.companyId);
    if (!subscription) {
      // No subscription found - return checkout URL
      return NextResponse.json(
        {
          error: 'No subscription found',
          checkoutUrl: '/subscription/checkout'
        },
        { status: 404 }
      );
    }

    // 3. Plan Details
    const plan = await getSubscriptionPlan(subscription.plan_id);
    if (!plan) {
      return NextResponse.json(
        { error: 'Subscription plan not found' },
        { status: 404 }
      );
    }

    // 4. Subscription Details Building
    const subscriptionDetails: SubscriptionDetails = await buildSubscriptionDetails(
      subscription,
      plan
    );

    // 5. Return Response
    return NextResponse.json(subscriptionDetails);

  } catch (error) {
    console.error('Account subscription API error:', error);
    return NextResponse.json(
      {
        error: 'Failed to retrieve subscription details',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}