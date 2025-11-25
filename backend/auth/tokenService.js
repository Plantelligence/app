import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import jwt from 'jsonwebtoken';
import { database } from '../services/database.js';
import { settings } from '../config/settings.js';
import { logSecurityEvent } from '../logs/logger.js';

export const hashToken = (token) =>
  crypto.createHash('sha256').update(token).digest('hex');

export const generateAccessToken = async (user) => {
  const jti = uuidv4();
  const expiresAt = new Date(Date.now() + settings.accessTokenTtlSeconds * 1000);
  const payload = {
    sub: user.id,
    email: user.email,
    role: user.role,
    consent: Boolean(user.consent_given),
    requiresPasswordReset:
      user.password_expires_at !== null &&
      new Date(user.password_expires_at).getTime() <= Date.now()
  };

  const token = jwt.sign(payload, settings.jwtSecret, {
    expiresIn: settings.accessTokenTtlSeconds,
    jwtid: jti,
    issuer: 'plantelligence-backend'
  });

  return { token, expiresAt, jti };
};

export const generateRefreshToken = async (user) => {
  const jti = uuidv4();
  const expiresAt = new Date(Date.now() + settings.refreshTokenTtlSeconds * 1000);
  const payload = {
    sub: user.id,
    type: 'refresh'
  };

  const token = jwt.sign(payload, settings.jwtRefreshSecret, {
    expiresIn: settings.refreshTokenTtlSeconds,
    jwtid: jti,
    issuer: 'plantelligence-backend'
  });

  await database.run('tokens', {
    id: uuidv4(),
    data: {
      user_id: user.id,
      token_hash: hashToken(token),
      jti,
      type: 'refresh',
      expires_at: expiresAt.toISOString(),
      revoked: false,
      created_at: new Date().toISOString()
    }
  });

  await logSecurityEvent({
    userId: user.id,
    action: 'refresh_token_issued',
    metadata: { jti, expiresAt: expiresAt.toISOString() }
  });

  return { token, expiresAt, jti };
};

export const verifyAccessToken = async (token) => {
  const payload = jwt.verify(token, settings.jwtSecret, {
    issuer: 'plantelligence-backend'
  });

  const revoked = await database.get('tokens', {
    filters: [
      { field: 'jti', value: payload.jti },
      { field: 'type', value: 'access_revocation' }
    ]
  });

  if (revoked) {
    throw new jwt.JsonWebTokenError('Token has been revoked');
  }

  return payload;
};

export const verifyRefreshToken = async (token) => {
  const payload = jwt.verify(token, settings.jwtRefreshSecret, {
    issuer: 'plantelligence-backend'
  });

  const hashedToken = hashToken(token);
  const record = await database.get('tokens', {
    filters: [
      { field: 'token_hash', value: hashedToken },
      { field: 'type', value: 'refresh' }
    ]
  });

  if (!record) {
    throw new jwt.JsonWebTokenError('Refresh token not recognized');
  }

  if (record.revoked) {
    throw new jwt.JsonWebTokenError('Refresh token revoked');
  }

  if (new Date(record.expiresAt).getTime() <= Date.now()) {
    throw new jwt.JsonWebTokenError('Refresh token expired');
  }

  return payload;
};

export const revokeRefreshToken = async (token) => {
  const hashedToken = hashToken(token);

  const record = await database.get('tokens', {
    filters: [
      { field: 'token_hash', value: hashedToken },
      { field: 'type', value: 'refresh' }
    ]
  });

  if (!record) {
    return;
  }

  await database.run('tokens', {
    id: record.id,
    data: { revoked: true, updated_at: new Date().toISOString() },
    merge: true
  });
};

export const revokeAccessTokenByJti = async (jti, userId, expiresAtIso) => {
  await database.run('tokens', {
    id: uuidv4(),
    data: {
      user_id: userId,
      jti,
      type: 'access_revocation',
      expires_at: expiresAtIso,
      revoked: true,
      created_at: new Date().toISOString()
    }
  });

  await logSecurityEvent({
    userId,
    action: 'access_token_revoked',
    metadata: { jti, expiresAt: expiresAtIso }
  });
};

export const cleanupExpiredTokens = async () => {
  const nowIso = new Date().toISOString();

  const expiredTokens = await database.all('tokens', {
    filters: [{ field: 'expires_at', operator: '<=', value: nowIso }]
  });

  for (const token of expiredTokens) {
    // eslint-disable-next-line no-await-in-loop
    await database.remove('tokens', { id: token.id });
  }

  const expiredChallenges = await database.all('mfa_challenges', {
    filters: [{ field: 'expires_at', operator: '<=', value: nowIso }]
  });

  for (const challenge of expiredChallenges) {
    // eslint-disable-next-line no-await-in-loop
    await database.remove('mfa_challenges', { id: challenge.id });
  }
};

export const issueSessionTokens = async (user) => {
  const access = await generateAccessToken(user);
  const refresh = await generateRefreshToken(user);

  return { access, refresh };
};
