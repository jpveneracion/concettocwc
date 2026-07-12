// Debug specific migration issues
const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });

const sql = neon(process.env.DATABASE_URL);

(async () => {
  try {
    console.log('=== Debugging Migration Issues ===\n');

    // Check actual count
    console.log('1. Table Count Issue:');
    const countResult = await sql`SELECT COUNT(*) as count FROM oauth_accounts;`;
    console.log('   Actual count: ' + countResult[0].count);
    console.log('   Expected: 0');
    console.log('   Test: ' + (countResult[0].count === 0 ? 'PASS' : 'FAIL') + '\n');

    // Check provider constraints
    console.log('2. Provider Constraints:');
    const constraints = await sql`
      SELECT
        pg_get_constraintdef(c.oid) as constraint_def,
        c.conname as constraint_name
      FROM pg_constraint c
      JOIN pg_class cl ON cl.oid = c.conrelid
      WHERE cl.relname = 'oauth_accounts'
      AND c.contype = 'c';
    `;
    console.log('   Found ' + constraints.length + ' CHECK constraints:');
    constraints.forEach(constraint => {
      console.log('   - ' + constraint.constraint_name + ': ' + constraint.constraint_def.substring(0, 50) + '...');
    });

    // Find provider constraint specifically
    const providerConstraint = constraints.find(c =>
      c.constraint_def.includes('provider') && c.constraint_def.includes('IN')
    );
    console.log('   Provider IN constraint: ' + (providerConstraint ? 'FOUND' : 'NOT FOUND') + '\n');

    // Check if table has any data
    console.log('3. Table Data:');
    const tableData = await sql`SELECT * FROM oauth_accounts LIMIT 5;`;
    console.log('   Records found: ' + tableData.length);
    if (tableData.length > 0) {
      console.log('   Sample data:', tableData);
    }

    // Verify table creation with all constraints
    console.log('\n4. Complete Table Definition:');
    const tableDef = await sql`
      SELECT
        pg_get_tabledef('oauth_accounts') as table_definition;
    `;
    console.log(tableDef[0].table_definition);

  } catch (err) {
    console.error('Debug failed:', err.message);
    process.exit(1);
  }
})();