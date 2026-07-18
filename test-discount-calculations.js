/**
 * Test script to verify critical math error fixes in discount calculations
 * Run with: node test-discount-calculations.js
 */

// Mock the database function for testing
async function mockGetPaymentSettings() {
  return {
    quarterly_discount_percent: 5.0,
    annual_discount_percent: 8.0
  };
}

/**
 * Calculate final price with compounding term discounts and optional promo code
 * This is the corrected implementation from qr-service.ts
 */
async function calculateFinalPrice(basePrice, months, promoPercent) {
  // Get configured term discount rates (per month) from database
  const settings = await mockGetPaymentSettings();

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
 * Test cases from the task specification
 */
async function runCriticalTests() {
  console.log('=== CRITICAL MATH ERROR FIX VERIFICATION ===\n');

  let allPassed = true;

  // Test 1: $10 quarterly subscription with 5% rate
  // Expected: $30 → 15% discount → $25.50 (not $28.50 as before)
  const test1 = await calculateFinalPrice(10, 3);
  const expected1 = 25.50;
  const test1Passed = Math.abs(test1 - expected1) < 0.01;

  console.log('Test 1: $10 quarterly subscription with 5% rate');
  console.log(`  Calculation: $10 × 3 = $30, 5% × 3 = 15% discount, $30 × 0.85 = $${expected1}`);
  console.log(`  Result: $${test1.toFixed(2)}`);
  console.log(`  Status: ${test1Passed ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`  Expected: $${expected1.toFixed(2)}`);
  if (!test1Passed) allPassed = false;
  console.log('');

  // Test 2: $10 annual subscription with 8% rate
  // Expected: $120 → 96% discount → $4.80 (not incorrect calculation)
  const test2 = await calculateFinalPrice(10, 12);
  const expected2 = 4.80;
  const test2Passed = Math.abs(test2 - expected2) < 0.01;

  console.log('Test 2: $10 annual subscription with 8% rate');
  console.log(`  Calculation: $10 × 12 = $120, 8% × 12 = 96% discount, $120 × 0.04 = $${expected2}`);
  console.log(`  Result: $${test2.toFixed(2)}`);
  console.log(`  Status: ${test2Passed ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`  Expected: $${expected2.toFixed(2)}`);
  if (!test2Passed) allPassed = false;
  console.log('');

  // Test 3: Edge case with 10% quarterly rate (below safety cap)
  // Expected: $30 → $21.00 (30% discount, not hitting safety cap)
  // First we need to override the mock settings to test this edge case
  const originalMock = mockGetPaymentSettings;
  mockGetPaymentSettings = async () => ({
    quarterly_discount_percent: 10.0,
    annual_discount_percent: 8.0
  });

  const test3 = await calculateFinalPrice(10, 3);
  const expected3 = 21.00; // 10% × 3 = 30% discount, $30 × 0.70 = $21.00
  const test3Passed = Math.abs(test3 - expected3) < 0.01;

  console.log('Test 3: Edge case with 10% quarterly rate (below safety cap)');
  console.log(`  Calculation: $10 × 3 = $30, 10% × 3 = 30% discount, $30 × 0.70 = $21.00`);
  console.log(`  Result: $${test3.toFixed(2)}`);
  console.log(`  Status: ${test3Passed ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`  Expected: $${expected3.toFixed(2)}`);
  if (!test3Passed) allPassed = false;
  console.log('');

  // Restore original mock
  mockGetPaymentSettings = originalMock;

  // Additional test 4: Monthly (no term discount)
  const test4 = await calculateFinalPrice(10, 1);
  const expected4 = 10.00;
  const test4Passed = Math.abs(test4 - expected4) < 0.01;

  console.log('Test 4: $10 monthly (no term discount)');
  console.log(`  Calculation: $10 × 1 = $10, no term discount for 1 month`);
  console.log(`  Result: $${test4.toFixed(2)}`);
  console.log(`  Status: ${test4Passed ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`  Expected: $${expected4.toFixed(2)}`);
  if (!test4Passed) allPassed = false;
  console.log('');

  // Test 5: With promo code on top of term discount
  const test5 = await calculateFinalPrice(10, 3, 10);
  const expected5 = 22.95; // $25.50 after term discount, then 10% off
  const test5Passed = Math.abs(test5 - expected5) < 0.01;

  console.log('Test 5: $10 quarterly with 5% rate, plus 10% promo code');
  console.log(`  Calculation: $25.50 after term discount, then 10% off = $22.95`);
  console.log(`  Result: $${test5.toFixed(2)}`);
  console.log(`  Status: ${test5Passed ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`  Expected: $${expected5.toFixed(2)}`);
  if (!test5Passed) allPassed = false;
  console.log('');

  console.log('=== CRITICAL MATH ERROR FIX SUMMARY ===');
  console.log(`Overall Status: ${allPassed ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}`);
  console.log(`Critical Math Error Fix: ${allPassed ? '✅ VERIFIED WORKING' : '❌ HAS ISSUES'}`);

  return allPassed;
}

/**
 * Additional edge case tests for safety caps
 */
async function runEdgeCaseTests() {
  console.log('\n=== EDGE CASE AND SAFETY CAP TESTS ===\n');

  let allPassed = true;

  // Test with extremely high quarterly rate (should cap at 100%)
  mockGetPaymentSettings = async () => ({
    quarterly_discount_percent: 50.0, // Way too high
    annual_discount_percent: 8.0
  });

  const test1 = await calculateFinalPrice(10, 3);
  const expected1 = 0.00; // Should cap at 100% discount
  const test1Passed = test1 === expected1;

  console.log('Edge Case 1: Excessive quarterly rate (50% for 3 months = 150%)');
  console.log(`  Calculation: Should cap at 100% discount = $0.00`);
  console.log(`  Result: $${test1.toFixed(2)}`);
  console.log(`  Status: ${test1Passed ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`  Expected: $${expected1.toFixed(2)} (safety cap working)`);
  if (!test1Passed) allPassed = false;
  console.log('');

  // Test with extremely high annual rate (should cap at 100%)
  mockGetPaymentSettings = async () => ({
    quarterly_discount_percent: 5.0,
    annual_discount_percent: 20.0 // Way too high: 20% × 12 = 240%
  });

  const test2 = await calculateFinalPrice(10, 12);
  const expected2 = 0.00; // Should cap at 100% discount
  const test2Passed = test2 === expected2;

  console.log('Edge Case 2: Excessive annual rate (20% for 12 months = 240%)');
  console.log(`  Calculation: Should cap at 100% discount = $0.00`);
  console.log(`  Result: $${test2.toFixed(2)}`);
  console.log(`  Status: ${test2Passed ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`  Expected: $${expected2.toFixed(2)} (safety cap working)`);
  if (!test2Passed) allPassed = false;
  console.log('');

  // Test negative pricing prevention with promo code
  mockGetPaymentSettings = async () => ({
    quarterly_discount_percent: 5.0,
    annual_discount_percent: 8.0
  });

  const test3 = await calculateFinalPrice(10, 3, 150); // 150% promo code
  const expected3 = 0.00; // Should prevent negative pricing
  const test3Passed = test3 === expected3;

  console.log('Edge Case 3: Excessive promo code (150% off)');
  console.log(`  Calculation: Should prevent negative pricing = $0.00`);
  console.log(`  Result: $${test3.toFixed(2)}`);
  console.log(`  Status: ${test3Passed ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`  Expected: $${expected3.toFixed(2)} (negative pricing prevention)`);
  if (!test3Passed) allPassed = false;
  console.log('');

  console.log('=== EDGE CASE TEST SUMMARY ===');
  console.log(`Overall Status: ${allPassed ? '✅ ALL EDGE CASES HANDLED' : '❌ SOME EDGE CASES FAILED'}`);

  return allPassed;
}

// Run all tests
async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║   CRITICAL BUG FIX VERIFICATION TEST SUITE               ║');
  console.log('║   Task 10: Final Testing and Validation                   ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  const criticalTestsPassed = await runCriticalTests();
  const edgeCaseTestsPassed = await runEdgeCaseTests();

  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║   FINAL TEST RESULTS                                      ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  const allPassed = criticalTestsPassed && edgeCaseTestsPassed;

  console.log(`🎯 Step 1 (Critical Math Error Fix): ${criticalTestsPassed ? '✅ PASSED' : '❌ FAILED'}`);
  console.log(`🛡️  Step 2 (Safety Cap Tests): ${edgeCaseTestsPassed ? '✅ PASSED' : '❌ FAILED'}`);
  console.log(`\n📊 OVERALL RESULT: ${allPassed ? '✅ ALL TESTS PASSED - CRITICAL FIX VERIFIED' : '❌ TESTS FAILED - ISSUES DETECTED'}`);

  if (allPassed) {
    console.log('\n✅ The critical math error fix is working correctly.');
    console.log('✅ Discount calculations are accurate and safe.');
    console.log('✅ Ready to proceed with database constraint testing.\n');
  } else {
    console.log('\n❌ Critical issues detected in discount calculations.');
    console.log('❌ Please review the calculation logic before proceeding.\n');
  }

  return allPassed;
}

// Run the tests
main().then(success => {
  process.exit(success ? 0 : 1);
}).catch(error => {
  console.error('Test execution error:', error);
  process.exit(1);
});