import crypto from 'crypto';
import { settings } from '../config/settings.js';

const ALGORITHM = 'aes-256-gcm';
const TAG_LENGTH = 16;
const IV_LENGTH = 12;

const getKey = () => {
  if (!settings.mfaTotpEncryptionKey || settings.mfaTotpEncryptionKey.length !== 32) {
    throw new Error('MFA TOTP encryption key is not properly configured.');
  }
  return settings.mfaTotpEncryptionKey;
};

export const encryptSecret = (plaintext) => {
  if (typeof plaintext !== 'string' || plaintext.length === 0) {
    throw new Error('Secret encryption requires a non-empty string.');
  }

  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, { authTagLength: TAG_LENGTH });
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return {
    iv: iv.toString('base64'),
    data: ciphertext.toString('base64'),
    tag: authTag.toString('base64')
  };
};

export const decryptSecret = (payload) => {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Invalid secret payload provided for decryption.');
  }

  const { iv, data, tag } = payload;

  if (!iv || !data || !tag) {
    throw new Error('Secret payload missing required fields.');
  }

  const key = getKey();
  const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(iv, 'base64'), {
    authTagLength: TAG_LENGTH
  });
  decipher.setAuthTag(Buffer.from(tag, 'base64'));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(data, 'base64')),
    decipher.final()
  ]);

  return decrypted.toString('utf8');
};
