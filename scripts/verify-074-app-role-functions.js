const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });
const sql = neon(process.env.DATABASE_URL);

(async () => {
  try {
    console.log('=== app.role Guard Removal Verification ===');

    // Set role first
    await sql`SET ROLE concetto_boms`;

    // Then test the function
    const result = await sql`SELECT create_company_with_context('TEST001', 'Test Company', NULL, NULL, NULL, 15)`;
    console.log('✅ create_company_with_context works without app.role guard');
    console.log('Result:', result);

    // Cleanup test data
    await sql`DELETE FROM companies WHERE code = 'TEST001'`;
    console.log('✅ Cleanup completed');

    console.log('\n✅ All app.role guard removal tests passed');
    process.exit(0);
  } catch (err) {
    console.error('❌ Verification failed:', err.message);
    process.exit(1);
  }
})();
