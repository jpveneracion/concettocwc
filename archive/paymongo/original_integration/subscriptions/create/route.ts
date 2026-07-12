import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import {
  getSubscriptionByCompanyId,
  getSubscriptionPlan
} from '@/lib/subscription';
import type {
  PayMongoCheckoutRequest,
  PayMongoCheckoutResponse
} from '@/types/subscription';

/**
 * Validate checkout request
 *
 * Validates that required fields are present and URLs are properly formatted
 *
 * @param body - The request body to validate
 * @returns NextResponse with error if validation fails, null if validation passes
 */
function validateCheckoutRequest(body: PayMongoCheckoutRequest): NextResponse | null {
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
 * Creates a PayMongo checkout session for new subscriptions
 *
 * Request body:
 * - plan_id: string (required) - The subscription plan ID
 * - success_url: string (required) - URL to redirect after successful payment
 * - cancel_url: string (required) - URL to redirect after cancelled payment
 *
 * Response:
 * - checkout_url: string - PayMongo checkout URL
 * - session_id: string - PayMongo checkout session ID
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
    const body: PayMongoCheckoutRequest = await req.json();

    // Validate checkout request using helper function
    const validationError = validateCheckoutRequest(body);
    if (validationError) {
      return validationError;
    }

    const { plan_id, success_url, cancel_url } = body;

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

    // 5. Create PayMongo Checkout Session
    const checkoutData = await createPayMongoCheckout({
      amount: plan.amount,
      description: `${plan.name} Subscription (${plan.interval})`,
      plan_id: plan.id,
      company_id: session.companyId,
      success_url,
      cancel_url,
      companyCode: session.companyCode,
      email: session.email
    });

    // 6. Return checkout URL and session ID
    const response: PayMongoCheckoutResponse = {
      checkout_url: checkoutData.checkout_url,
      session_id: checkoutData.session_id
    };

    return NextResponse.json(response, { status: 200 });

  } catch (error) {
    console.error('POST /api/subscriptions/create error:', error);

    // Handle specific error types
    if (error instanceof Error) {
      // PayMongo API errors - more robust checking
      if (error.name === 'PayMongoError' || error.message?.toLowerCase().includes('paymongo')) {
        return NextResponse.json(
          { error: 'Payment service error - Please try again later' },
          { status: 500 }
        );
      }
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Create PayMongo Checkout Session
 *
 * Integrates with PayMongo API to create a checkout session
 *
 * For development: Returns mock checkout data
 * For production: Makes real API call to PayMongo
 */
async function createPayMongoCheckout(params: {
  amount: number;
  description: string;
  plan_id: string;
  company_id: string;
  success_url: string;
  cancel_url: string;
  companyCode: string;
  email: string;
}): Promise<{ checkout_url: string; session_id: string }> {
  const {
    amount,
    description,
    plan_id,
    company_id,
    success_url,
    cancel_url,
    companyCode,
    email
  } = params;

  // Environment variables
  const PAYMONGO_SECRET_KEY = process.env.PAYMONGO_SECRET_KEY;
  const PAYMONGO_API_URL = process.env.PAYMONGO_API_URL || 'https://api.paymongo.com/v1';

  // Check if running in development/mock mode
  if (!PAYMONGO_SECRET_KEY || PAYMONGO_SECRET_KEY.startsWith('sk_test_') || PAYMONGO_SECRET_KEY === 'mock') {
    // Mock mode for development
    console.log('⚠️  Using mock PayMongo checkout (development mode)');

    const mockSessionId = `mock_session_${Date.now()}_${plan_id}_${company_id}`;
    const mockCheckoutUrl = `https://checkout.paymongo.com/mock?session=${mockSessionId}`;

    return {
      checkout_url: mockCheckoutUrl,
      session_id: mockSessionId
    };
  }

  // Production mode - Make real PayMongo API call
  try {
    const response = await fetch(`${PAYMONGO_API_URL}/checkout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${Buffer.from(PAYMONGO_SECRET_KEY + ':').toString('base64')}`
      },
      body: JSON.stringify({
        data: {
          attributes: {
            amount: amount * 100, // PayMongo uses cents
            description: description,
            currency: 'PHP',
            metadata: {
              plan_id: plan_id,
              company_id: company_id,
              integration_type: 'subscription_checkout'
            },
            redirect: {
              success: success_url,
              failed: cancel_url
            },
            billing: {
              name: companyCode,
              email: email
            },
            send_email_receipt: true,
            show_line_items: true,
            line_items: [
              {
                name: description,
                amount: amount * 100,
                quantity: 1,
                currency: 'PHP'
              }
            ]
          }
        }
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`PayMongo API error: ${JSON.stringify(errorData)}`);
    }

    const data = await response.json();

    return {
      checkout_url: data.data.attributes.checkout_url,
      session_id: data.data.id
    };

  } catch (error) {
    console.error('PayMongo checkout creation error:', error);
    throw new Error(`PayMongo checkout failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}