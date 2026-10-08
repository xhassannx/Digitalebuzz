import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const SALT_LENGTH = 64;
const TAG_LENGTH = 16;
const KEY_LENGTH = 32;

function getEncryptionKey(): string {
  const secret = process.env.SESSION_SECRET || process.env.ENCRYPTION_KEY;
  if (!secret) {
    throw new Error('SESSION_SECRET or ENCRYPTION_KEY must be set for credential encryption');
  }
  return secret;
}

function deriveKey(password: string, salt: Buffer): Buffer {
  return crypto.pbkdf2Sync(password, salt, 100000, KEY_LENGTH, 'sha512');
}

export function encrypt(text: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const salt = crypto.randomBytes(SALT_LENGTH);
  
  const key = deriveKey(getEncryptionKey(), salt);
  
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  
  const result = Buffer.concat([salt, iv, tag, encrypted]);
  return result.toString('base64');
}

export function decrypt(encryptedData: string): string {
  const buffer = Buffer.from(encryptedData, 'base64');
  
  const salt = buffer.subarray(0, SALT_LENGTH);
  const iv = buffer.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
  const tag = buffer.subarray(SALT_LENGTH + IV_LENGTH, SALT_LENGTH + IV_LENGTH + TAG_LENGTH);
  const encrypted = buffer.subarray(SALT_LENGTH + IV_LENGTH + TAG_LENGTH);
  
  const key = deriveKey(getEncryptionKey(), salt);
  
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted.toString('utf8');
}

export function encryptCredentials(credentials: any): any {
  if (!credentials) return null;
  
  const encrypted: any = {};
  for (const [key, value] of Object.entries(credentials)) {
    if (value && typeof value === 'string') {
      encrypted[key] = encrypt(value);
    } else if (value) {
      encrypted[key] = value;
    }
  }
  return encrypted;
}

export function decryptCredentials(encryptedCredentials: any): any {
  if (!encryptedCredentials) return null;
  
  const decrypted: any = {};
  for (const [key, value] of Object.entries(encryptedCredentials)) {
    if (value && typeof value === 'string') {
      try {
        decrypted[key] = decrypt(value);
      } catch (err) {
        decrypted[key] = value;
      }
    } else if (value) {
      decrypted[key] = value;
    }
  }
  return decrypted;
}
