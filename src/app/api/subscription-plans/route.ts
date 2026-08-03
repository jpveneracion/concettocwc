// src/app/api/subscription-plans/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { sql } from '@/lib/db';

// GET - Get active subscription plans (public endpoint)
// Uses SECURITY DEFINER function get_subscription_plans() for controlled RLS bypass
export async function GET(req: NextRequest) {
  try {
    // Optional: Check if user is authenticated, but allow access for checkout
    const session = await getSession();

    console.log('Fetching subscription plans using SECURITY DEFINER function');

    // RLS context will be set by requireSessionWithRLS wrapper (Task 8)
    // Use SECURITY DEFINER function to get subscription plans
    const result = await sql('SELECT * FROM get_subscription_plans()');

    console.log('Raw database result:', result.length, 'plans');

    // Format the plans for API response
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

    console.log('Formatted plans:', formattedPlans.length);

    return NextResponse.json({
      plans: formattedPlans,
      count: formattedPlans.length
    });
  } catch (error) {
    console.error('Error fetching subscription plans:', error);

    // Provide more detailed error information for debugging
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Detailed error:', errorMessage);
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack');

    return NextResponse.json(
      {
        error: 'Internal server error',
        details: errorMessage,
        message: 'Failed to fetch subscription plans. Please try again later.'
      },
      { status: 500 }
    );
  }
}