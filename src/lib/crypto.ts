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
 * @returns Encrypted data as hex string (for proper bytea storage with Neon)
 * @throws {Error} If encryption fails
 */
export function encryptPII(plaintext: string): string {
  const keyBuffer = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);

  const cipher = crypto.createCipheriv(ALGORITHM, keyBuffer, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  const encryptedBuffer = Buffer.concat([iv, tag, ciphertext]);
  return encryptedBuffer.toString('hex');
}

/**
 * Decrypt sensitive PII data
 * @param encrypted - Hex string or Buffer containing iv + tag + ciphertext
 * @returns Decrypted plaintext
 * @throws {Error} If encrypted data is too short, decryption fails, or auth tag verification fails
 */
export function decryptPII(encrypted: string | Buffer): string {
  const keyBuffer = getEncryptionKey();

  // Convert hex string to Buffer if needed
  let encryptedBuffer: Buffer;
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
    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
    return decrypted;
  } catch (error) {
    throw new Error('Failed to decrypt: authentication tag verification failed or data corrupted');
  }
}
