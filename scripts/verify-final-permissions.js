const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });
const sql = neon(process.env.DATABASE_URL);

(async () => {
  try {
    console.log('=== Final concetto_boms Permissions Verification ===');
    
    await sql`SET ROLE concetto_boms`;
    
    // Test OAuth signup functions
    const result = await sql`
      SELECT create_company_with_context('SMOKE_PERM_TEST', 'Smoke Permission Test', NULL, NULL, NULL, 15)
    `;
    
    const testCompanyId = result[0].create_company_with_context;
    console.log('✅ create_company_with_context works for concetto_boms:', testCompanyId);
    
    // Clean up test data
    await sql`DELETE FROM companies WHERE code = 'SMOKE_PERM_TEST'`;
    console.log('✅ Cleanup completed');
    
    console.log('\n✅ All concetto_boms permissions verified');
    process.exit(0);
  } catch (err) {
    console.error('❌ Permission test failed:', err.message);
    process.exit(1);
  }
})();
