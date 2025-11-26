import { authenticator } from 'otplib';
import { settings } from '../config/settings.js';
import { encryptSecret, decryptSecret } from '../utils/secretStorage.js';

authenticator.options = {
  window: 1
};

const resolveIssuer = (providedIssuer) => providedIssuer ?? settings.mfaIssuer ?? 'Plantelligence';

export const createTotpSetup = ({ email, issuer }) => {
  const secret = authenticator.generateSecret();
  const resolvedIssuer = resolveIssuer(issuer);
  const accountName = email;
  const uri = authenticator.keyuri(accountName, resolvedIssuer, secret);
  const encryptedSecret = encryptSecret(secret);

  return {
    secret,
    uri,
    issuer: resolvedIssuer,
    accountName,
    encryptedSecret,
    debugCode: settings.mfaDebugMode ? authenticator.generate(secret) : null
  };
};

export const recreateTotpSetup = ({ email, stored }) => {
  if (!stored?.encryptedSecret) {
    return null;
  }

  const secret = decryptSecret(stored.encryptedSecret);
  const resolvedIssuer = resolveIssuer(stored.issuer);
  const accountName = stored.accountName ?? email;
  const uri = authenticator.keyuri(accountName, resolvedIssuer, secret);

  return {
    secret,
    uri,
    issuer: resolvedIssuer,
    accountName,
    encryptedSecret: stored.encryptedSecret,
    debugCode: settings.mfaDebugMode ? authenticator.generate(secret) : null
  };
};

export const verifyTotpCode = ({ token, secret }) => {
  if (!token || !secret) {
    return false;
  }

  const sanitizedToken = String(token).trim();
  if (sanitizedToken.length === 0) {
    return false;
  }

  return authenticator.check(sanitizedToken, secret);
};

export const verifyTotpCodeWithEncryptedSecret = ({ token, encryptedSecret }) => {
  if (!encryptedSecret) {
    return false;
  }

  const secret = decryptSecret(encryptedSecret);
  return verifyTotpCode({ token, secret });
};
