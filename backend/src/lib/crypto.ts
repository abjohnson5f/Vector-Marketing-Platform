import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { env } from '../config/env.js';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

function getEncryptionKey(): Buffer {
  const key = env.ENCRYPTION_KEY;
  if (!key) {
    throw new Error('ENCRYPTION_KEY is not configured');
  }
  return Buffer.from(key, 'base64');
}

/**
 * Encrypts a string using AES-256-GCM
 * Returns base64 encoded string: iv:authTag:ciphertext
 */
export function encrypt(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);
  
  const cipher = createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(plaintext, 'utf8', 'base64');
  encrypted += cipher.final('base64');
  
  const authTag = cipher.getAuthTag();
  
  return `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted}`;
}

/**
 * Decrypts a string encrypted with encrypt()
 */
export function decrypt(encrypted: string): string {
  const key = getEncryptionKey();
  const [ivBase64, authTagBase64, ciphertext] = encrypted.split(':');
  
  if (!ivBase64 || !authTagBase64 || !ciphertext) {
    throw new Error('Invalid encrypted data format');
  }
  
  const iv = Buffer.from(ivBase64, 'base64');
  const authTag = Buffer.from(authTagBase64, 'base64');
  
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(ciphertext, 'base64', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}

/**
 * Encrypts sensitive data for storage in database
 */
export function encryptToken(token: string): string {
  if (!env.ENCRYPTION_KEY) {
    // In development without encryption key, store as-is with prefix
    return `plain:${token}`;
  }
  return `enc:${encrypt(token)}`;
}

/**
 * Decrypts token from database
 */
export function decryptToken(stored: string): string {
  if (stored.startsWith('plain:')) {
    return stored.slice(6);
  }
  if (stored.startsWith('enc:')) {
    return decrypt(stored.slice(4));
  }
  // Legacy: assume encrypted without prefix
  return decrypt(stored);
}

