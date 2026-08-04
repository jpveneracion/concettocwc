const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });
const sql = neon(process.env.DATABASE_URL);

(async () => {
  try {
    console.log('=== Current SECURITY DEFINER Functions in Database ===\n');

    const securityDefinerFunctions = await sql`
      SELECT
        routine_name,
        routine_type,
        data_type,
        security_type
      FROM information_schema.routines
      WHERE routine_schema = 'public'
      AND security_type = 'DEFINER'
      ORDER BY routine_name
    `;

    console.log(`Found ${securityDefinerFunctions.length} SECURITY DEFINER functions:\n`);

    securityDefinerFunctions.forEach(func => {
      console.log(`- ${func.routine_name} (${func.routine_type})${func.data_type ? ` returns ${func.data_type}` : ''}`);
    });

    console.log('\n=== Function inventory complete ===');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error getting SECURITY DEFINER functions:', err.message);
    process.exit(1);
  }
})();