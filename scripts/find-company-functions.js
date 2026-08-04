const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });
const sql = neon(process.env.DATABASE_URL);

(async () => {
  try {
    console.log('=== Finding Available Company Functions ===\n');
    
    // Find company-related functions
    const functions = await sql`
      SELECT routine_name 
      FROM information_schema.routines 
      WHERE routine_schema = 'public' 
      AND routine_name LIKE '%company%'
      ORDER BY routine_name
    `;
    
    console.log('Available company functions:');
    functions.forEach((func, index) => {
      console.log(`${index + 1}. ${func.routine_name}`);
    });
    
    // Check for create functions
    const createFunctions = await sql`
      SELECT routine_name 
      FROM information_schema.routines 
      WHERE routine_schema = 'public' 
      AND routine_name LIKE '%create%'
      ORDER BY routine_name
    `;
    
    console.log('\nAvailable create functions:');
    createFunctions.forEach((func, index) => {
      console.log(`${index + 1}. ${func.routine_name}`);
    });
    
    process.exit(0);
  } catch (err) {
    console.error('❌ Check failed:', err.message);
    process.exit(1);
  }
})();
