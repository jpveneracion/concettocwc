// Final comprehensive verification
const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });

const sql = neon(process.env.DATABASE_URL);

(async () => {
  try {
    console.log('=== Final OAuth Migration Verification ===\n');

    let allPassed = true;

    // 1. Table exists with correct structure
    console.log('1. oauth_accounts table structure:');
    const columns = await sql`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'oauth_accounts'
      ORDER BY ordinal_position;
    `;
    const expectedColumns = [
      'id', 'user_id', 'provider', 'provider_user_id', 'email', 'username',
      'wallet_address', 'access_token', 'refresh_token', 'expires_at',
      'created_at', 'updated_at'
    ];

    const actualColumns = columns.map(c => c.column_name);
    const missingColumns = expectedColumns.filter(col => !actualColumns.includes(col));
    const tableStructureOk = missingColumns.length === 0;

    console.log('   Expected columns: ' + expectedColumns.length);
    console.log('   Actual columns: ' + actualColumns.length);
    console.log('   Status: ' + (tableStructureOk ? '✓ PASS' : '✗ FAIL'));
    if (missingColumns.length > 0) {
      console.log('   Missing: ' + missingColumns.join(', '));
      allPassed = false;
    }
    console.log('');

    // 2. Indexes created
    console.log('2. Indexes:');
    const indexes = await sql`
      SELECT indexname
      FROM pg_indexes
      WHERE tablename = 'oauth_accounts'
      AND indexname LIKE 'idx_%'
      ORDER BY indexname;
    `;
    const expectedIndexes = ['idx_oauth_accounts_user_id', 'idx_oauth_accounts_provider', 'idx_oauth_accounts_email'];
    const actualIndexes = indexes.map(i => i.indexname);
    const missingIndexes = expectedIndexes.filter(idx => !actualIndexes.includes(idx));
    const indexesOk = missingIndexes.length === 0;

    console.log('   Expected indexes: ' + expectedIndexes.length);
    console.log('   Actual indexes: ' + actualIndexes.length);
    console.log('   Status: ' + (indexesOk ? '✓ PASS' : '✗ FAIL'));
    if (missingIndexes.length > 0) {
      console.log('   Missing: ' + missingIndexes.join(', '));
      allPassed = false;
    }
    console.log('');

    // 3. Encryption functions exist
    console.log('3. Encryption functions:');
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
    const functionsOk = missingFunctions.length === 0;

    console.log('   Expected functions: ' + expectedFunctions.length);
    console.log('   Actual functions: ' + actualFunctions.length);
    console.log('   Status: ' + (functionsOk ? '✓ PASS' : '✗ FAIL'));
    if (missingFunctions.length > 0) {
      console.log('   Missing: ' + missingFunctions.join(', '));
      allPassed = false;
    }
    console.log('');

    // 4. Provider constraint exists
    console.log('4. Provider constraint:');
    const constraints = await sql`
      SELECT conname
      FROM pg_constraint c
      JOIN pg_class cl ON cl.oid = c.conrelid
      WHERE cl.relname = 'oauth_accounts'
      AND c.contype = 'c'
      AND (pg_get_constraintdef(c.oid) LIKE '%provider%' OR
           pg_get_constraintdef(c.oid) LIKE '%google%');
    `;
    const providerConstraintOk = constraints.length > 0;
    console.log('   Status: ' + (providerConstraintOk ? '✓ PASS' : '✗ FAIL'));
    if (!providerConstraintOk) {
      allPassed = false;
    }
    console.log('');

    // 5. Triggers exist
    console.log('5. Updated_at trigger:');
    const triggers = await sql`
      SELECT trigger_name
      FROM information_schema.triggers
      WHERE event_object_table = 'oauth_accounts'
      AND trigger_name LIKE '%updated_at%';
    `;
    const triggerOk = triggers.length > 0;
    console.log('   Status: ' + (triggerOk ? '✓ PASS' : '✗ FAIL'));
    if (!triggerOk) {
      allPassed = false;
    }
    console.log('');

    // 6. pgcrypto extension
    console.log('6. pgcrypto extension:');
    const extension = await sql`
      SELECT extname, extversion
      FROM pg_extension
      WHERE extname = 'pgcrypto';
    `;
    const extensionOk = extension.length > 0;
    console.log('   Status: ' + (extensionOk ? '✓ PASS' : '✗ FAIL'));
    if (extension.length > 0) {
      console.log('   Version: ' + extension[0].extversion);
    } else {
      allPassed = false;
    }
    console.log('');

    // 7. Table is empty (ready for use)
    console.log('7. Table ready for use (empty):');
    const countResult = await sql`SELECT COUNT(*)::integer as count FROM oauth_accounts;`;
    const tableEmptyOk = countResult[0].count === 0;
    console.log('   Current records: ' + countResult[0].count);
    console.log('   Status: ' + (tableEmptyOk ? '✓ PASS' : '✗ FAIL'));
    if (!tableEmptyOk) {
      allPassed = false;
    }
    console.log('');

    // 8. Encryption functions work
    console.log('8. Encryption functions work:');
    try {
      const testValue = 'test_token_12345';
      const encryptionKey = process.env.ENCRYPTION_KEY;

      const encrypted = await sql`
        SELECT encrypt_token(${testValue}, ${encryptionKey}) as result;
      `;
      const decrypted = await sql`
        SELECT decrypt_token(${encrypted[0].result}, ${encryptionKey}) as result;
      `;
      const encryptionOk = decrypted[0].result === testValue;

      console.log('   Status: ' + (encryptionOk ? '✓ PASS' : '✗ FAIL'));
      if (!encryptionOk) {
        allPassed = false;
      }
    } catch (err) {
      console.log('   Status: ✗ FAIL - ' + err.message);
      allPassed = false;
    }
    console.log('');

    // Final result
    console.log('=== Migration Status ===');
    console.log('Overall: ' + (allPassed ? '✓ SUCCESS' : '✗ ISSUES DETECTED'));

    if (!allPassed) {
      console.log('\nSome verification checks failed. Please review the output above.');
      process.exit(1);
    }

  } catch (err) {
    console.error('Verification failed:', err.message);
    process.exit(1);
  }
})();