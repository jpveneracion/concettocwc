import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32;
const IV_LENGTH = 16;
const SALT_LENGTH = 64;
const TAG_LENGTH = 16;
const TAG_POSITION = SALT_LENGTH + IV_LENGTH;
const ENCRYPTED_POSITION = TAG_POSITION + TAG_LENGTH;

/**
 * Encrypt sensitive PII data
 * @param plaintext - Data to encrypt
 * @returns Encrypted data as Buffer (salt + iv + tag + ciphertext)
 */
export function encryptPII(plaintext: string): Buffer {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) {
    throw new Error('ENCRYPTION_KEY not configured in environment');
  }

  if (key.length !== 64 || !/^[0-9a-f]{64}$/.test(key)) {
    throw new Error('ENCRYPTION_KEY must be 64-character hex string');
  }

  const iv = crypto.randomBytes(IV_LENGTH);
  const salt = crypto.randomBytes(SALT_LENGTH);
  const keyBuffer = Buffer.from(key, 'hex');

  const cipher = crypto.createCipheriv(ALGORITHM, keyBuffer, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return Buffer.concat([salt, iv, tag, ciphertext]);
}

/**
 * Decrypt sensitive PII data
 * @param encrypted - Buffer containing salt + iv + tag + ciphertext
 * @returns Decrypted plaintext
 */
export function decryptPII(encrypted: Buffer): string {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) {
    throw new Error('ENCRYPTION_KEY not configured in environment');
  }

  if (key.length !== 64 || !/^[0-9a-f]{64}$/.test(key)) {
    throw new Error('ENCRYPTION_KEY must be 64-character hex string');
  }

  const keyBuffer = Buffer.from(key, 'hex');

  const salt = encrypted.subarray(0, SALT_LENGTH);
  const iv = encrypted.subarray(SALT_LENGTH, TAG_POSITION);
  const tag = encrypted.subarray(TAG_POSITION, ENCRYPTED_POSITION);
  const ciphertext = encrypted.subarray(ENCRYPTED_POSITION);

  const decipher = crypto.createDecipheriv(ALGORITHM, keyBuffer, iv);
  decipher.setAuthTag(tag);

  return decipher.update(ciphertext) as string + decipher.final('utf8');
}
