import crypto from 'crypto';
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
  await database.run(`DELETE FROM mfa_challenges WHERE user_id = ?`, [userId]);

  const code = crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');
  const challengeId = crypto.randomUUID();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + MFA_TTL_SECONDS * 1000).toISOString();

  await database.run(
    `INSERT INTO mfa_challenges (id, user_id, code_hash, expires_at, attempts, created_at, metadata)
     VALUES (?, ?, ?, ?, 0, ?, ?)`
      ,
    [
      challengeId,
      userId,
      hashToken(code),
      expiresAt,
      now.toISOString(),
      JSON.stringify(metadata)
    ]
  );

  return { challengeId, code, expiresAt };
};

export const verifyMfaChallenge = async ({ challengeId, code, ipAddress }) => {
  const challenge = await database.get(
    `SELECT * FROM mfa_challenges WHERE id = ? LIMIT 1`,
    [challengeId]
  );

  if (!challenge) {
    await logSecurityEvent({
      action: 'mfa_challenge_missing',
      metadata: { challengeId },
      ipAddress
    });
    throw createError('Desafio MFA inválido ou expirado.', 404);
  }

  if (new Date(challenge.expires_at).getTime() <= Date.now()) {
    await database.run(`DELETE FROM mfa_challenges WHERE id = ?`, [challengeId]);
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
    await database.run(
      `UPDATE mfa_challenges SET attempts = attempts + 1 WHERE id = ?`,
      [challengeId]
    );
    await logSecurityEvent({
      userId: challenge.user_id,
      action: 'mfa_code_invalid',
      metadata: { challengeId, attempts: challenge.attempts + 1 },
      ipAddress
    });
    throw createError('Código MFA inválido.', 401);
  }

  await database.run(`DELETE FROM mfa_challenges WHERE id = ?`, [challengeId]);

  const user = await database.get(`SELECT * FROM users WHERE id = ? LIMIT 1`, [challenge.user_id]);

  if (!user) {
    throw createError('Usuário associado ao desafio não encontrado.', 404);
  }

  return {
    user,
    metadata: challenge.metadata ? JSON.parse(challenge.metadata) : {},
    challenge
  };
};
