const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });

const sql = neon(process.env.DATABASE_URL);

async function debugRLS() {
  try {
    console.log('🔍 Checking RLS Functions...\n');

    const functions = await sql`
      SELECT
        routine_name,
        routine_type
      FROM information_schema.routines
      WHERE routine_schema = 'public'
      AND (routine_name LIKE 'get_current_%' OR routine_name LIKE 'is_current_%')
      ORDER BY routine_name
    `;

    console.log('Functions found:', functions.length);
    functions.forEach(func => {
      console.log(`- ${func.routine_name} (${func.routine_type})`);
    });

    // Test if functions actually work
    console.log('\n🔍 Testing RLS Function Calls...\n');

    const functionTests = await sql`
      SELECT
        get_current_company_id() as current_company_id,
        get_current_user_role() as current_user_role,
        is_current_user_superadmin() as is_superadmin,
        is_current_user_admin() as is_admin
    `;

    console.log('Function results:', functionTests[0]);

    // Check if policies use these functions
    console.log('\n🔍 Checking Policy Details...\n');

    const policyDetails = await sql`
      SELECT
        policyname,
        command,
        qual USING as using_expression,
        with_check
      FROM pg_policies
      WHERE tablename = 'company_product_definitions'
      LIMIT 3
    `;

    console.log('Sample policies:');
    policyDetails.forEach(policy => {
      console.log(`\n${policy.policyname} (${policy.command}):`);
      console.log(`USING: ${policy.using_expression || 'none'}`);
      console.log(`WITH CHECK: ${policy.with_check || 'none'}`);
    });

  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

debugRLS().then(() => process.exit(0)).catch(err => {
  console.error('Debug failed:', err);
  process.exit(1);
});