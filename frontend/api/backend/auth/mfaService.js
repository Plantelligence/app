import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { database } from '../services/database.js';
import { hashToken } from './tokenService.js';
import { logSecurityEvent } from '../logs/logger.js';

const MFA_TTL_SECONDS = 300;
const MAX_ATTEMPTS = 5;

const createError = (message, statusCode = 400) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

export const createMfaChallenge = async ({ userId, metadata = {} }) => {
  await database.remove('mfa_challenges', {
    filters: [{ field: 'user_id', value: userId }]
  });

  const code = crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');
  const challengeId = uuidv4();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + MFA_TTL_SECONDS * 1000).toISOString();

  await database.run('mfa_challenges', {
    id: challengeId,
    data: {
      user_id: userId,
      code_hash: hashToken(code),
      expires_at: expiresAt,
      attempts: 0,
      created_at: now.toISOString(),
      metadata
    }
  });

  return { challengeId, code, expiresAt };
};

export const verifyMfaChallenge = async ({ challengeId, code, ipAddress }) => {
  const challenge = await database.get('mfa_challenges', { id: challengeId });

  if (!challenge) {
    await logSecurityEvent({
      action: 'mfa_challenge_missing',
      metadata: { challengeId },
      ipAddress
    });
    throw createError('Desafio MFA inválido ou expirado.', 404);
  }

  if (new Date(challenge.expires_at).getTime() <= Date.now()) {
    await database.remove('mfa_challenges', { id: challengeId });
    await logSecurityEvent({
      userId: challenge.user_id,
      action: 'mfa_code_expired',
      metadata: { challengeId },
      ipAddress
    });
    throw createError('Código MFA expirado. Gere um novo código.', 401);
  }

  if (challenge.attempts >= MAX_ATTEMPTS) {
    await logSecurityEvent({
      userId: challenge.user_id,
      action: 'mfa_challenge_locked',
      metadata: { challengeId, attempts: challenge.attempts },
      ipAddress
    });
    throw createError('Código MFA bloqueado por tentativas inválidas.', 423);
  }

  const providedHash = hashToken(code);

  if (providedHash !== challenge.code_hash) {
    const updatedAttempts = (challenge.attempts ?? 0) + 1;
    await database.run('mfa_challenges', {
      id: challengeId,
      data: { attempts: updatedAttempts },
      merge: true
    });
    await logSecurityEvent({
      userId: challenge.user_id,
      action: 'mfa_code_invalid',
      metadata: { challengeId, attempts: updatedAttempts },
      ipAddress
    });
    throw createError('Código MFA inválido.', 401);
  }

  await database.remove('mfa_challenges', { id: challengeId });

  const user = await database.get('users', { id: challenge.user_id });

  if (!user) {
    throw createError('Usuário associado ao desafio não encontrado.', 404);
  }

  return {
    user,
    metadata: challenge.metadata ?? {},
    challenge
  };
};
