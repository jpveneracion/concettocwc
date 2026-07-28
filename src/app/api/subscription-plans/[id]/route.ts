// src/app/api/subscription-plans/[id]/route.ts

import { NextRequest, NextResponse } from 'next/server';
import {
  getSubscriptionPlanById,
  formatSubscriptionPlanForAPI,
  resolvePlanIdentifier
} from '@/lib/subscription-plans';

/**
 * GET - Get single subscription plan by ID (public endpoint)
 *
 * This endpoint allows customers to fetch plan details using either:
 * - A plan UUID (database primary key)
 * - A billing period identifier (monthly/quarterly/annual) that gets resolved to UUID
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

    // Validate that we have some kind of ID
    if (!id || typeof id !== 'string') {
      return NextResponse.json(
        {
          error: 'Invalid plan ID',
          details: 'Plan ID must be provided'
        },
        { status: 400 }
      );
    }

    let resolvedPlanId: string | null = id;

    // Check if ID looks like a UUID (has 36 characters with dashes)
    const isUuidFormat = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

    if (!isUuidFormat) {
      // ID appears to be a billing period identifier, resolve it to UUID
      console.log(`Plan ID '${id}' is not a UUID format, attempting to resolve...`);
      resolvedPlanId = await resolvePlanIdentifier(id);

      if (!resolvedPlanId) {
        return NextResponse.json(
          {
            error: `Unable to resolve plan identifier '${id}'. Please check that the subscription plan exists.`,
            details: `No plan found for billing period: ${id}`
          },
          { status: 404 }
        );
      }
    }

    // Get plan from database using resolved UUID
    const plan = await getSubscriptionPlanById(resolvedPlanId);

    if (!plan) {
      return NextResponse.json(
        {
          error: 'Plan not found',
          details: `No plan found with ID: ${resolvedPlanId}`
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