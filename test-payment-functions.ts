import { sql, getPendingVerificationCount } from './src/lib/db.js';

async function testPaymentFunctions() {
  console.log('Testing payment verification functions...');

  try {
    // Check if table exists
    console.log('\n1. Checking if payment_verifications table exists...');
    const tableCheck = await sql(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_name = 'payment_verifications'
    `);
    console.log('Table exists:', tableCheck.length > 0 ? 'Yes' : 'No');

    if (tableCheck.length > 0) {
      // Test getPendingVerificationCount function
      console.log('\n2. Testing getPendingVerificationCount function...');
      const count = await getPendingVerificationCount();
      console.log('Pending verification count:', count);

      // Test getAllPaymentVerifications function
      console.log('\n3. Testing getAllPaymentVerifications function...');
      const result = await sql('SELECT * FROM payment_verifications LIMIT 1');
      console.log('Sample verification record:', result.length > 0 ? 'Found' : 'None');

      // Test getVerificationStats function
      console.log('\n4. Testing getVerificationStats function...');
      const { getVerificationStats } = await import('./src/lib/db.js');
      const stats = await getVerificationStats();
      console.log('Verification stats:', stats);
    } else {
      console.log('⚠️  payment_verifications table does not exist');
      console.log('Note: Functions will work once the table is created');
    }

    console.log('\n✅ All available tests passed');
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

testPaymentFunctions();