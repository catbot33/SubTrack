import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';
import type { GmailTokens } from './extractor/types.ts';

function getEncryptionKey(): Buffer {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET is required to secure Gmail credentials.');
  }
  return createHash('sha256').update(secret).digest();
}

export function sealGmailTokens(tokens: GmailTokens): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', getEncryptionKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(tokens), 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return [iv, authTag, encrypted].map((part) => part.toString('base64url')).join('.');
}

export function openGmailTokens(value?: string): GmailTokens | null {
  if (!value) return null;

  try {
    const [ivValue, tagValue, encryptedValue] = value.split('.');
    if (!ivValue || !tagValue || !encryptedValue) return null;

    const decipher = createDecipheriv(
      'aes-256-gcm',
      getEncryptionKey(),
      Buffer.from(ivValue, 'base64url'),
    );
    decipher.setAuthTag(Buffer.from(tagValue, 'base64url'));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(encryptedValue, 'base64url')),
      decipher.final(),
    ]);

    return JSON.parse(decrypted.toString('utf8')) as GmailTokens;
  } catch {
    return null;
  }
}
