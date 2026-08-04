const { Pool } = require('pg');

async function checkFunctions() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    console.log('Checking database connection...');
    await pool.query('SELECT 1');
    console.log('✓ Database connection successful');

    console.log('\nChecking for SECURITY DEFINER functions...');
    const result = await pool.query(`
      SELECT routine_name, routine_type
      FROM information_schema.routines
      WHERE routine_schema = 'public'
      AND routine_name LIKE 'find_user%'
      ORDER BY routine_name
    `);

    console.log('Functions found:', result.rows.length);
    if (result.rows.length > 0) {
      result.rows.forEach(row => {
        console.log(`  - ${row.routine_name} (${row.routine_type})`);
      });
    } else {
      console.log('  ⚠ No SECURITY DEFINER functions found!');
    }

    console.log('\nChecking function definitions in pg_proc...');
    const procResult = await pool.query(`
      SELECT p.proname as name, pg_get_functiondef(p.oid) as definition
      FROM pg_proc p
      JOIN pg_namespace n ON p.pronamespace = n.oid
      WHERE n.nspname = 'public'
      AND p.proname LIKE 'find_user%'
      ORDER BY p.proname
    `);

    console.log('pg_proc entries:', procResult.rows.length);
    procResult.rows.forEach(row => {
      console.log(`\nFunction: ${row.name}`);
      console.log('Definition preview:', row.definition.substring(0, 300) + '...');
    });

    await pool.end();
    console.log('\n✓ Check complete');
  } catch (error) {
    console.error('✗ Error:', error.message);
    console.error('Full error:', error);
    process.exit(1);
  }
}

checkFunctions();