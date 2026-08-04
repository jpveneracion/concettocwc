const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });
const sql = neon(process.env.DATABASE_URL);

(async () => {
  try {
    console.log('=== OAuth Signup Permissions Verification ===');
    
    await sql`SET ROLE concetto_boms`;
    const result = await sql`
      SELECT create_company_with_context('PERM_TEST', 'Permission Test', NULL, NULL, NULL, 15)
    `;
    console.log('✅ OAuth signup permissions verified - no 42501 errors');
    console.log('Created company:', result);
    
    // Cleanup test data
    await sql`DELETE FROM companies WHERE code = 'PERM_TEST'`;
    console.log('✅ Cleanup completed');
    
    console.log('\n✅ All OAuth permission tests passed');
    process.exit(0);
  } catch (err) {
    console.error('❌ Verification failed:', err.message);
    process.exit(1);
  }
})();
