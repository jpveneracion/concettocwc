// Run with: node src/lib/reencrypt.js
// This script re-encrypts all PII data to fix corrupted encrypted columns

const { neon } = require('@neondatabase/serverless');
const crypto = require('crypto');

require('dotenv').config({ path: '.env.local' });

const sql = neon(process.env.DATABASE_URL);

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const TAG_LENGTH = 16;
const TAG_POSITION = IV_LENGTH;
const ENCRYPTED_POSITION = TAG_POSITION + TAG_LENGTH;

function getEncryptionKey() {
  const key = process.env.ENCRYPTION_KEY;
  if (!key || key.length !== 64 || !/^[0-9a-f]{64}$/.test(key)) {
    throw new Error('ENCRYPTION_KEY must be 64-character hex string');
  }
  return Buffer.from(key, 'hex');
}

function encryptPII(plaintext) {
  const keyBuffer = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);

  const cipher = crypto.createCipheriv(ALGORITHM, keyBuffer, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  const encryptedBuffer = Buffer.concat([iv, tag, ciphertext]);
  return encryptedBuffer.toString('hex'); // Return hex string instead of Buffer
}

async function reencrypt() {
  console.log('Starting re-encryption of all PII data...');

  try {
    // Get all quotes that have plaintext data
    const quotes = await sql`
      SELECT id, customer_name, customer_address
      FROM quotes
      WHERE customer_name IS NOT NULL OR customer_address IS NOT NULL
    `;

    console.log(`Found ${quotes.length} quotes with plaintext data`);

    let success = 0;
    let failed = 0;

    for (const quote of quotes) {
      try {
        const customerNameEncrypted = quote.customer_name ? encryptPII(quote.customer_name) : null;
        const customerAddressEncrypted = quote.customer_address ? encryptPII(quote.customer_address) : null;

        await sql`
          UPDATE quotes
          SET customer_name_encrypted = decode(${customerNameEncrypted}, 'hex')::bytea,
              customer_address_encrypted = decode(${customerAddressEncrypted}, 'hex')::bytea
          WHERE id = ${quote.id}
        `;

        success++;
        console.log(`✓ Re-encrypted quote ${quote.id}`);
      } catch (err) {
        failed++;
        console.error(`✗ Failed to re-encrypt quote ${quote.id}:`, err.message);
      }
    }

    console.log(`\n✅ Re-encryption complete:`);
    console.log(`   Success: ${success}`);
    console.log(`   Failed: ${failed}`);

    // Now delete plaintext since we have valid encrypted data
    console.log('\nDeleting plaintext columns...');
    await sql`
      UPDATE quotes
      SET customer_name = NULL,
          customer_address = NULL
      WHERE customer_name_encrypted IS NOT NULL
    `;
    console.log('✅ Plaintext deleted');

    process.exit(0);
  } catch (err) {
    console.error('❌ Re-encryption failed:', err);
    process.exit(1);
  }
}

reencrypt();
