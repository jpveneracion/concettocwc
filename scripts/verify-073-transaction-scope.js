// Migration 073 Verification: Transaction Scope RLS Context
const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });

const sql = neon(process.env.DATABASE_URL);

(async () => {
  try {
    console.log('=== Migration 073 Verification: Transaction Scope ===\n');

    let allPassed = true;

    // 1. set_tenant_context function exists and uses transaction scope
    console.log('1. set_tenant_context function:');
    const setContextFunction = await sql`
      SELECT prosrc
      FROM pg_proc
      WHERE proname = 'set_tenant_context'
    `;

    if (setContextFunction.length === 0) {
      console.log('   Status: ✗ FAIL - Function not found');
      allPassed = false;
    } else {
      const functionSource = setContextFunction[0].prosrc || '';
      const usesTransactionScope = functionSource.includes('is_local=true') ||
                                    functionSource.includes("set_config('rls.current_company_id', company_id::TEXT, true)");

      console.log('   Function exists: ✓');
      console.log('   Uses transaction scope (is_local=true):', usesTransactionScope ? '✓' : '✗');

      if (!usesTransactionScope) {
        console.log('   Found source:', functionSource.substring(0, 200));
        allPassed = false;
      }
    }
    console.log('');

    // 2. reset_tenant_context function clears all context variables
    console.log('2. reset_tenant_context function:');
    const resetContextFunction = await sql`
      SELECT prosrc
      FROM pg_proc
      WHERE proname = 'reset_tenant_context'
    `;

    if (resetContextFunction.length === 0) {
      console.log('   Status: ✗ FAIL - Function not found');
      allPassed = false;
    } else {
      const functionSource = resetContextFunction[0].prosrc || '';
      const clearsCompanyId = functionSource.includes("set_config('rls.current_company_id', NULL, true)");
      const clearsUserRole = functionSource.includes("set_config('rls.current_user_role', NULL, true)");
      const clearsUserId = functionSource.includes("set_config('rls.current_user_id', NULL, true)");

      console.log('   Function exists: ✓');
      console.log('   Clears rls.current_company_id:', clearsCompanyId ? '✓' : '✗');
      console.log('   Clears rls.current_user_role:', clearsUserRole ? '✓' : '✗');
      console.log('   Clears rls.current_user_id (FIXED):', clearsUserId ? '✓' : '✗');

      if (!clearsCompanyId || !clearsUserRole || !clearsUserId) {
        console.log('   Found source:', functionSource.substring(0, 300));
        allPassed = false;
      }
    }
    console.log('');

    // 3. companies_insert_protection policy exists and uses superadmin check
    console.log('3. companies_insert_protection policy:');
    const policy = await sql`
      SELECT pg_get_expr(polwithcheck, polrelid) as policy_expr
      FROM pg_policy
      WHERE polname = 'companies_insert_protection'
      AND polrelid = 'companies'::regclass;
    `;

    if (policy.length === 0) {
      console.log('   Status: ✗ FAIL - Policy not found');
      allPassed = false;
    } else {
      const policyExpr = policy[0].policy_expr || '';
      const usesSuperadminCheck = policyExpr.includes('is_current_user_superadmin') ||
                                  policyExpr.includes('superadmin');

      console.log('   Policy exists: ✓');
      console.log('   Uses superadmin check:', usesSuperadminCheck ? '✓' : '✗');
      console.log('   Policy expression:', policyExpr);

      if (!usesSuperadminCheck) {
        allPassed = false;
      }
    }
    console.log('');

    // 4. Test transaction scope behavior
    console.log('4. Transaction scope behavior test:');
    try {
      // Set context in a transaction
      const testCompanyId = '00000000-0000-0000-0000-000000000001';
      await sql`
        SELECT set_tenant_context(${testCompanyId}::uuid, 'user')
      `;
      console.log('   Set context with set_tenant_context: ✓');

      // Check if context exists (should be present in transaction scope)
      const contextCheck = await sql`
        SELECT current_setting('rls.current_company_id', true) as company_id
      `;
      console.log('   Context available in transaction:', contextCheck[0].company_id ? '✓' : '✗');

      // Reset context
      await sql`SELECT reset_tenant_context()`;
      const afterReset = await sql`
        SELECT current_setting('rls.current_company_id', true) as company_id,
               current_setting('rls.current_user_role', true) as user_role,
               current_setting('rls.current_user_id', true) as user_id
      `;
      console.log('   After reset - all context NULL:',
        !afterReset[0].company_id && !afterReset[0].user_role && !afterReset[0].user_id ? '✓' : '✗');

      if (afterReset[0].company_id || afterReset[0].user_role || afterReset[0].user_id) {
        console.log('   Warning: Context still present after reset');
        allPassed = false;
      }

    } catch (err) {
      console.log('   Status: ✗ FAIL -', err.message);
      allPassed = false;
    }
    console.log('');

    // 5. SECURITY DEFINER attributes
    console.log('5. SECURITY DEFINER attributes:');
    const securityDefinerCheck = await sql`
      SELECT p.proname, p.prosecdef
      FROM pg_proc p
      WHERE p.proname IN ('set_tenant_context', 'reset_tenant_context')
    `;

    securityDefinerCheck.forEach(func => {
      const isSecurityDefiner = func.prosecdef;
      console.log(`   ${func.proname} SECURITY DEFINER:`, isSecurityDefiner ? '✓' : '✗');
      if (!isSecurityDefiner) {
        allPassed = false;
      }
    });
    console.log('');

    // 6. Function grants
    console.log('6. Function grants:');
    const grants = await sql`
      SELECT routine_name, privilege_type
      FROM information_schema.routine_privileges
      WHERE routine_name IN ('set_tenant_context', 'reset_tenant_context')
      AND grantee = 'PUBLIC'
    `;

    const hasSetContextGrant = grants.some(g => g.routine_name === 'set_tenant_context' && g.privilege_type === 'EXECUTE');
    const hasResetContextGrant = grants.some(g => g.routine_name === 'reset_tenant_context' && g.privilege_type === 'EXECUTE');

    console.log('   set_tenant_context EXECUTE granted to PUBLIC:', hasSetContextGrant ? '✓' : '✗');
    console.log('   reset_tenant_context EXECUTE granted to PUBLIC:', hasResetContextGrant ? '✓' : '✗');

    if (!hasSetContextGrant || !hasResetContextGrant) {
      allPassed = false;
    }
    console.log('');

    // Final result
    console.log('=== Migration 073 Status ===');
    console.log('Overall:', allPassed ? '✓ SUCCESS - Transaction scope verified' : '✗ ISSUES DETECTED');

    if (!allPassed) {
      console.log('\nSome verification checks failed. Please review the output above.');
      process.exit(1);
    }

    process.exit(0);

  } catch (err) {
    console.error('Verification failed:', err.message);
    process.exit(1);
  }
})();