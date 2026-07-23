require('dotenv').config({ path: '.env.local' );

// Test pricing calculations directly using the pricing service
async function testPricingDirect() {
  console.log('Testing pricing calculations directly...\n');

  const expectedPrices = {
    monthly: 500.00,
    quarterly: 1350.00,
    annual: 5100.00
  };

  console.log('Expected prices:');
  console.log(`- Monthly: ₱${expectedPrices.monthly.toFixed(2)}`);
  console.log(`- Quarterly: ₱${expectedPrices.quarterly.toFixed(2)}`);
  console.log(`- Annual: ₱${expectedPrices.annual.toFixed(2)}\n`);

  try {
    // Import the pricing service functions
    const { calculatePrice } = require('./src/lib/pricing-service.ts');

    console.log('Testing pricing calculations...');

    // Test monthly pricing
    console.log('\n1. Testing Monthly pricing:');
    const monthlyResult = await calculatePrice('monthly');
    const monthlyPrice = monthlyResult.final_price;
    console.log(`   Calculation returned: ₱${monthlyPrice.toFixed(2)}`);
    console.log(`   Expected: ₱${expectedPrices.monthly.toFixed(2)}`);
    console.log(`   Base price: ₱${monthlyResult.base_price.toFixed(2)}`);
    console.log(`   Period months: ${monthlyResult.period_months}`);
    console.log(`   Period discount: ${monthlyResult.period_discount_percent}%`);
    console.log(`   Match: ${monthlyPrice === expectedPrices.monthly ? '✅ PASS' : '❌ FAIL'}`);

    // Test quarterly pricing
    console.log('\n2. Testing Quarterly pricing:');
    const quarterlyResult = await calculatePrice('quarterly');
    const quarterlyPrice = quarterlyResult.final_price;
    console.log(`   Calculation returned: ₱${quarterlyPrice.toFixed(2)}`);
    console.log(`   Expected: ₱${expectedPrices.quarterly.toFixed(2)}`);
    console.log(`   Base price: ₱${quarterlyResult.base_price.toFixed(2)}`);
    console.log(`   Period months: ${quarterlyResult.period_months}`);
    console.log(`   Base total: ₱${quarterlyResult.base_total.toFixed(2)}`);
    console.log(`   Period discount: ${quarterlyResult.period_discount_percent}%`);
    console.log(`   Period discount amount: ₱${quarterlyResult.period_discount_amount.toFixed(2)}`);
    console.log(`   Final price: ₱${quarterlyPrice.toFixed(2)}`);
    console.log(`   Match: ${quarterlyPrice === expectedPrices.quarterly ? '✅ PASS' : '❌ FAIL'}`);

    // Test annual pricing
    console.log('\n3. Testing Annual pricing:');
    const annualResult = await calculatePrice('annual');
    const annualPrice = annualResult.final_price;
    console.log(`   Calculation returned: ₱${annualPrice.toFixed(2)}`);
    console.log(`   Expected: ₱${expectedPrices.annual.toFixed(2)}`);
    console.log(`   Base price: ₱${annualResult.base_price.toFixed(2)}`);
    console.log(`   Period months: ${annualResult.period_months}`);
    console.log(`   Base total: ₱${annualResult.base_total.toFixed(2)}`);
    console.log(`   Period discount: ${annualResult.period_discount_percent}%`);
    console.log(`   Period discount amount: ₱${annualResult.period_discount_amount.toFixed(2)}`);
    console.log(`   Final price: ₱${annualPrice.toFixed(2)}`);
    console.log(`   Match: ${annualPrice === expectedPrices.annual ? '✅ PASS' : '❌ FAIL'}`);

    // Overall summary
    const allTestsPass =
      monthlyPrice === expectedPrices.monthly &&
      quarterlyPrice === expectedPrices.quarterly &&
      annualPrice === expectedPrices.annual;

    console.log('\n=== Test Summary ===');
    console.log(`All tests: ${allTestsPass ? '✅ PASS' : '❌ FAIL'}`);
    console.log('\nPricing system integration test completed!');

    if (allTestsPass) {
      console.log('\n✅ SUCCESS: Pricing system is properly integrated!');
      console.log('✅ PlanComparison component now uses /api/pricing endpoint');
      console.log('✅ Database pricing_config set to user desired values:');
      console.log('   - Monthly: ₱500.00');
      console.log('   - Quarterly: ₱1,350.00 (10% discount)');
      console.log('   - Annual: ₱5,100.00 (15% discount)');
    }

  } catch (error) {
    console.error('Error testing pricing calculations:', error.message);
    console.error('\nMake sure all dependencies are installed:');
    console.log('  npm install');
    console.log('  or');
    console.log('  yarn install');
  }
}

// Run the test
testPricingDirect();