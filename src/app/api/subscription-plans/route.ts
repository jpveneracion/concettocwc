// src/app/api/subscription-plans/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';

// GET - Get active subscription plans (public endpoint)
export async function GET(req: NextRequest) {
  try {
    // Optional: Check if user is authenticated, but allow access for checkout
    const session = await getSession();

    const searchParams = req.nextUrl.searchParams;
    const includeInactive = searchParams.get('include_inactive') === 'true';

    // Import subscription plans utility
    const { getAllSubscriptionPlans, formatSubscriptionPlansForAPI } = await import('@/lib/subscription-plans');

    // Only fetch active plans for public access (unless specifically requested)
    const plans = await getAllSubscriptionPlans(
      includeInactive ? {} : { is_active: true }
    );

    return NextResponse.json({
      plans: formatSubscriptionPlansForAPI(plans),
      count: plans.length
    });
  } catch (error) {
    console.error('Error fetching subscription plans:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}