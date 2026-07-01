import crypto from 'crypto';

/**
 * Generate a secure key with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
 * Set ENCRYPTION_KEY environment variable to the output
 */
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const TAG_LENGTH = 16;
const TAG_POSITION = IV_LENGTH;
const ENCRYPTED_POSITION = TAG_POSITION + TAG_LENGTH;

/**
 * Validates and returns the encryption key from environment
 * @throws {Error} If ENCRYPTION_KEY is not configured or is invalid
 * @returns Buffer containing the 32-byte encryption key
 */
function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;
  if (!key || key.length !== 64 || !/^[0-9a-f]{64}$/.test(key)) {
    throw new Error('ENCRYPTION_KEY must be 64-character hex string');
  }
  return Buffer.from(key, 'hex');
}

/**
 * Encrypt sensitive PII data
 * @param plaintext - Data to encrypt
 * @returns Encrypted data as Buffer (iv + tag + ciphertext)
 * @throws {Error} If encryption fails
 */
export function encryptPII(plaintext: string): Buffer {
  const keyBuffer = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);

  const cipher = crypto.createCipheriv(ALGORITHM, keyBuffer, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return Buffer.concat([iv, tag, ciphertext]);
}

/**
 * Decrypt sensitive PII data
 * @param encrypted - Buffer containing iv + tag + ciphertext
 * @returns Decrypted plaintext
 * @throws {Error} If encrypted data is too short, decryption fails, or auth tag verification fails
 */
export function decryptPII(encrypted: Buffer): string {
  const keyBuffer = getEncryptionKey();

  if (encrypted.length < ENCRYPTED_POSITION) {
    throw new Error('Encrypted data too short');
  }

  const iv = encrypted.subarray(0, TAG_POSITION);
  const tag = encrypted.subarray(TAG_POSITION, ENCRYPTED_POSITION);
  const ciphertext = encrypted.subarray(ENCRYPTED_POSITION);

  const decipher = crypto.createDecipheriv(ALGORITHM, keyBuffer, iv);
  decipher.setAuthTag(tag);

  try {
    const decrypted = decipher.update(ciphertext, 'binary', 'utf8') + decipher.final('utf8');
    return decrypted;
  } catch (error) {
    throw new Error('Failed to decrypt: authentication tag verification failed or data corrupted');
  }
}
