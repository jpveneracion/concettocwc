// Test encryption with proper key
const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });

const sql = neon(process.env.DATABASE_URL);

(async () => {
  try {
    console.log('=== Testing Encryption Functions ===\n');

    const testToken = 'test_access_token_12345';
    const encryptionKey = process.env.ENCRYPTION_KEY;

    if (!encryptionKey) {
      console.log('✗ ENCRYPTION_KEY not set in environment');
      process.exit(1);
    }

    console.log(`Encryption key length: ${encryptionKey.length}`);
    console.log(`Test token: ${testToken}\n`);

    // Test encryption
    console.log('1. Encrypting test token...');
    const encrypted = await sql`
      SELECT encrypt_token(${testToken}, ${encryptionKey}) as encrypted_token;
    `;
    console.log(`   Encrypted: ${encrypted[0].encrypted_token.substring(0, 50)}...\n`);

    // Test decryption
    console.log('2. Decrypting token...');
    const decrypted = await sql`
      SELECT decrypt_token(${encrypted[0].encrypted_token}, ${encryptionKey}) as decrypted_token;
    `;
    console.log(`   Decrypted: ${decrypted[0].decrypted_token}`);
    console.log(`   Match: ${decrypted[0].decrypted_token === testToken ? '✓' : '✗'}\n`);

    // Test with NULL values
    console.log('3. Testing NULL handling...');
    const nullTest = await sql`
      SELECT
        encrypt_token(NULL, ${encryptionKey}) as enc_null,
        decrypt_token(NULL, ${encryptionKey}) as dec_null;
    `;
    console.log(`   Encrypt NULL: ${nullTest[0].enc_null === null ? '✓' : '✗'}`);
    console.log(`   Decrypt NULL: ${nullTest[0].dec_null === null ? '✓' : '✗'}\n`);

    // Test with existing encryption functions
    console.log('4. Testing end-to-end encryption workflow...');
    const endToEndTest = await sql`
      SELECT
        decrypt_token(
          encrypt_token('original_token_value', ${encryptionKey}),
          ${encryptionKey}
        ) as final_result;
    `;
    console.log(`   End-to-end test: ${endToEndTest[0].final_result === 'original_token_value' ? '✓' : '✗'}`);

    console.log('\n=== Encryption Tests Complete ===');

  } catch (err) {
    console.error('Encryption test failed:', err.message);
    process.exit(1);
  }
})();