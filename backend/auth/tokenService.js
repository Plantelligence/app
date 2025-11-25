import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { database } from '../services/database.js';
import { settings } from '../config/settings.js';
import { logSecurityEvent } from '../logs/logger.js';

export const hashToken = (token) =>
  crypto.createHash('sha256').update(token).digest('hex');

export const generateAccessToken = async (user) => {
  const jti = crypto.randomUUID();
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
  const jti = crypto.randomUUID();
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

  await database.run(
    `INSERT INTO tokens (id, user_id, token_hash, jti, type, expires_at, revoked, created_at)
     VALUES (?, ?, ?, ?, 'refresh', ?, 0, ?)`
      ,
    [
      crypto.randomUUID(),
      user.id,
      hashToken(token),
      jti,
      expiresAt.toISOString(),
      new Date().toISOString()
    ]
  );

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

  const revoked = await database.get(
    `SELECT id FROM tokens WHERE jti = ? AND type = 'access_revocation' LIMIT 1`,
    [payload.jti]
  );

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
  const record = await database.get(
    `SELECT id, revoked, expires_at as expiresAt FROM tokens WHERE token_hash = ? AND type = 'refresh' LIMIT 1`,
    [hashedToken]
  );

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

  await database.run(
    `UPDATE tokens SET revoked = 1 WHERE token_hash = ? AND type = 'refresh'`,
    [hashedToken]
  );
};

export const revokeAccessTokenByJti = async (jti, userId, expiresAtIso) => {
  await database.run(
    `INSERT INTO tokens (id, user_id, jti, type, expires_at, revoked, created_at)
     VALUES (?, ?, ?, 'access_revocation', ?, 1, ?)`
      ,
    [
      crypto.randomUUID(),
      userId,
      jti,
      expiresAtIso,
      new Date().toISOString()
    ]
  );

  await logSecurityEvent({
    userId,
    action: 'access_token_revoked',
    metadata: { jti, expiresAt: expiresAtIso }
  });
};

export const cleanupExpiredTokens = async () => {
  await database.run(`DELETE FROM tokens WHERE datetime(expires_at) <= datetime('now')`);
  await database.run(`DELETE FROM mfa_challenges WHERE datetime(expires_at) <= datetime('now')`);
};

export const issueSessionTokens = async (user) => {
  const access = await generateAccessToken(user);
  const refresh = await generateRefreshToken(user);

  return { access, refresh };
};
