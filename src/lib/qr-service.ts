// src/lib/qr-service.ts

import { sql } from './db';

// ============================================================================
// TYPES
// ============================================================================

interface PlanDetails {
  id: string;
  name: string;
  price: number;
}

interface PaymentSettings {
  quarterly_discount_percent: number;
  annual_discount_percent: number;
}

interface PromoCode {
  code: string;
  discount_percent?: number;
  discount_amount?: number;
  usage_limit: number;
  current_usage: number;
  expires_at: Date;
  gcash_qr_url?: string;
  gotyme_qr_url?: string;
  active: boolean;
}

interface ValidationResult {
  valid: boolean;
  discount_percent?: number;
  discount_amount?: number;
  gcash_qr_url?: string;
  gotyme_qr_url?: string;
  error_message?: string;
  final_amount?: number;
}

interface QrCodeResult {
  url: string;
  method: 'gcash' | 'gotyme';
  amount: number;
  source: 'plan' | 'promo' | 'fallback';
  is_official: boolean;
}

// ============================================================================
// DISCOUNT CALCULATION
// ============================================================================

/**
 * Get payment settings from database for discount calculations
 */
async function getPaymentSettings(): Promise<PaymentSettings> {
  try {
    const result = await sql`
      SELECT quarterly_discount_percent, annual_discount_percent
      FROM payment_settings
      WHERE payment_method = 'gcash' OR payment_method = 'gotyme'
      LIMIT 1
    `;

    if (result.length > 0) {
      return {
        quarterly_discount_percent: parseFloat(result[0].quarterly_discount_percent) || 5.0,
        annual_discount_percent: parseFloat(result[0].annual_discount_percent) || 8.0
      };
    }
  } catch (error) {
    console.error('Error fetching payment settings:', error);
  }

  // Fallback to defaults if database fetch fails
  return {
    quarterly_discount_percent: 5.0,
    annual_discount_percent: 8.0
  };
}

/**
 * Calculate final price with compounding term discounts and optional promo code
 *
 * CRITICAL: This function implements the corrected compounding logic:
 * - Monthly rates are multiplied by months to get total discount percentage
 * - Term discount is applied first, then promo code on top
 * - 100% total discount cap prevents negative pricing
 *
 * @param basePrice - Base monthly price
 * @param months - Number of months (1, 3, 6, 12)
 * @param promoPercent - Optional promo code discount percentage
 * @returns Final price after all discounts
 */
export async function calculateFinalPrice(
  basePrice: number,
  months: number,
  promoPercent?: number
): Promise<number> {
  // Get configured term discount rates (per month) from database
  const settings = await getPaymentSettings();

  const termDiscountRate = months >= 12
    ? settings.annual_discount_percent   // Configurable (default 8% per month)
    : months >= 3
      ? settings.quarterly_discount_percent // Configurable (default 5% per month)
      : 0;

  // CRITICAL: Compound the monthly rate to get total term discount percentage
  const totalTermDiscountPercent = termDiscountRate * months;

  // Safety cap: Ensure total discount doesn't exceed 100%
  const cappedDiscountPercent = Math.min(totalTermDiscountPercent, 100);

  const baseTotal = basePrice * months;
  const termDiscount = baseTotal * (cappedDiscountPercent / 100);
  const priceAfterTermDiscount = baseTotal - termDiscount;

  // Step 2: Apply promo code on top
  if (promoPercent) {
    const promoDiscount = priceAfterTermDiscount * (promoPercent / 100);
    return Math.max(0, priceAfterTermDiscount - promoDiscount);
  }

  return Math.max(0, priceAfterTermDiscount);
}

/**
 * Test cases for discount calculation verification
 * These can be used for manual testing to verify the corrected calculations
 */
