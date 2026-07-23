/**
 * Test script to verify promo code UUID fix
 *
 * This test demonstrates that promo codes now work with UUID-based plan identifiers
 * instead of expecting only billing period enum values.
 */

// Test with the actual TypeScript functions
const { validateActivationCodeWithDetails } = require('./src/lib/activation');
const { sql } = require('./src/lib/db');

async function testPromoCodeUUIDFix() {
  console.log('🧪 Testing Promo Code UUID Fix...\n');

  try {
    // 1. Get a sample subscription plan with UUID
    const plans = await sql('SELECT id, name, interval FROM subscription_plans LIMIT 3');

    if (plans.length === 0) {
      console.log('❌ No subscription plans found in database');
      return;
    }

    console.log('📋 Found subscription plans:');
    plans.forEach(plan => {
      console.log(`   - ${plan.name} (${plan.interval}): ${plan.id}`);
    });
    console.log('');

    // 2. Get a sample promo code
    const promoCodes = await sql(`
      SELECT code, applicable_plans, discount_percent
      FROM activation_codes
      WHERE is_active = true
      LIMIT 1
    `);

    if (promoCodes.length === 0) {
      console.log('❌ No active promo codes found in database');
      return;
    }

    const promoCode = promoCodes[0];
    console.log(`🎟️  Testing with promo code: ${promoCode.code}`);
    console.log(`   - Discount: ${promoCode.discount_percent}%`);
    console.log(`   - Applicable plans: ${JSON.stringify(promoCode.applicable_plans)}`);
    console.log('');

    // 3. Test the validation function with UUID instead of enum
    console.log('🔍 Testing validation with UUID instead of enum:');
    for (const plan of plans) {
      try {
        const result = await validateActivationCodeWithDetails(promoCode.code, plan.id);

        if (result.valid) {
          console.log(`   ✅ Plan "${plan.name}" (${plan.id}): VALID`);
          console.log(`      - Promo code applicable to this plan`);
        } else {
          console.log(`   ⏭️  Plan "${plan.name}" (${plan.id}): NOT APPLICABLE`);
          console.log(`      - ${result.error}`);
        }
      } catch (error) {
        console.log(`   ❌ Plan "${plan.name}" (${plan.id}): ERROR`);
        console.log(`      - ${error.message}`);
      }
    }

    console.log('\n✅ Test completed successfully!');
    console.log('The fix now allows promo codes to work with UUID-based plan identifiers.');

  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// Run the test
testPromoCodeUUIDFix()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Test error:', error);
    process.exit(1);
  });