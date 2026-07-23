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
        const plan = await getSubscriptionPlanById(plan_id);
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
    const validationResult = await validateActivationCodeWithDetails(code, planEnum);

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

    // Calculate price using pricing service with fallback pricing
    let pricingResult;
    try {
      pricingResult = await calculatePrice(
        planEnum,
        activationCode.discount_percent
      );
      console.log('✓ Price calculated using pricing service');
    } catch (pricingError) {
      console.warn('⚠ Pricing service unavailable, using fallback pricing:', pricingError);
      // Use fallback pricing when service fails
      pricingResult = calculateFallbackPrice(
        planEnum,
        activationCode.discount_percent
      );
      console.log('✓ Price calculated using fallback pricing');
    }

    // Return enhanced discount information with QR codes and pricing breakdown
    return NextResponse.json({
      valid: true,
      code: code,
      pricing_breakdown: {
        base_price: pricingResult.base_price,
        period: pricingResult.billing_period,
        period_months: pricingResult.period_months,
        base_total: pricingResult.base_total,
        period_discount_percent: pricingResult.period_discount_percent,
        period_discount_amount: pricingResult.period_discount_amount,
        price_after_period_discount: pricingResult.price_after_period_discount,
        promo_discount_percent: pricingResult.promo_discount_percent,
        promo_discount_amount: pricingResult.promo_discount_amount,
        final_amount: pricingResult.final_price
      },
      discount_type: 'percent',
      discount_percent: activationCode.discount_percent,
      discount_amount: pricingResult.promo_discount_amount || 0,
      original_amount: pricingResult.base_total,
      final_amount: pricingResult.final_price,
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