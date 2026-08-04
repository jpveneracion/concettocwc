const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });
const sql = neon(process.env.DATABASE_URL);

(async () => {
  try {
    console.log('=== Finding functions with app.role checks ===');
    
    // Get all SECURITY DEFINER functions
    const functions = await sql`
      SELECT routine_name, routine_definition
      FROM information_schema.routines 
      WHERE routine_schema = 'public' 
      AND routine_type = 'FUNCTION'
      AND security_type = 'DEFINER'
      AND routine_definition LIKE '%app.role%'
    `;
    
    console.log(`Found ${functions.length} functions with app.role references:`);
    functions.forEach(f => {
      console.log(`- ${f.routine_name}`);
    });
    
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
})();