export async function testDiscountCalculations(): Promise<void> {
  console.log('=== Discount Calculation Test Cases ===');

  // Test 1: $10 quarterly, 5% rate
  const test1 = await calculateFinalPrice(10, 3);
  console.log('Test 1: $10 quarterly, 5% rate:', test1);
  // Expected: $25.50 (calculation: $10 × 3 = $30, 5% × 3 = 15% discount, $30 × 0.85 = $25.50)

  // Test 2: $10 annual, 8% rate
  const test2 = await calculateFinalPrice(10, 12);
  console.log('Test 2: $10 annual, 8% rate:', test2);
  // Expected: $0.40 (calculation: $10 × 12 = $120, 8% × 12 = 96% discount, $120 × 0.04 = $4.80)

  // Test 3: $10 quarterly, 5% rate, 10% promo
  const test3 = await calculateFinalPrice(10, 3, 10);
  console.log('Test 3: $10 quarterly, 5% rate, 10% promo:', test3);
  // Expected: $22.95 (calculation: $25.50 after term discount, then 10% off = $22.95)

  // Test 4: No discount (monthly)
  const test4 = await calculateFinalPrice(10, 1);
  console.log('Test 4: $10 monthly, no term discount:', test4);
  // Expected: $10 (no term discount for 1 month)

  console.log('=== End Test Cases ===');
}

// ============================================================================
// PROMO VALIDATION
// ============================================================================

/**
 * Validate promo code and return validation result
 * Now uses the enhanced activation system
 */
export async function validatePromoCode(
  promoCode: string,
  planPrice: number
): Promise<ValidationResult> {
  try {
    // Import the enhanced validation function
    const { validateActivationCodeWithDetails } = await import('./activation');

    // Determine plan from price (simplified - you might want to pass plan explicitly)
    let plan: 'basic' | 'pro' | 'premium' | 'trial' | 'enterprise' = 'basic';
    if (planPrice < 600) plan = 'basic';
    else if (planPrice < 1500) plan = 'pro';
    else if (planPrice < 3000) plan = 'premium';
    else plan = 'enterprise';

    const validationResult = await validateActivationCodeWithDetails(
      promoCode,
      plan.toUpperCase() as any
    );

    if (!validationResult.valid || !validationResult.activationCode) {
      return {
        valid: false,
        error_message: validationResult.error || 'Invalid promo code'
      };
    }

    const activationCode = validationResult.activationCode;
    const finalAmount = planPrice * (1 - activationCode.discount_percent / 100);

    return {
      valid: true,
      discount_percent: activationCode.discount_percent,
      discount_amount: planPrice - finalAmount,
      gcash_qr_url: activationCode.gcash_qr_url,
      gotyme_qr_url: activationCode.gotyme_qr_url,
      final_amount: Math.max(0, finalAmount)
    };

  } catch (error) {
    console.error('Promo validation error:', error);
    return {
      valid: false,
      error_message: 'Failed to validate promo code'
    };
  }
}

/**
 * Increment promo code usage
 * Now uses the enhanced activation system
 */
export async function incrementPromoUsage(promoCode: string): Promise<boolean> {
  try {
    // Import the redeem function which handles both usage systems
    const { redeemActivationCode } = await import('./activation');

    // We need to provide dummy values for userId and ipAddress since this is just a usage increment
    // In a real scenario, you'd want to track actual user usage
    await redeemActivationCode(
      promoCode,
      'system', // system user for usage tracking
      '0.0.0.0', // dummy IP
      'basic' as any // default plan
    );

    return true;
  } catch (error) {
    console.error('Error incrementing promo usage:', error);
    return false;
  }
}

// ============================================================================
// QR CODE SELECTION
// ============================================================================

/**
 * Get QR code URL for a specific plan price
 */
async function getPlanQrCode(
  planPrice: number,
  paymentMethod: 'gcash' | 'gotyme'
): Promise<string | null> {
  try {
    // Determine plan tier based on price
    let planTier = '';
    if (planPrice < 600) planTier = 'basic';
    else if (planPrice < 1500) planTier = 'pro';
    else planTier = 'premium';

    const column = `${paymentMethod}_${planTier}_qr_url`;

    const result = await sql`
      SELECT ${sql(column)} as qr_url
      FROM payment_settings
      WHERE id = 'default'
      LIMIT 1
    `;

    return result[0]?.qr_url || null;
  } catch (error) {
    console.error('Error getting plan QR code:', error);
    return null;
  }
}

/**
 * Get fallback QR code (generic one)
 */
