// Verify OAuth migration
const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });

const sql = neon(process.env.DATABASE_URL);

(async () => {
  try {
    console.log('=== OAuth Migration Verification ===\n');

    // 1. Check oauth_accounts table exists
    console.log('1. Checking oauth_accounts table...');
    const tableCheck = await sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'oauth_accounts'
      );
    `;
    console.log(`   Table exists: ${tableCheck[0].exists ? '✓' : '✗'}`);

    // 2. Get table structure
    console.log('\n2. Table structure:');
    const columns = await sql`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'oauth_accounts'
      ORDER BY ordinal_position;
    `;
    columns.forEach(col => {
      console.log(`   - ${col.column_name}: ${col.data_type} (${col.is_nullable})`);
    });

    // 3. Check indexes
    console.log('\n3. Checking indexes...');
    const indexes = await sql`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE tablename = 'oauth_accounts';
    `;
    indexes.forEach(idx => {
      console.log(`   - ${idx.indexname}`);
    });

    // 4. Check encryption functions
    console.log('\n4. Checking encryption functions...');
    const functions = await sql`
      SELECT routine_name
      FROM information_schema.routines
      WHERE routine_schema = 'public'
      AND routine_name LIKE '%token%'
      ORDER BY routine_name;
    `;
    functions.forEach(func => {
      console.log(`   - ${func.routine_name}`);
    });

    // 5. Test encryption functions
    console.log('\n5. Testing encryption functions...');
    try {
      const testResult = await sql`SELECT * FROM test_encryption()`;
      console.log(`   Encryption test: ${testResult[0].result === 'test_value' ? '✓' : '✗'}`);
    } catch (err) {
      console.log(`   Encryption test: ✗ (${err.message})`);
    }

    // 6. Check existing records
    console.log('\n6. Checking existing records...');
    const count = await sql`SELECT COUNT(*) as count FROM oauth_accounts;`;
    console.log(`   Total records: ${count[0].count}`);

    // 7. Check pgcrypto extension
    console.log('\n7. Checking pgcrypto extension...');
    const extension = await sql`
      SELECT EXISTS (
        SELECT 1 FROM pg_extension
        WHERE extname = 'pgcrypto'
      );
    `;
    console.log(`   pgcrypto enabled: ${extension[0].exists ? '✓' : '✗'}`);

    console.log('\n=== Verification Complete ===');

  } catch (err) {
    console.error('Verification failed:', err.message);
    process.exit(1);
  }
})();