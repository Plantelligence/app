import { encryptWithAes, decryptWithAes } from './aes.js';
import { encryptKeyWithRsa, decryptKeyWithRsa, getPublicKeyPem } from './rsa.js';

export const getCommunicationPublicKey = () => getPublicKeyPem();

export const simulateSecureMessage = (message) => {
  const { key, iv, authTag, ciphertext } = encryptWithAes(message);
  const encryptedKey = encryptKeyWithRsa(key);

  return {
    encryptedMessage: ciphertext.toString('base64'),
    encryptedKey: encryptedKey.toString('base64'),
    iv: iv.toString('base64'),
    authTag: authTag.toString('base64')
  };
};

export const verifySecureMessage = ({ encryptedMessage, encryptedKey, iv, authTag }) => {
  const decryptedKey = decryptKeyWithRsa(Buffer.from(encryptedKey, 'base64'));
  const plaintext = decryptWithAes({
    key: decryptedKey,
    iv: Buffer.from(iv, 'base64'),
    authTag: Buffer.from(authTag, 'base64'),
    ciphertext: Buffer.from(encryptedMessage, 'base64')
  });

  return plaintext;
};
