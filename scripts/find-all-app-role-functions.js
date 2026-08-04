const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });
const sql = neon(process.env.DATABASE_URL);

(async () => {
  try {
    console.log('=== Finding all functions with app.role checks ===');
    
    // Get all SECURITY DEFINER functions that check for app.role
    const result = await sql`
      SELECT p.proname as function_name, pg_get_functiondef(p.oid) as definition
      FROM pg_proc p
      JOIN pg_namespace n ON p.pronamespace = n.oid
      WHERE n.nspname = 'public'
      AND pg_get_functiondef(p.oid) LIKE '%app.role%'
      ORDER BY p.proname
    `;
    
    console.log(`Found ${result.length} functions with app.role checks:`);
    result.forEach(f => {
      console.log(`\n- ${f.function_name}:`);
      // Show just the relevant lines
      const lines = f.definition.split('\n');
      const appRoleLines = lines.filter(line => line.includes('app.role'));
      appRoleLines.forEach(line => console.log('  ' + line.trim()));
    });
    
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
})();
