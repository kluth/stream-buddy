import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';

/**
 * Encryption Utility Module
 *
 * This module provides secure AES-256-CBC encryption and decryption functionality.
 *
 * SECURITY REQUIREMENTS:
 * - The ENCRYPTION_SECRET_KEY environment variable MUST be set in production
 * - The secret key should be at least 32 characters (256 bits) of cryptographically random data
 * - Generate a secure key using: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
 * - Store the key securely (e.g., AWS Secrets Manager, HashiCorp Vault, etc.)
 * - NEVER commit the actual key to version control
 *
 * IMPLEMENTATION NOTES:
 * - Uses AES-256-CBC with a unique random IV per encryption
 * - Uses scrypt for key derivation with a cryptographically random salt per encryption
 * - Salt and IV are prepended to the ciphertext (both are safe to store alongside encrypted data)
 */

const ALGORITHM = 'aes-256-cbc';
const IV_LENGTH = 16; // AES block size (always 16 bytes)
const SALT_LENGTH = 32; // Length of random salt for key derivation
const KEY_LENGTH = 32; // AES-256 requires 32-byte key
const SCRYPT_COST = 16384; // scrypt N parameter (2^14) - increase for more security

/**
 * Validates that the required encryption secret key environment variable is set.
 * This function will throw an error if the key is missing or too short.
 *
 * @throws Error if ENCRYPTION_SECRET_KEY is not set or is too short
 */
function getSecretKey(): string {
  const secretKey = process.env.ENCRYPTION_SECRET_KEY;

  if (!secretKey) {
    throw new Error(
      'CRITICAL SECURITY ERROR: ENCRYPTION_SECRET_KEY environment variable is not set. ' +
        'This application cannot safely encrypt data without a secret key. ' +
        'Generate a secure key using: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
    );
  }

  // Validate minimum key length (at least 32 characters for adequate entropy)
  const MIN_KEY_LENGTH = 32;
  if (secretKey.length < MIN_KEY_LENGTH) {
    throw new Error(
      `CRITICAL SECURITY ERROR: ENCRYPTION_SECRET_KEY is too short (${secretKey.length} chars). ` +
        `Minimum length is ${MIN_KEY_LENGTH} characters. ` +
        'Generate a secure key using: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
    );
  }

  return secretKey;
}

/**
 * Derives a cryptographic key from the secret key using scrypt with a random salt.
 * scrypt is a memory-hard key derivation function that is resistant to brute-force attacks.
 *
 * @param secretKey The master secret key from environment
 * @param salt Random salt for this specific encryption
 * @returns A 32-byte derived key suitable for AES-256
 */
function deriveKey(secretKey: string, salt: Buffer): Buffer {
  return scryptSync(secretKey, salt, KEY_LENGTH, { N: SCRYPT_COST });
}

/**
 * Encrypts a plaintext string using AES-256-CBC with a unique IV and salt.
 *
 * Output format: salt:iv:encryptedData (all in hex)
 * - salt: 32 bytes of random data used for key derivation
 * - iv: 16 bytes of random data for the cipher
 * - encryptedData: The AES-256-CBC encrypted ciphertext
 *
 * @param text The plaintext string to encrypt
 * @returns The encrypted string in format "salt:iv:ciphertext" (hex encoded)
 * @throws Error if encryption fails or secret key is not configured
 */
export function encrypt(text: string): string {
  // Validate input
  if (text === undefined || text === null) {
    throw new Error('Cannot encrypt undefined or null value');
  }

  // Get and validate the secret key
  const secretKey = getSecretKey();

  // Generate a cryptographically random salt for this encryption
  const salt = randomBytes(SALT_LENGTH);

  // Derive a unique key using scrypt with the random salt
  const key = deriveKey(secretKey, salt);

  // Generate a cryptographically random IV for this encryption
  const iv = randomBytes(IV_LENGTH);

  // Perform AES-256-CBC encryption
  const cipher = createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  // Return salt:iv:encrypted (all components needed for decryption)
  return salt.toString('hex') + ':' + iv.toString('hex') + ':' + encrypted;
}

/**
 * Decrypts an encrypted string that was encrypted with the encrypt() function.
 *
 * Expected input format: salt:iv:encryptedData (all in hex)
 *
 * @param text The encrypted string (format: "salt:iv:ciphertext")
 * @returns The decrypted plaintext string
 * @throws Error if decryption fails, format is invalid, or secret key is not configured
 */
export function decrypt(text: string): string {
  // Validate input
  if (!text || typeof text !== 'string') {
    throw new Error('Invalid encrypted text: must be a non-empty string');
  }

  const parts = text.split(':');

  // Support both old format (iv:encrypted) and new format (salt:iv:encrypted)
  // This allows for backward compatibility during migration
  if (parts.length === 2) {
    // Legacy format: iv:encrypted (using static salt - DEPRECATED)
    console.warn(
      'WARNING: Decrypting data in legacy format (without per-encryption salt). ' +
        'Re-encrypt this data to use the more secure format.'
    );
    return decryptLegacy(text);
  }

  if (parts.length !== 3) {
    throw new Error(
      'Invalid encrypted text format. Expected format: "salt:iv:ciphertext" or legacy "iv:ciphertext"'
    );
  }

  // Get and validate the secret key
  const secretKey = getSecretKey();

  // Parse the components
  const salt = Buffer.from(parts[0], 'hex');
  const iv = Buffer.from(parts[1], 'hex');
  const encryptedText = parts[2];

  // Validate component lengths
  if (salt.length !== SALT_LENGTH) {
    throw new Error(`Invalid salt length: expected ${SALT_LENGTH}, got ${salt.length}`);
  }
  if (iv.length !== IV_LENGTH) {
    throw new Error(`Invalid IV length: expected ${IV_LENGTH}, got ${iv.length}`);
  }

  // Derive the same key using the stored salt
  const key = deriveKey(secretKey, salt);

  // Perform AES-256-CBC decryption
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

/**
 * LEGACY DECRYPTION - For backward compatibility only.
 * This function handles data encrypted with the old format that used a static salt.
 *
 * @deprecated This format is less secure. Re-encrypt data to use the new format.
 * @param text The encrypted string in legacy format (iv:ciphertext)
 * @returns The decrypted plaintext string
 */
function decryptLegacy(text: string): string {
  const secretKey = getSecretKey();

  const textParts = text.split(':');
  if (textParts.length !== 2) {
    throw new Error('Invalid legacy encrypted text format');
  }

  const iv = Buffer.from(textParts[0], 'hex');
  const encryptedText = textParts[1];

  // Legacy: Use static salt (this is the old behavior being phased out)
  // The static salt 'salt' was used in the original implementation
  const key = scryptSync(secretKey, 'salt', KEY_LENGTH);

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

/**
 * Validates that the encryption system is properly configured.
 * Call this during application startup to fail fast if misconfigured.
 *
 * @throws Error if the encryption system is not properly configured
 */
export function validateEncryptionConfig(): void {
  try {
    getSecretKey();
    // Test that encryption/decryption works
    const testData = 'encryption-test-' + Date.now();
    const encrypted = encrypt(testData);
    const decrypted = decrypt(encrypted);
    if (decrypted !== testData) {
      throw new Error('Encryption self-test failed: decrypted data does not match original');
    }
  } catch (error) {
    throw new Error(`Encryption configuration validation failed: ${(error as Error).message}`);
  }
}
