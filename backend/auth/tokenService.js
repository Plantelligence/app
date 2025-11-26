import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { Timestamp } from 'firebase-admin/firestore';
import { v4 as uuid } from 'uuid';
import { database } from '../services/database.js';
import { settings } from '../config/settings.js';
import { logSecurityEvent } from '../logs/logger.js';

const TOKENS_COLLECTION = 'tokens';

const isPasswordExpired = (passwordExpiresAt) => {
  if (!passwordExpiresAt) {
    return false;
  }

  return new Date(passwordExpiresAt).getTime() <= Date.now();
};

export const hashToken = (token) =>
  crypto.createHash('sha256').update(token).digest('hex');

export const generateAccessToken = async (user) => {
  const jti = uuid();
  const expiresAt = new Date(Date.now() + settings.accessTokenTtlSeconds * 1000);
  const payload = {
    sub: user.id,
    email: user.email,
    role: user.role,
    consent: Boolean(user.consentGiven),
    requiresPasswordReset: isPasswordExpired(user.passwordExpiresAt)
  };

  const token = jwt.sign(payload, settings.jwtSecret, {
    expiresIn: settings.accessTokenTtlSeconds,
    jwtid: jti,
    issuer: 'plantelligence-backend'
  });

  return { token, expiresAt, jti };
};

export const generateRefreshToken = async (user) => {
  const jti = uuid();
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

  const tokenId = uuid();
  const now = new Date();

  await database.setDocument(TOKENS_COLLECTION, tokenId, {
    id: tokenId,
    userId: user.id,
    tokenHash: hashToken(token),
    jti,
    type: 'refresh',
    expiresAt: expiresAt.toISOString(),
    expiresAtTs: Timestamp.fromDate(expiresAt),
    revoked: false,
    createdAt: now.toISOString(),
    createdAtTs: Timestamp.fromDate(now)
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

  if (payload.jti) {
    const revoked = await database.get(TOKENS_COLLECTION, (collectionRef) =>
      collectionRef
        .where('type', '==', 'access_revocation')
        .where('jti', '==', payload.jti)
        .limit(1)
    );

    if (revoked) {
      throw new jwt.JsonWebTokenError('Token has been revoked');
    }
  }

  return payload;
};

export const verifyRefreshToken = async (token) => {
  const payload = jwt.verify(token, settings.jwtRefreshSecret, {
    issuer: 'plantelligence-backend'
  });

  const hashedToken = hashToken(token);
  const record = await database.get(TOKENS_COLLECTION, (collectionRef) =>
    collectionRef
      .where('tokenHash', '==', hashedToken)
      .where('type', '==', 'refresh')
      .limit(1)
  );

  if (!record) {
    throw new jwt.JsonWebTokenError('Refresh token not recognized');
  }

  if (record.revoked) {
    throw new jwt.JsonWebTokenError('Refresh token revoked');
  }

  const expiresAtDate = record.expiresAtTs
    ? record.expiresAtTs.toDate()
    : new Date(record.expiresAt);

  if (expiresAtDate.getTime() <= Date.now()) {
    throw new jwt.JsonWebTokenError('Refresh token expired');
  }

  return payload;
};

export const revokeRefreshToken = async (token) => {
  const hashedToken = hashToken(token);
  const record = await database.get(TOKENS_COLLECTION, (collectionRef) =>
    collectionRef
      .where('tokenHash', '==', hashedToken)
      .where('type', '==', 'refresh')
      .limit(1)
  );

  if (!record) {
    return;
  }

  const now = new Date();

  await database.updateDocument(TOKENS_COLLECTION, record.id, {
    revoked: true,
    revokedAt: now.toISOString(),
    revokedAtTs: Timestamp.fromDate(now)
  });
};

export const revokeAccessTokenByJti = async (jti, userId, expiresAtIso) => {
  const tokenId = uuid();
  const createdAt = new Date();
  const expiresAtDate = new Date(expiresAtIso);

  await database.setDocument(TOKENS_COLLECTION, tokenId, {
    id: tokenId,
    userId,
    jti,
    type: 'access_revocation',
    expiresAt: expiresAtIso,
    expiresAtTs: Timestamp.fromDate(expiresAtDate),
    revoked: true,
    createdAt: createdAt.toISOString(),
    createdAtTs: Timestamp.fromDate(createdAt)
  });

  await logSecurityEvent({
    userId,
    action: 'access_token_revoked',
    metadata: { jti, expiresAt: expiresAtIso }
  });
};

export const cleanupExpiredTokens = async () => {
  const cutoff = Timestamp.now();

  await database.deleteWhere(TOKENS_COLLECTION, (collectionRef) =>
    collectionRef.where('expiresAtTs', '<=', cutoff)
  );

  await database.deleteWhere('mfa_challenges', (collectionRef) =>
    collectionRef.where('expiresAtTs', '<=', cutoff)
  );
};

export const issueSessionTokens = async (user) => {
  const access = await generateAccessToken(user);
  const refresh = await generateRefreshToken(user);

  return { access, refresh };
};
