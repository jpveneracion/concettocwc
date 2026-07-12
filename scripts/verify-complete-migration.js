// Complete migration verification
const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });

const sql = neon(process.env.DATABASE_URL);

(async () => {
  try {
    console.log('=== Complete OAuth Migration Verification ===\n');

    // 1. Table structure and constraints
    console.log('1. OAuth Accounts Table:');
    const tableInfo = await sql`
      SELECT
        column_name,
        data_type,
        is_nullable,
        column_default
      FROM information_schema.columns
      WHERE table_name = 'oauth_accounts'
      ORDER BY ordinal_position;
    `;
    const expectedColumns = [
      'id', 'user_id', 'provider', 'provider_user_id', 'email', 'username',
      'wallet_address', 'access_token', 'refresh_token', 'expires_at',
      'created_at', 'updated_at'
    ];

    const actualColumns = tableInfo.map(c => c.column_name);
    const missingColumns = expectedColumns.filter(col => !actualColumns.includes(col));

    console.log(`   Expected columns: ${expectedColumns.length}`);
    console.log(`   Actual columns: ${actualColumns.length}`);
    console.log(`   All columns present: ${missingColumns.length === 0 ? '✓' : '✗'}`);
    if (missingColumns.length > 0) {
      console.log(`   Missing: ${missingColumns.join(', ')}`);
    }

    // 2. Indexes verification
    console.log('\n2. Indexes:');
    const indexes = await sql`
      SELECT indexname
      FROM pg_indexes
      WHERE tablename = 'oauth_accounts'
      ORDER BY indexname;
    `;
    const expectedIndexes = [
      'oauth_accounts_pkey',
      'oauth_accounts_provider_provider_user_id_key',
      'idx_oauth_accounts_user_id',
      'idx_oauth_accounts_provider',
      'idx_oauth_accounts_email'
    ];

    const actualIndexes = indexes.map(i => i.indexname);
    const missingIndexes = expectedIndexes.filter(idx => !actualIndexes.includes(idx));

    console.log(`   Expected indexes: ${expectedIndexes.length}`);
    console.log(`   Actual indexes: ${actualIndexes.length}`);
    console.log(`   All indexes present: ${missingIndexes.length === 0 ? '✓' : '✗'}`);
    if (missingIndexes.length > 0) {
      console.log(`   Missing: ${missingIndexes.join(', ')}`);
    }

    // 3. Encryption functions
    console.log('\n3. Encryption Functions:');
    const functions = await sql`
      SELECT routine_name
      FROM information_schema.routines
      WHERE routine_schema = 'public'
      AND routine_name IN ('encrypt_token', 'decrypt_token', 'test_encryption')
      ORDER BY routine_name;
    `;
    const expectedFunctions = ['decrypt_token', 'encrypt_token', 'test_encryption'];
    const actualFunctions = functions.map(f => f.routine_name);
    const missingFunctions = expectedFunctions.filter(func => !actualFunctions.includes(func));

    console.log(`   Expected functions: ${expectedFunctions.length}`);
    console.log(`   Actual functions: ${actualFunctions.length}`);
    console.log(`   All functions present: ${missingFunctions.length === 0 ? '✓' : '✗'}`);
    if (missingFunctions.length > 0) {
      console.log(`   Missing: ${missingFunctions.join(', ')}`);
    }

    // 4. Triggers
    console.log('\n4. Triggers:');
    const triggers = await sql`
      SELECT trigger_name
      FROM information_schema.triggers
      WHERE event_object_table = 'oauth_accounts';
    `;
    console.log(`   updated_at trigger: ${triggers.length > 0 ? '✓' : '✗'}`);

    // 5. pgcrypto extension
    console.log('\n5. Extensions:');
    const extension = await sql`
      SELECT extname, extversion
      FROM pg_extension
      WHERE extname = 'pgcrypto';
    `;
    console.log(`   pgcrypto: ${extension.length > 0 ? '✓' : '✗'}`);
    if (extension.length > 0) {
      console.log(`   Version: ${extension[0].extversion}`);
    }

    // 6. Table constraints
    console.log('\n6. Constraints:');
    const constraints = await sql`
      SELECT
        constraint_name,
        constraint_type
      FROM information_schema.table_constraints
      WHERE table_name = 'oauth_accounts';
    `;
    console.log(`   Primary key: ${constraints.some(c => c.constraint_type === 'PRIMARY KEY') ? '✓' : '✗'}`);
    console.log(`   Unique constraint: ${constraints.some(c => c.constraint_type === 'UNIQUE') ? '✓' : '✗'}`);
    console.log(`   Foreign key: ${constraints.some(c => c.constraint_type === 'FOREIGN KEY') ? '✓' : '✗'}`);

    // 7. Basic functionality test
    console.log('\n7. Basic Functionality:');
    const countResult = await sql`SELECT COUNT(*) as count FROM oauth_accounts;`;
    console.log(`   Empty table (count = 0): ${countResult[0].count === 0 ? '✓' : '✗'}`);

    // 8. Check provider constraint
    console.log('\n8. Provider Constraints:');
    const checkConstraints = await sql`
      SELECT
        pg_get_constraintdef(c.oid) as constraint_def
      FROM pg_constraint c
      JOIN pg_namespace n ON n.oid = c.connamespace
      JOIN pg_class cl ON cl.oid = c.conrelid
      WHERE cl.relname = 'oauth_accounts'
      AND c.contype = 'c';
    `;
    console.log(`   Provider check constraint: ${checkConstraints.some(c => c.constraint_def.includes('provider IN')) ? '✓' : '✗'}`);

    // Final status
    console.log('\n=== Migration Status ===');
    const allTestsPassed =
      missingColumns.length === 0 &&
      missingIndexes.length === 0 &&
      missingFunctions.length === 0 &&
      triggers.length > 0 &&
      extension.length > 0 &&
      countResult[0].count === 0;

    console.log(`Overall: ${allTestsPassed ? '✓ SUCCESS' : '✗ ISSUES DETECTED'}`);

  } catch (err) {
    console.error('Verification failed:', err.message);
    process.exit(1);
  }
})();