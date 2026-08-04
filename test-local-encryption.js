// Test local encryption/decryption to understand the format
const crypto = require('crypto');

// Simulate the encryptPII function
function encryptPII(plaintext) {
  const ALGORITHM = 'aes-256-gcm';
  const IV_LENGTH = 16;
  const TAG_LENGTH = 16;

  // For testing, generate a test key
  const key = crypto.randomBytes(32);
  const iv = crypto.randomBytes(IV_LENGTH);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  const encryptedBuffer = Buffer.concat([iv, tag, ciphertext]);
  return encryptedBuffer.toString('hex');
}

// Test how PostgreSQL bytea gets serialized to JSON
console.log('=== Testing PostgreSQL bytea JSON serialization ===');

const testData = 'Test Customer Name';
const hexEncrypted = encryptPII(testData);

console.log('Original hex encrypted:', hexEncrypted);
console.log('Hex length:', hexEncrypted.length);

// Simulate what happens when bytea is stored and retrieved via row_to_json
const buffer = Buffer.from(hexEncrypted, 'hex');
console.log('Buffer length:', buffer.length);

// PostgreSQL bytea in JSON typically comes as base64
const base64FromBytea = buffer.toString('base64');
console.log('Base64 representation:', base64FromBytea);

// Test conversion back
const convertedToHex = Buffer.from(base64FromBytea, 'base64').toString('hex');
console.log('Converted back to hex:', convertedToHex);
console.log('Matches original?', hexEncrypted === convertedToHex);