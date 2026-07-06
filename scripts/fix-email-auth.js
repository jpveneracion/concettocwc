/**
 * Fix Email Authentication Script
 *
 * This script restores email_hash for users who have encrypted emails
 * and need to be able to log in again.
 */

const { neon } = require('@neondatabase/serverless');
const crypto = require('crypto');

// Encryption key from environment
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;
if (!ENCRYPTION_KEY) {
  throw new Error('ENCRYPTION_KEY environment variable is not set');
}

// Database connection
if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is not set');
}
const sql = neon(process.env.DATABASE_URL);

// Hash email for searchable authentication
function hashEmailForSearch(email) {
  return crypto.createHash('sha256').update(email.toLowerCase().trim()).digest('hex');
}

// Decrypt PII data (same as in crypto.ts)
function decryptPII(encrypted) {
  const ALGORITHM = 'aes-256-gcm';
  const IV_LENGTH = 16;
  const TAG_LENGTH = 16;
  const TAG_POSITION = IV_LENGTH;
  const ENCRYPTED_POSITION = TAG_POSITION + TAG_LENGTH;

  const keyBuffer = Buffer.from(ENCRYPTION_KEY, 'hex');

  let encryptedBuffer;
  if (typeof encrypted === 'string') {
    encryptedBuffer = Buffer.from(encrypted, 'hex');
  } else if (Buffer.isBuffer(encrypted)) {
    encryptedBuffer = encrypted;
  } else {
    throw new Error('Encrypted data must be a hex string or Buffer');
  }

  if (encryptedBuffer.length < ENCRYPTED_POSITION) {
    throw new Error('Encrypted data too short');
  }

  const iv = encryptedBuffer.subarray(0, TAG_POSITION);
  const tag = encryptedBuffer.subarray(TAG_POSITION, ENCRYPTED_POSITION);
  const ciphertext = encryptedBuffer.subarray(ENCRYPTED_POSITION);

  const decipher = crypto.createDecipheriv(ALGORITHM, keyBuffer, iv);
  decipher.setAuthTag(tag);

  try {
    const decrypted = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final()
    ]).toString('utf8');
    return decrypted;
  } catch (error) {
    throw new Error('Failed to decrypt: authentication tag verification failed');
  }
}

async function main() {
  console.log('🔧 Fixing email authentication for users with encrypted emails...');

  try {
    // Find users who have encrypted email but no email_hash
    const users = await sql`
      SELECT id, email_encrypted, email
      FROM users
      WHERE email_encrypted IS NOT NULL
        AND email_hash IS NULL
    `;

    console.log(`Found ${users.length} users needing email_hash restoration`);

    let restored = 0;
    let failed = 0;

    for (const user of users) {
      try {
        let plaintextEmail;

        // Try to get plaintext email first, otherwise decrypt
        if (user.email) {
          plaintextEmail = user.email;
          console.log(`Using plaintext email for user ${user.id}`);
        } else if (user.email_encrypted) {
          // Convert Buffer to hex string if needed
          const encryptedHex = user.email_encrypted instanceof Buffer
            ? user.email_encrypted.toString('hex')
            : user.email_encrypted;

          plaintextEmail = decryptPII(encryptedHex);
          console.log(`Decrypted email for user ${user.id}`);
        }

        if (plaintextEmail) {
          const emailHash = hashEmailForSearch(plaintextEmail);

          await sql`
            UPDATE users
            SET email_hash = ${emailHash}
            WHERE id = ${user.id}
          `;

          console.log(`✅ Restored email_hash for user ${user.id} (${plaintextEmail})`);
          restored++;
        }
      } catch (error) {
        console.error(`❌ Failed to restore user ${user.id}:`, error.message);
        failed++;
      }
    }

    console.log(`\n📊 Results:`);
    console.log(`   Restored: ${restored}`);
    console.log(`   Failed: ${failed}`);
    console.log(`\n✨ Email authentication should now work for restored users!`);

  } catch (error) {
    console.error('❌ Script failed:', error);
    process.exit(1);
  }
}

main();