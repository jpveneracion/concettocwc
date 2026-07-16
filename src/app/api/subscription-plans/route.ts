// src/app/api/subscription-plans/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { sql } from '@/lib/db';

// GET - Get active subscription plans (public endpoint)
export async function GET(req: NextRequest) {
  try {
    // Optional: Check if user is authenticated, but allow access for checkout
    const session = await getSession();

    const searchParams = req.nextUrl.searchParams;
    const includeInactive = searchParams.get('include_inactive') === 'true';

    console.log('Fetching subscription plans with includeInactive:', includeInactive);

    // Direct SQL query to avoid complex utility function issues
    let query = 'SELECT * FROM subscription_plans';
    let result: any[];

    if (includeInactive) {
      // Get all plans
      result = await sql`SELECT * FROM subscription_plans ORDER BY created_at DESC`;
    } else {
      // Only get active plans - check JSONB features field
      result = await sql`
        SELECT * FROM subscription_plans
        WHERE (features->>'is_active')::boolean = true
        ORDER BY created_at DESC
      `;
    }

    console.log('Raw database result:', result.length, 'plans');

    // Format the plans for API response
    const formattedPlans = result.map((plan: any) => {
      const features = plan.features || {};

      // Extract features array from JSONB object
      const featuresArray = Array.isArray(features.features)
        ? features.features
        : [];

      return {
        id: plan.id,
        name: plan.name,
        description: features.description || '',
        price: parseFloat(plan.price),
        currency: plan.currency,
        interval: plan.interval,
        discount_percent: features.discount_percent || 0,
        features: featuresArray,
        is_active: features.is_active !== undefined ? features.is_active : true,
        created_at: plan.created_at,
        updated_at: plan.updated_at
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