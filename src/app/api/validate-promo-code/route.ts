import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { validateActivationCodeWithDetails } from '@/lib/activation';
import { SubscriptionPlan } from '@/types/subscription';
import { calculatePrice, calculateFallbackPrice } from '@/lib/pricing-service';
import { getSubscriptionPlanById } from '@/lib/subscription-plans';

/**
 * Runtime validation for SubscriptionPlan enum values
 */
function isValidSubscriptionPlan(value: string): value is SubscriptionPlan {
  return Object.values(SubscriptionPlan).includes(value as SubscriptionPlan);
}

/**
 * Map database interval to SubscriptionPlan enum
 */
function mapIntervalToSubscriptionPlan(interval: string): SubscriptionPlan {
  switch (interval) {
    case 'month':
      return SubscriptionPlan.MONTHLY;
    case 'quarter':
      return SubscriptionPlan.QUARTERLY;
    case 'year':
      return SubscriptionPlan.ANNUAL;
    default:
      throw new Error(`Invalid interval: ${interval}`);
  }
}

/**
 * Check if a string is a valid UUID
 */
function isValidUUID(value: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(value);
}

/**
 * POST /api/validate-promo-code
 *
 * Validates a promo code and returns discount information with QR codes
 */
export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized - Please log in' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { code, plan_id } = body;

    if (!code || !plan_id) {
      return NextResponse.json(
        { error: 'Code and plan_id are required' },
        { status: 400 }
      );
    }

    // Determine plan_id type and resolve to SubscriptionPlan enum
    let planEnum: SubscriptionPlan;

    if (isValidSubscriptionPlan(plan_id)) {
      // Direct enum value (backward compatibility)
      planEnum = plan_id as SubscriptionPlan;
    } else if (isValidUUID(plan_id)) {
      // UUID - look up plan and convert interval to enum
      try {
        const rlsContext = {
          companyId: session.companyId,
          userRole: (session.role || (session.isAdmin ? 'superadmin' : 'user')) as 'user' | 'admin' | 'superadmin',
        };
        const plan = await getSubscriptionPlanById(plan_id, rlsContext);
        if (!plan) {
          return NextResponse.json(
            {
              valid: false,
              error: `Plan not found with ID: ${plan_id}`,
              validation_type: 'plan_lookup'
            },
            { status: 404 }
          );
        }
        planEnum = mapIntervalToSubscriptionPlan(plan.interval);
      } catch (error) {
        console.error('Error looking up plan by ID:', error);
        return NextResponse.json(
          {
            valid: false,
            error: `Failed to look up plan: ${error instanceof Error ? error.message : 'Unknown error'}`,
            validation_type: 'plan_lookup'
          },
          { status: 500 }
        );
      }
    } else {
      // Invalid plan_id format
      const validPlans = Object.values(SubscriptionPlan).join(', ');
      return NextResponse.json(
        {
          valid: false,
          error: `Invalid plan_id "${plan_id}". Must be a UUID or one of: ${validPlans}`,
          valid_plans: Object.values(SubscriptionPlan),
          validation_type: 'format_check'
        },
        { status: 400 }
      );
    }

    // Validate the promo code using enhanced validation
    // The validation function now handles both UUID and enum values
    const rlsContext = {
      companyId: session.companyId,
      userRole: (session.role || 'user') as 'user' | 'admin' | 'superadmin'
    };
    const validationResult = await validateActivationCodeWithDetails(code, plan_id, rlsContext);

    if (!validationResult.valid) {
      return NextResponse.json(
        {
          valid: false,
          error: validationResult.error || 'Invalid or expired promo code',
          validation_type: 'promo_code'
        },
        { status: 400 }
      );
    }

    const activationCode = validationResult.activationCode!;

    // Calculate final amount with discount
    // Note: The pricing should ideally come from the subscription plan in the database
    // For now, we'll return the discount info without specific pricing
    const discountedPercent = activationCode.discount_percent;

    // Return enhanced discount information with QR codes and pricing breakdown
    return NextResponse.json({
      valid: true,
      code: code,
      discount_type: 'percent',
      discount_percent: discountedPercent,
      gcash_qr_url: activationCode.gcash_qr_url,
      gotyme_qr_url: activationCode.gotyme_qr_url,
      usage_limit: activationCode.usage_limit,
      current_usage: activationCode.current_usage,
      expires_at: activationCode.expires_at,
      message: 'Promo code applied successfully'
    });

  } catch (error) {
    console.error('Promo code validation error:', error);

    // Provide more specific error information
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    const errorType = error instanceof Error && error.name ? error.name : 'UnknownError';

    return NextResponse.json(
      {
        error: 'Failed to validate promo code',
        error_type: errorType,
        details: errorMessage
      },
      { status: 500 }
    );
  }
}