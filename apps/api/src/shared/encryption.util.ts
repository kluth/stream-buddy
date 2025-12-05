import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';

// For demonstration purposes, the ENCRYPTION_KEY and IV should be securely managed
// and not hardcoded in a production environment.
// It should be loaded from environment variables or a secure key management system.
const ALGORITHM = 'aes-256-cbc';
const SECRET_KEY = process.env.ENCRYPTION_SECRET_KEY || 'supersecretkeyforencryption1234567890'; // 32 bytes
const IV_LENGTH = 16; // For AES, this is always 16 bytes

// Derive a consistent key from the SECRET_KEY for AES-256
const key = scryptSync(SECRET_KEY, 'salt', 32);

/**
 * Encrypts a plaintext string.
 * @param {string} text The plaintext string to encrypt.
 * @returns {string} The encrypted string in base64 format, prefixed with IV.
 */
export function encrypt(text: string): string {
  const iv = randomBytes(IV_LENGTH); // Generate a unique IV for each encryption
  const cipher = createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

/**
 * Decrypts an encrypted string.
 * @param {string} text The encrypted string (hex IV:hex encrypted data).
 * @returns {string} The decrypted plaintext string.
 */
export function decrypt(text: string): string {
  const textParts = text.split(':');
  if (textParts.length !== 2) {
    throw new Error('Invalid encrypted text format');
  }
  const iv = Buffer.from(textParts.shift()!, 'hex');
  const encryptedText = textParts.join(':');
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}
