import crypto from 'crypto';
import { Timestamp } from 'firebase-admin/firestore';
import { v4 as uuid } from 'uuid';
import { database } from '../services/database.js';
import { hashToken } from './tokenService.js';
import { logSecurityEvent } from '../logs/logger.js';
import { sendMfaCodeEmail } from '../services/emailService.js';
import { settings } from '../config/settings.js';

const MFA_TTL_SECONDS = 300;
const MAX_ATTEMPTS = 5;
const COLLECTION = 'mfa_challenges';

const createError = (message, statusCode = 400) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

export const createMfaChallenge = async ({ user, metadata = {} }) => {
  if (!user?.id || !user?.email) {
    throw createError('Dados do usuário inválidos para MFA.');
  }

  await database.deleteWhere(COLLECTION, (collectionRef) =>
    collectionRef.where('userId', '==', user.id)
  );

  const code = crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');
  const challengeId = uuid();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + MFA_TTL_SECONDS * 1000);

  await database.setDocument(COLLECTION, challengeId, {
    id: challengeId,
    userId: user.id,
    codeHash: hashToken(code),
    expiresAt: expiresAt.toISOString(),
    expiresAtTs: Timestamp.fromDate(expiresAt),
    attempts: 0,
    createdAt: now.toISOString(),
    createdAtTs: Timestamp.fromDate(now),
    metadata
  });

  try {
    await sendMfaCodeEmail({
      to: user.email,
      code,
      expiresAt: expiresAt.toISOString()
    });
  } catch (error) {
    await logSecurityEvent({
      userId: user.id,
      action: 'mfa_delivery_failed',
      metadata: { reason: error.message }
    });
    throw createError('Não foi possível enviar o código MFA. Tente novamente em instantes.', 503);
  }

  await logSecurityEvent({
    userId: user.id,
    action: 'mfa_code_sent',
    metadata: { delivery: 'email' }
  });

  return {
    challengeId,
    expiresAt: expiresAt.toISOString(),
    debugCode: settings.mfaDebugMode ? code : null
  };
};

export const verifyMfaChallenge = async ({ challengeId, code, ipAddress }) => {
  const challenge = await database.getById(COLLECTION, challengeId);

  if (!challenge) {
    await logSecurityEvent({
      action: 'mfa_challenge_missing',
      metadata: { challengeId },
      ipAddress
    });
    throw createError('Desafio MFA inválido ou expirado.', 404);
  }

  const expiresAtDate = challenge.expiresAtTs
    ? challenge.expiresAtTs.toDate()
    : new Date(challenge.expiresAt);

  if (expiresAtDate.getTime() <= Date.now()) {
    await database.deleteDocument(COLLECTION, challengeId);
    await logSecurityEvent({
      userId: challenge.userId,
      action: 'mfa_code_expired',
      metadata: { challengeId },
      ipAddress
    });
    throw createError('Código MFA expirado. Gere um novo código.', 401);
  }

  if (challenge.attempts >= MAX_ATTEMPTS) {
    await logSecurityEvent({
      userId: challenge.userId,
      action: 'mfa_challenge_locked',
      metadata: { challengeId, attempts: challenge.attempts },
      ipAddress
    });
    throw createError('Código MFA bloqueado por tentativas inválidas.', 423);
  }

  const providedHash = hashToken(code);

  if (providedHash !== challenge.codeHash) {
    const updatedAttempts = challenge.attempts + 1;
    const updatedAt = new Date();

    await database.updateDocument(COLLECTION, challengeId, {
      attempts: updatedAttempts,
      updatedAt: updatedAt.toISOString(),
      updatedAtTs: Timestamp.fromDate(updatedAt)
    });

    await logSecurityEvent({
      userId: challenge.userId,
      action: 'mfa_code_invalid',
      metadata: { challengeId, attempts: updatedAttempts },
      ipAddress
    });

    throw createError('Código MFA inválido.', 401);
  }

  await database.deleteDocument(COLLECTION, challengeId);

  return {
    userId: challenge.userId,
    metadata: challenge.metadata ?? {},
    challenge: {
      id: challenge.id,
      expiresAt: challenge.expiresAt
    }
  };
};
