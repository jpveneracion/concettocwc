import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import {
  getSubscriptionByCompanyId,
  getSubscriptionPlan
} from '@/lib/subscription';

/**
 * Validate checkout request
 *
 * Validates that required fields are present and URLs are properly formatted
 *
 * @param body - The request body to validate
 * @returns NextResponse with error if validation fails, null if validation passes
 */
function validateCheckoutRequest(body: any): NextResponse | null {
  const { plan_id, success_url, cancel_url } = body;

  // Validate required fields
  if (!plan_id) {
    return NextResponse.json(
      { error: 'plan_id is required' },
      { status: 400 }
    );
  }

  if (!success_url) {
    return NextResponse.json(
      { error: 'success_url is required' },
      { status: 400 }
    );
  }

  if (!cancel_url) {
    return NextResponse.json(
      { error: 'cancel_url is required' },
      { status: 400 }
    );
  }

  // Validate URL format
  try {
    new URL(success_url);
    new URL(cancel_url);
  } catch {
    return NextResponse.json(
      { error: 'Invalid URL format for success_url or cancel_url' },
      { status: 400 }
    );
  }

  return null; // Validation passed
}

/**
 * POST /api/subscriptions/create
 *
 * Validates subscription plan and returns plan details for manual payment flow
 * (Previously created PayMongo checkout sessions - now removed)
 *
 * Request body:
 * - plan_id: string (required) - The subscription plan ID
 * - success_url: string (required) - URL to redirect after successful payment
 * - cancel_url: string (required) - URL to redirect after cancelled payment
 * - payment_method: string (optional) - Payment method indicator
 *
 * Response:
 * - success: boolean - Validation success status
 * - plan_id: string - Validated plan ID
 * - plan_name: string - Plan name for display
 * - amount: number - Plan amount
 * - message: string - Next step instructions
 */
export async function POST(req: Request) {
  try {
    // 1. Authentication Check
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized - Please log in' },
        { status: 401 }
      );
    }

    // 2. Request Validation
    const body = await req.json();

    // Validate checkout request using helper function
    const validationError = validateCheckoutRequest(body);
    if (validationError) {
      return validationError;
    }

    const { plan_id } = body;

    // 3. Validate plan exists
    const plan = await getSubscriptionPlan(plan_id);
    if (!plan) {
      return NextResponse.json(
        { error: 'Invalid subscription plan' },
        { status: 400 }
      );
    }

    // 4. Duplicate Subscription Check
    const existingSubscription = await getSubscriptionByCompanyId(session.companyId);
    if (existingSubscription) {
      // Check if existing subscription is still active
      if (['trialing', 'active'].includes(existingSubscription.status)) {
        return NextResponse.json(
          {
            error: 'Company already has an active subscription',
          },
          { status: 409 }
        );
      }

      // Allow checkout if subscription is past_due, cancelled, or suspended
      // User wants to upgrade or renew
    }

    // 5. Return validation response with plan details
    const response = {
      success: true,
      plan_id: plan.id,
      plan_name: plan.name,
      amount: plan.amount,
      message: 'Proceed to payment instructions'
    };

    return NextResponse.json(response, { status: 200 });

  } catch (error) {
    console.error('POST /api/subscriptions/create error:', error);

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}