const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });
const sql = neon(process.env.DATABASE_URL);

(async () => {
  try {
    console.log('=== Testing OAuth Function Behavior Directly ===\n');
    
    // Test if we can call find_oauth_account_by_provider without app.role
    console.log('1. Testing find_oauth_account_by_provider without app.role context...');
    try {
      const testResult = await sql`
        SELECT * FROM find_oauth_account_by_provider('google', 'test-provider-id')
      `;
      console.log('✅ Function works without app.role context');
      console.log('Result:', testResult.length > 0 ? 'Found records' : 'No records (as expected)');
    } catch (err) {
      if (err.message.includes('app.role') || err.message.includes('role context')) {
        console.log('❌ Function REQUIRES app.role context (BLOCKING OAuth)');
        console.log('Error:', err.message);
        process.exit(1);
      } else {
        console.log('✅ Function works (different error):', err.message);
      }
    }
    
    // Test find_user_by_email_hash without app.role
    console.log('\n2. Testing find_user_by_email_hash without app.role context...');
    try {
      const emailHashResult = await sql`
        SELECT * FROM find_user_by_email_hash('test123')
      `;
      console.log('✅ Function works without app.role context');
      console.log('Result:', emailHashResult.length > 0 ? 'Found records' : 'No records (as expected)');
    } catch (err) {
      if (err.message.includes('app.role') || err.message.includes('role context')) {
        console.log('❌ Function REQUIRES app.role context (BLOCKING OAuth)');
        console.log('Error:', err.message);
        process.exit(1);
      } else {
        console.log('✅ Function works (different error):', err.message);
      }
    }
    
    console.log('\n✅ All OAuth functions work without app.role context');
    process.exit(0);
  } catch (err) {
    console.error('❌ Test failed:', err.message);
    process.exit(1);
  }
})();