async function getFallbackQrCode(paymentMethod: 'gcash' | 'gotyme'): Promise<string | null> {
  try {
    const result = await sql`
      SELECT payment_method, qr_code_url, account_number
      FROM payment_settings
      WHERE payment_method = ${paymentMethod} AND active = true
      LIMIT 1
    `;

    if (result[0]?.qr_code_url) {
      return result[0].qr_code_url;
    }

    // If no QR code, generate one from account number
    if (result[0]?.account_number) {
      const cleanNumber = result[0].account_number.replace(/-/g, '');
      return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${cleanNumber}`;
    }

    return null;
  } catch (error) {
    console.error('Error getting fallback QR code:', error);
    return null;
  }
}

/**
 * Main QR code selection function with full fallback logic
 */
export async function getPaymentQrCode(
  plan: PlanDetails,
  paymentMethod: 'gcash' | 'gotyme',
  promoCode?: string
): Promise<QrCodeResult> {

  // Priority 1: Check promo code validity
  if (promoCode) {
    const promoValidation = await validatePromoCode(promoCode, plan.price);

    if (promoValidation.valid) {
      // Use promo QR code if available
      const promoQrUrl = paymentMethod === 'gcash'
        ? promoValidation.gcash_qr_url
        : promoValidation.gotyme_qr_url;

      if (promoQrUrl) {
        return {
          url: promoQrUrl,
          method: paymentMethod,
          amount: promoValidation.final_amount || plan.price,
          source: 'promo',
          is_official: true
        };
      }
    }

    // If promo is invalid but was provided, log it
    if (!promoValidation.valid) {
      console.log(`Promo code ${promoCode} invalid: ${promoValidation.error_message}`);
    }
  }

  // Priority 2: Use plan-specific QR code
  const planQrUrl = await getPlanQrCode(plan.price, paymentMethod);
  if (planQrUrl) {
    return {
      url: planQrUrl,
      method: paymentMethod,
      amount: plan.price,
      source: 'plan',
      is_official: true
    };
  }

  // Priority 3: Use fallback QR code
  const fallbackQrUrl = await getFallbackQrCode(paymentMethod);
  if (fallbackQrUrl) {
    return {
      url: fallbackQrUrl,
      method: paymentMethod,
      amount: plan.price,
      source: 'fallback',
      is_official: paymentMethod === 'gcash' // Assume GCash QR is official
    };
  }

  // Priority 4: Last resort - generate QR from env variable
  const envNumber = paymentMethod === 'gcash'
    ? process.env.GCASH_NUMBER || '0917-123-4567'
    : process.env.GOTYME_NUMBER || '0928-987-6543';

  const cleanNumber = envNumber.replace(/-/g, '');
  return {
    url: `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${cleanNumber}`,
    method: paymentMethod,
    amount: plan.price,
    source: 'fallback',
    is_official: false
  };
}

// ============================================================================
// ADMIN FUNCTIONS
// ============================================================================

/**
 * Update plan QR codes
 */
export async function updatePlanQrCodes(settings: {
  gcash_basic?: string;
  gcash_pro?: string;
  gcash_premium?: string;
  gotyme_basic?: string;
  gotyme_pro?: string;
  gotyme_premium?: string;
}): Promise<boolean> {
  try {
    await sql`
      UPDATE payment_settings
      SET
        gcash_basic_qr_url = ${settings.gcash_basic || null},
        gcash_pro_qr_url = ${settings.gcash_pro || null},
        gcash_premium_qr_url = ${settings.gcash_premium || null},
        gotyme_basic_qr_url = ${settings.gotyme_basic || null},
        gotyme_pro_qr_url = ${settings.gotyme_pro || null},
        gotyme_premium_qr_url = ${settings.gotyme_premium || null},
        updated_at = CURRENT_TIMESTAMP
      WHERE id = 'default'
    `;
    return true;
  } catch (error) {
    console.error('Error updating plan QR codes:', error);
    return false;
  }
}

/**
 * Update promo QR code
 */
export async function updatePromoQrCode(
  promoCode: string,
  qrCodes: { gcash?: string; gotyme?: string }
): Promise<boolean> {
  try {
    await sql`
      UPDATE activation_codes
      SET
        gcash_qr_url = ${qrCodes.gcash || null},
        gotyme_qr_url = ${qrCodes.gotyme || null}
      WHERE code = ${promoCode}
    `;
    return true;
  } catch (error) {
    console.error('Error updating promo QR code:', error);
    return false;
  }
}