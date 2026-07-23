// src/app/api/subscription-plans/[id]/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getSubscriptionPlanById, formatSubscriptionPlanForAPI } from '@/lib/subscription-plans';

/**
 * GET - Get single subscription plan by ID (public endpoint)
 *
 * This endpoint allows customers to fetch plan details using the plan UUID
 * from the payment instructions page or checkout flow
 *
 * @param req - NextRequest
 * @param params - Route parameters containing the plan ID
 * @returns NextResponse with plan details or error
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Validate UUID format (basic validation)
    if (!id || typeof id !== 'string' || id.length < 36) {
      return NextResponse.json(
        {
          error: 'Invalid plan ID format',
          details: 'Plan ID must be a valid UUID string'
        },
        { status: 400 }
      );
    }

    // Get plan from database
    const plan = await getSubscriptionPlanById(id);

    if (!plan) {
      return NextResponse.json(
        {
          error: 'Plan not found',
          details: `No plan found with ID: ${id}`
        },
        { status: 404 }
      );
    }

    // Format plan for API response
    const formattedPlan = formatSubscriptionPlanForAPI(plan);

    return NextResponse.json({
      success: true,
      plan: formattedPlan
    });

  } catch (error) {
    console.error('Error fetching subscription plan by ID:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    return NextResponse.json(
      {
        error: 'Internal server error',
        details: errorMessage,
        message: 'Failed to fetch subscription plan. Please try again later.'
      },
      { status: 500 }
    );
  }
}