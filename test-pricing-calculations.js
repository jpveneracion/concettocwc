require('dotenv').config({ path: '.env.local' });

async function testPricingCalculations() {
  console.log('Testing pricing calculations...\n');

  const expectedPrices = {
    monthly: 500.00,
    quarterly: 1350.00,
    annual: 5100.00
  };

  console.log('Expected prices:');
  console.log(`- Monthly: ₱${expectedPrices.monthly.toFixed(2)}`);
  console.log(`- Quarterly: ₱${expectedPrices.quarterly.toFixed(2)}`);
  console.log(`- Annual: ₱${expectedPrices.annual.toFixed(2)}\n`);

  console.log('Testing pricing API endpoints...');

  const baseUrl = 'http://localhost:3000'; // Adjust if your app runs on different port

  try {
    // Test monthly pricing
    console.log('\n1. Testing Monthly pricing:');
    const monthlyResponse = await fetch(`${baseUrl}/api/pricing?plan=monthly`);
    const monthlyData = await monthlyResponse.json();

    if (monthlyData.success && monthlyData.pricing) {
      const monthlyPrice = monthlyData.pricing.final_price;
      console.log(`   API returned: ₱${monthlyPrice.toFixed(2)}`);
      console.log(`   Expected: ₱${expectedPrices.monthly.toFixed(2)}`);
      console.log(`   Match: ${monthlyPrice === expectedPrices.monthly ? '✅ PASS' : '❌ FAIL'}`);
    } else {
      console.log('   ❌ FAIL - Invalid response');
    }

    // Test quarterly pricing
    console.log('\n2. Testing Quarterly pricing:');
    const quarterlyResponse = await fetch(`${baseUrl}/api/pricing?plan=quarterly`);
    const quarterlyData = await quarterlyResponse.json();

    if (quarterlyData.success && quarterlyData.pricing) {
      const quarterlyPrice = quarterlyData.pricing.final_price;
      console.log(`   API returned: ₱${quarterlyPrice.toFixed(2)}`);
      console.log(`   Expected: ₱${expectedPrices.quarterly.toFixed(2)}`);
      console.log(`   Match: ${quarterlyPrice === expectedPrices.quarterly ? '✅ PASS' : '❌ FAIL'}`);
    } else {
      console.log('   ❌ FAIL - Invalid response');
    }

    // Test annual pricing
    console.log('\n3. Testing Annual pricing:');
    const annualResponse = await fetch(`${baseUrl}/api/pricing?plan=annual`);
    const annualData = await annualResponse.json();

    if (annualData.success && annualData.pricing) {
      const annualPrice = annualData.pricing.final_price;
      console.log(`   API returned: ₱${annualPrice.toFixed(2)}`);
      console.log(`   Expected: ₱${expectedPrices.annual.toFixed(2)}`);
      console.log(`   Match: ${annualPrice === expectedPrices.annual ? '✅ PASS' : '❌ FAIL'}`);
    } else {
      console.log('   ❌ FAIL - Invalid response');
    }

    console.log('\n=== Pricing calculation test completed ===');

  } catch (error) {
    console.error('Error testing pricing calculations:', error.message);
    console.log('\nMake sure the Next.js development server is running:');
    console.log('  npm run dev');
    console.log('  or');
    console.log('  yarn dev');
  }
}

// Only run the test if this file is executed directly
if (require.main === module) {
  testPricingCalculations();
}

module.exports = { testPricingCalculations };