const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });
const sql = neon(process.env.DATABASE_URL);

(async () => {
  try {
    console.log('=== Verifying Migration 076: Remove Remaining app.role Checks ===\n');
    
    const functionsToCheck = [
      'check_company_exists',
      'check_user_exists_by_email_hash', 
      'create_company',
      'create_user'
    ];
    
    let allClean = true;
    
    for (const funcName of functionsToCheck) {
      const result = await sql`
        SELECT pg_get_functiondef(oid) as definition
        FROM pg_proc 
        WHERE proname = ${funcName}
        AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
      `;
      
      if (result.length > 0) {
        // Check for actual app.role EXECUTABLE code (not comments)
        const definition = result[0].definition;
        
        // Filter out comment lines
        const executableLines = definition.split('\n').filter(line => {
          const trimmed = line.trim();
          return trimmed.length > 0 && !trimmed.startsWith('--');
        }).join('\n');
        
        const hasAppRoleInCode = executableLines.includes('app.role');
        const status = hasAppRoleInCode ? '❌ HAS app.role in code' : '✅ Clean';
        console.log(`${funcName}: ${status}`);
        
        if (hasAppRoleInCode) {
          allClean = false;
          // Show only the lines with app.role that aren't comments
          const lines = definition.split('\n');
          const codeLinesWithAppRole = lines.filter(line => 
            line.includes('app.role') && !line.trim().startsWith('--')
          );
          codeLinesWithAppRole.forEach(line => console.log('  ' + line.trim()));
        }
      } else {
        console.log(`${funcName}: ⚠️  NOT FOUND`);
        allClean = false;
      }
    }
    
    console.log('\n' + '='.repeat(60));
    if (allClean) {
      console.log('✅ SUCCESS: All functions cleaned up successfully!');
      console.log('app.role executable checks removed from signup flow functions.');
      console.log('(Comments about removed checks are OK)');
    } else {
      console.log('❌ FAILURE: Some functions still have app.role in executable code');
      console.log('Migration may not have been applied correctly.');
    }
    
    process.exit(allClean ? 0 : 1);
  } catch (err) {
    console.error('❌ Verification failed:', err.message);
    process.exit(1);
  }
})();
