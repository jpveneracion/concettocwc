// src/app/api/subscription-plans/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { requireSessionWithRLS } from '@/lib/requireSessionWithRLS';

// GET - Get active subscription plans (protected endpoint)
export const GET = requireSessionWithRLS(async (req, session) => {
  try {
    // RLS context is already set by requireSessionWithRLS
    const { getAllSubscriptionPlans, formatSubscriptionPlansForAPI } = await import('@/lib/subscription-plans');

    const rlsContext = {
      companyId: session.companyId,
      userRole: (session.role || (session.isAdmin ? 'superadmin' : 'user')) as 'user' | 'admin' | 'superadmin',
    };

    const plans = await getAllSubscriptionPlans({ is_active: true }, rlsContext);
    const formattedPlans = formatSubscriptionPlansForAPI(plans);

    return NextResponse.json({
      plans: formattedPlans,
      count: formattedPlans.length
    });
  } catch (error) {
    console.error('Error fetching subscription plans:', error);
    return NextResponse.json({ error: 'Failed to fetch subscription plans' }, { status: 500 });
  }
});
