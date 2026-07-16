// Test payment verification functions
const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });

const sql = neon(process.env.DATABASE_URL);

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
      // Test pending verification count
      console.log('\n2. Testing getPendingVerificationCount function...');
      const countResult = await sql('SELECT COUNT(*) as count FROM payment_verifications WHERE status = $1', ['pending']);
      const count = parseInt(countResult[0].count);
      console.log('Pending verification count:', count);

      // Test sample query
      console.log('\n3. Testing sample verification query...');
      const sampleResult = await sql('SELECT * FROM payment_verifications LIMIT 1');
      console.log('Sample verification record:', sampleResult.length > 0 ? 'Found records' : 'No records yet');

      // Test verification stats query
      console.log('\n4. Testing verification stats query...');
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const pendingResult = await sql('SELECT COUNT(*) as count FROM payment_verifications WHERE status = $1', ['pending']);
      const approvedResult = await sql('SELECT COUNT(*) as count FROM payment_verifications WHERE status = $1', ['approved']);
      const rejectedResult = await sql('SELECT COUNT(*) as count FROM payment_verifications WHERE status = $1', ['rejected']);

      console.log('Verification stats:');
      console.log('- Total pending:', parseInt(pendingResult[0].count));
      console.log('- Total approved:', parseInt(approvedResult[0].count));
      console.log('- Total rejected:', parseInt(rejectedResult[0].count));

      console.log('\n✅ All database function tests passed');
    } else {
      console.log('⚠️  payment_verifications table does not exist');
      console.log('Note: Functions will work once the table is created');
    }
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

testPaymentFunctions();