import crypto from 'crypto';

// Encryption error interface for better error handling
export interface CryptoError extends Error {
  code: 'KEY_ERROR' | 'ENCRYPTION_ERROR' | 'DECRYPTION_ERROR' | 'VALIDATION_ERROR';
  mobileMessage: string;
}

class CryptoErrorImpl extends Error implements CryptoError {
  code: CryptoError['code'];
  mobileMessage: string;

  constructor(code: CryptoError['code'], message: string, mobileMessage: string) {
    super(message);
    this.name = 'CryptoError';
    this.code = code;
    this.mobileMessage = mobileMessage;
  }
}

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
 * @throws {CryptoError} If ENCRYPTION_KEY is not configured or is invalid
 * @returns Buffer containing the 32-byte encryption key
 */
function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;
  if (!key || key.length !== 64 || !/^[0-9a-f]{64}$/.test(key)) {
    throw new CryptoErrorImpl(
      'KEY_ERROR',
      'ENCRYPTION_KEY must be 64-character hex string',
      'Encryption system error - please contact support'
    );
  }
  return Buffer.from(key, 'hex');
}

/**
 * Encrypt sensitive PII data
 * @param plaintext - Data to encrypt
 * @returns Encrypted data as hex string (for proper bytea storage with Neon)
 * @throws {CryptoError} If encryption fails
 */
export function encryptPII(plaintext: string): string {
  try {
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
  } catch (error) {
    if (error instanceof CryptoErrorImpl) {
      throw error;
    }
    throw new CryptoErrorImpl(
      'ENCRYPTION_ERROR',
      `Encryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      'Data protection error - please try again'
    );
  }
}

/**
 * Decrypt sensitive PII data
 * @param encrypted - Hex string or Buffer containing iv + tag + ciphertext
 * @returns Decrypted plaintext, or mobile-friendly fallback if decryption fails
 */
export function decryptPII(encrypted: string | Buffer): string {
  try {
    const keyBuffer = getEncryptionKey();

    // Convert hex string to Buffer if needed
    let encryptedBuffer: Buffer;
    if (typeof encrypted === 'string') {
      encryptedBuffer = Buffer.from(encrypted, 'hex');
    } else if (Buffer.isBuffer(encrypted)) {
      encryptedBuffer = encrypted;
    } else {
      throw new CryptoErrorImpl(
        'VALIDATION_ERROR',
        'Encrypted data must be a hex string or Buffer',
        'Data format error'
      );
    }

    if (encryptedBuffer.length < ENCRYPTED_POSITION) {
      // Return mobile-friendly fallback for corrupted/incomplete encrypted data
      console.warn('Encrypted data too short, returning fallback value');
      return '[Protected Data]';
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
      // Return mobile-friendly fallback for corrupted data
      console.warn('Decryption failed, returning fallback value:', error instanceof Error ? error.message : 'Unknown error');
      return '[Protected Data]';
    }
  } catch (error) {
    if (error instanceof CryptoErrorImpl) {
      throw error;
    }
    // For any other errors, return mobile-friendly fallback
    console.warn('Decryption process error:', error instanceof Error ? error.message : 'Unknown error');
    return '[Protected Data]';
  }
}
