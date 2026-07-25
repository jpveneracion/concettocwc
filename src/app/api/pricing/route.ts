import { NextResponse } from 'next/server';
import { calculatePrice, calculateFallbackPrice } from '@/lib/pricing-service';

/**
 * GET /api/pricing
 *
 * Customer-facing pricing calculation API
 * Returns itemized pricing breakdown for checkout display
 *
 * Query Parameters:
 * - plan: 'monthly' | 'quarterly' | 'annual' (required)
 * - promo_percent: number (optional, 0-100)
 *
 * Response format:
 * {
 *   "success": true,
 *   "pricing": {
 *     "base_price": 499,
 *     "period_months": 3,
 *     "base_total": 1497,
 *     "period_discount_percent": 5,
 *     "period_discount_amount": 74.85,
 *     "price_after_period_discount": 1422.15,
 *     "promo_discount_percent": 25,
 *     "promo_discount_amount": 355.54,
 *     "final_price": 1066.61,
 *     "billing_period": "quarterly",
 *     "calculated_at": "2026-07-22T..."
 *   }
 * }
 */
export async function GET(req: Request) {
  try {
    // Parse URL and extract query parameters
    const { searchParams } = new URL(req.url);
    const plan = searchParams.get('plan');
    const promoPercentStr = searchParams.get('promo_percent');

    // Validate required plan parameter
    if (!plan) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required parameter: plan',
          details: 'Plan must be one of: monthly, quarterly, annual'
        },
        { status: 400 }
      );
    }

    // Validate plan value
    const validPlans = ['monthly', 'quarterly', 'annual'];
    if (!validPlans.includes(plan)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid plan parameter',
          details: `Plan must be one of: ${validPlans.join(', ')}. Received: ${plan}`
        },
        { status: 400 }
      );
    }

    // Parse and validate promo_percent if provided
    let promoDiscountPercent: number | undefined = undefined;
    if (promoPercentStr !== null) {
      const promoPercent = parseFloat(promoPercentStr);

      if (isNaN(promoPercent)) {
        return NextResponse.json(
          {
            success: false,
            error: 'Invalid promo_percent parameter',
            details: 'promo_percent must be a valid number'
          },
          { status: 400 }
        );
      }

      if (promoPercent < 0 || promoPercent > 100) {
        return NextResponse.json(
          {
            success: false,
            error: 'Invalid promo_percent range',
            details: 'promo_percent must be between 0 and 100'
          },
          { status: 400 }
        );
      }

      promoDiscountPercent = promoPercent;
    }

    // Calculate price using pricing service
    const billingPeriod = plan as 'monthly' | 'quarterly' | 'annual';
    const priceResult = await calculatePrice(billingPeriod, promoDiscountPercent);

    // Return successful response with pricing breakdown
    return NextResponse.json({
      success: true,
      pricing: {
        base_price: priceResult.base_price,
        period_months: priceResult.period_months,
        base_total: priceResult.base_total,
        period_discount_percent: priceResult.period_discount_percent,
        period_discount_amount: priceResult.period_discount_amount,
        price_after_period_discount: priceResult.price_after_period_discount,
        promo_discount_percent: priceResult.promo_discount_percent,
        promo_discount_amount: priceResult.promo_discount_amount,
        final_price: priceResult.final_price,
        billing_period: priceResult.billing_period,
        calculated_at: priceResult.calculated_at.toISOString()
      }
    });

  } catch (error) {
    // Log error for debugging
    console.error('Pricing calculation error:', error);

    // Extract query params for fallback
    let fallbackPlan: 'monthly' | 'quarterly' | 'annual' = 'monthly';
    let fallbackPromoPercent: number | undefined = undefined;

    try {
      const { searchParams } = new URL(req.url);
      const plan = searchParams.get('plan');
      const promoPercentStr = searchParams.get('promo_percent');

      if (plan && ['monthly', 'quarterly', 'annual'].includes(plan)) {
        fallbackPlan = plan as 'monthly' | 'quarterly' | 'annual';
      }

      if (promoPercentStr !== null) {
        const parsed = parseFloat(promoPercentStr);
        if (!isNaN(parsed) && parsed >= 0 && parsed <= 100) {
          fallbackPromoPercent = parsed;
        }
      }
    } catch (parseError) {
      console.error('Error parsing params for fallback:', parseError);
    }

    // Calculate fallback price
    const fallbackResult = calculateFallbackPrice(fallbackPlan, fallbackPromoPercent);

    // Return response with fallback pricing
    return NextResponse.json({
      success: true,
      pricing: {
        base_price: fallbackResult.base_price,
        period_months: fallbackResult.period_months,
        base_total: fallbackResult.base_total,
        period_discount_percent: fallbackResult.period_discount_percent,
        period_discount_amount: fallbackResult.period_discount_amount,
        price_after_period_discount: fallbackResult.price_after_period_discount,
        promo_discount_percent: fallbackResult.promo_discount_percent,
        promo_discount_amount: fallbackResult.promo_discount_amount,
        final_price: fallbackResult.final_price,
        billing_period: fallbackResult.billing_period,
        calculated_at: fallbackResult.calculated_at.toISOString()
      },
      fallback: true
    });
  }
}
