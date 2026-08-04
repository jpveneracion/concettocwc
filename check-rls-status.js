const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });

const sql = neon(process.env.DATABASE_URL);

async function checkRLSStatus() {
  console.log('🔍 Checking RLS Implementation Status...\n');

  try {
    // Check if RLS is enabled on tables
    console.log('📋 RLS Status:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    const tables = await sql`
      SELECT tablename, rowsecurity
      FROM pg_tables
      WHERE tablename IN ('users', 'oauth_accounts', 'quotes', 'company_product_definitions')
      ORDER BY tablename
    `;

    tables.forEach(table => {
      const status = table.rowsecurity ? '✅ ENABLED' : '❌ DISABLED';
      const name = table.tablename.padEnd(15);
      console.log(`${status} | ${name}`);
    });

    console.log('\n📋 RLS Policies Count:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    const policies = await sql`
      SELECT tablename, COUNT(*) as policy_count
      FROM pg_policies
      WHERE tablename IN ('users', 'oauth_accounts', 'quotes', 'company_product_definitions')
      GROUP BY tablename
      ORDER BY tablename
    `;

    policies.forEach(policy => {
      const count = policy.policy_count.toString().padEnd(5);
      const name = policy.tablename.padEnd(15);
      console.log(`📊 ${name} | ${count} policies`);
    });

    // Check detailed policies for company_product_definitions
    console.log('\n📋 Company Products Policies:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    const companyPolicies = await sql`
      SELECT
        policyname,
        command,
        qual USING as using_expression,
        with_check
      FROM pg_policies
      WHERE tablename = 'company_product_definitions'
      ORDER BY policyname
    `;

    if (companyPolicies.length === 0) {
      console.log('❌ No RLS policies found on company_product_definitions table');
    } else {
      companyPolicies.forEach(policy => {
        console.log(`🔐 ${policy.policyname} (${policy.command})`);
        if (policy.using_expression) {
          console.log(`   USING: ${policy.using_expression}`);
        }
        if (policy.with_check) {
          console.log(`   WITH CHECK: ${policy.with_check}`);
        }
      });
    }

    // Check if RLS functions exist
    console.log('\n📋 RLS Functions:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    const functions = await sql`
      SELECT
        routine_name,
        routine_type
      FROM information_schema.routines
      WHERE routine_schema = 'public'
      AND (routine_name LIKE 'get_current_%' OR routine_name LIKE 'is_current_%')
      ORDER BY routine_name
    `;

    if (functions.length === 0) {
      console.log('❌ No RLS functions found');
    } else {
      functions.forEach(func => {
        console.log(`🔧 ${func.routine_name} (${func.routine_type})`);
      });
    }

    console.log('\n✅ RLS infrastructure check complete');

  } catch (error) {
    console.error('❌ Error checking RLS status:', error.message);
    process.exit(1);
  }
}

checkRLSStatus().then(() => {
  console.log('\n✅ RLS status check complete');
  process.exit(0);
}).catch(err => {
  console.error('❌ Status check failed:', err.message);
  process.exit(1);
});
