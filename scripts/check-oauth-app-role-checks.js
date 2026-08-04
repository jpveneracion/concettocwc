const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });
const sql = neon(process.env.DATABASE_URL);

(async () => {
  try {
    console.log('=== Checking OAuth Functions for app.role Checks ===\n');
    
    // Check the actual function definitions in the database
    const functionChecks = await sql`
      SELECT 
        routine_name,
        routine_definition
      FROM information_schema.routines 
      WHERE routine_schema = 'public' 
      AND routine_name IN ('find_oauth_account_by_provider', 'find_user_by_email_hash', 'find_user_by_id')
      ORDER BY routine_name
    `;
    
    functionChecks.forEach(func => {
      console.log(`\n=== ${func.routine_name} ===`);
      if (func.routine_definition) {
        const hasAppRoleCheck = func.routine_definition.includes('app.role');
        const hasIsLocalCheck = func.routine_definition.includes('is_local');
        
        console.log('Function exists:', '✅');
        console.log('Has app.role check:', hasAppRoleCheck ? '❌ YES (NEEDS FIX)' : '✅ NO (OK)');
        console.log('Uses transaction scope (is_local):', hasIsLocalCheck ? '✅ YES' : '❓ N/A');
        
        if (hasAppRoleCheck) {
          // Extract the relevant line
          const lines = func.routine_definition.split('$$')[1]?.split('\n') || [];
          const appRoleLine = lines.find(line => line.includes('app.role'));
          if (appRoleLine) {
            console.log('Problem line:', appRoleLine.trim());
          }
        }
      }
    });
    
    console.log('\n=== Summary ===');
    const anyNeedFix = functionChecks.some(func => 
      func.routine_definition && func.routine_definition.includes('app.role')
    );
    
    if (anyNeedFix) {
      console.log('❌ Functions still have app.role checks - Migration 077 needed');
      process.exit(1);
    } else {
      console.log('✅ All functions clean - No migration needed');
      process.exit(0);
    }
  } catch (err) {
    console.error('❌ Database check failed:', err.message);
    process.exit(1);
  }
})();
