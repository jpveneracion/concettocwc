// src/app/api/subscription-plans/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { requireSessionWithRLS } from '@/lib/requireSessionWithRLS';

// GET - Get active subscription plans (protected endpoint)
export const GET = requireSessionWithRLS(async (req, session) => {
  try {
    console.log('Fetching subscription plans using SECURITY DEFINER function');

    // RLS context is already set by requireSessionWithRLS
    const result = await sql('SELECT * FROM get_subscription_plans()');

    const formattedPlans = result.map((plan: any) => {
      const planData = typeof plan === 'string' ? JSON.parse(plan) : plan;
      return {
        id: planData.id,
        name: planData.name,
        description: planData.description || '',
        price: parseFloat(planData.price),
        currency: planData.currency,
        interval: planData.interval,
        discount_percent: planData.discount_percent || 0,
        features: planData.features || [],
        is_active: planData.is_active !== undefined ? planData.is_active : true,
        created_at: planData.created_at,
        updated_at: planData.updated_at
      };
    });

    return NextResponse.json({
      plans: formattedPlans,
      count: formattedPlans.length
    });
  } catch (error) {
    console.error('Error fetching subscription plans:', error);
    return NextResponse.json({ error: 'Failed to fetch subscription plans' }, { status: 500 });
  }
});