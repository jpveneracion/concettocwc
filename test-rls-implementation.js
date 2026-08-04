const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });

const sql = neon(process.env.DATABASE_URL);

async function testRLSImplementation() {
  console.log('🧪 Testing Users/OAuth RLS Implementation...\n');

  try {
    // Test the comprehensive RLS function
    console.log('📋 Running comprehensive RLS tests...');
    const results = await sql`SELECT * FROM test_users_oauth_rls_complete()`;

    console.log('\n📊 Test Results:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    let passCount = 0;
    let failCount = 0;

    results.forEach(result => {
      const status = result.success ? '✅ PASS' : '❌ FAIL';
      const table = result.table_name.padEnd(15);
      const test = result.test_name.padEnd(30);

      console.log(`${status} | ${table} | ${test}`);
      console.log(`    Message: ${result.message}`);

      if (result.details) {
        console.log(`    Details: ${result.details}`);
      }
      console.log('');

      if (result.success) passCount++;
      else failCount++;
    });

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`\n🎯 Summary: ${passCount} passed, ${failCount} failed out of ${results.length} total tests`);

    if (failCount === 0) {
      console.log('🎉 All RLS tests passed successfully!');
    } else {
      console.log('⚠️  Some tests failed. Please review the results above.');
    }

  } catch (error) {
    console.error('❌ Error running RLS tests:', error.message);
    process.exit(1);
  }
}

testRLSImplementation().then(() => {
  console.log('\n✅ RLS implementation testing complete');
  process.exit(0);
}).catch(err => {
  console.error('❌ Test execution failed:', err.message);
  process.exit(1);
});