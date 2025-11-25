import crypto from 'crypto';
import { database } from '../services/database.js';
import { logSecurityEvent } from '../logs/logger.js';
import {
  hashPassword,
  verifyPassword,
  calculatePasswordExpiry,
  isPasswordExpired,
  validatePasswordComplexity,
  passwordRequirementsMessage
} from './passwordService.js';
import {
  issueSessionTokens,
  verifyRefreshToken,
  revokeRefreshToken,
  revokeAccessTokenByJti,
  hashToken
} from './tokenService.js';
import { settings } from '../config/settings.js';
import { createMfaChallenge, verifyMfaChallenge } from './mfaService.js';

const ensureMfaColumns = async () => {
  const columns = await database.all(`PRAGMA table_info(users)`);
  const columnNames = columns.map((column) => column.name);

  if (!columnNames.includes('mfa_enabled')) {
    try {
      await database.run(`ALTER TABLE users ADD COLUMN mfa_enabled INTEGER NOT NULL DEFAULT 0`);
    } catch (error) {
      if (!error.message?.includes('duplicate column name')) {
        throw error;
      }
    }
  }

  if (!columnNames.includes('mfa_configured_at')) {
    try {
      await database.run(`ALTER TABLE users ADD COLUMN mfa_configured_at TEXT`);
    } catch (error) {
      if (!error.message?.includes('duplicate column name')) {
        throw error;
      }
    }
  }
};

await ensureMfaColumns();

const sanitizeUser = (row) => ({
  id: row.id,
  email: row.email,
  role: row.role,
  fullName: row.full_name,
  phone: row.phone,
  consentGiven: Boolean(row.consent_given),
  consentTimestamp: row.consent_timestamp,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  lastLoginAt: row.last_login_at,
  passwordExpiresAt: row.password_expires_at,
  deletionRequested: Boolean(row.deletion_requested),
  mfaEnabled: Boolean(row.mfa_enabled),
  mfaConfiguredAt: row.mfa_configured_at
});

const findUserByEmail = (email) =>
  database.get(
    `SELECT * FROM users WHERE email = ? COLLATE NOCASE LIMIT 1`,
    [email.trim().toLowerCase()]
  );

export const registerUser = async ({
  email,
  password,
  fullName,
  phone,
  consent
}) => {
  const normalizedEmail = email.trim().toLowerCase();
  const existing = await findUserByEmail(normalizedEmail);

  if (existing) {
    throw new Error('E-mail já cadastrado.');
  }

  if (!validatePasswordComplexity(password)) {
    throw new Error(passwordRequirementsMessage);
  }

  const passwordHash = await hashPassword(password);
  const now = new Date().toISOString();
  const passwordExpiresAt = calculatePasswordExpiry();
  const consentGiven = Boolean(consent);
  const userCountRow = await database.get('SELECT COUNT(1) as total FROM users');
  const role = userCountRow?.total === 0 ? 'Admin' : 'User';

  await database.run(
    `INSERT INTO users (id, email, password_hash, role, full_name, phone, consent_given, consent_timestamp, created_at, updated_at, last_password_change, password_expires_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ,
    [
      crypto.randomUUID(),
      normalizedEmail,
      passwordHash,
      role,
      fullName?.trim() ?? null,
      phone?.trim() ?? null,
      consentGiven ? 1 : 0,
      consentGiven ? now : null,
      now,
      now,
      now,
      passwordExpiresAt
    ]
  );

  const user = await findUserByEmail(normalizedEmail);

  await logSecurityEvent({
    userId: user.id,
    action: 'user_registered',
    metadata: { role, consentGiven }
  });

  return sanitizeUser(user);
};

export const loginUser = async ({ email, password, ipAddress }) => {
  const normalizedEmail = email.trim().toLowerCase();
  const user = await findUserByEmail(normalizedEmail);

  if (!user) {
    await logSecurityEvent({
      action: 'login_failed',
      metadata: { reason: 'unknown_email', email: normalizedEmail },
      ipAddress
    });
    throw new Error('Credenciais inválidas.');
  }

  const passwordMatch = await verifyPassword(password, user.password_hash);

  if (!passwordMatch) {
    await logSecurityEvent({
      userId: user.id,
      action: 'login_failed',
      metadata: { reason: 'invalid_password' },
      ipAddress
    });
    throw new Error('Credenciais inválidas.');
  }

  const passwordExpired = isPasswordExpired(user.password_expires_at);

  const challenge = await createMfaChallenge({
    userId: user.id,
    metadata: { passwordExpired }
  });

  await logSecurityEvent({
    userId: user.id,
    action: 'mfa_challenge_issued',
    metadata: { challengeId: challenge.challengeId, expiresAt: challenge.expiresAt },
    ipAddress
  });

  return {
    mfaRequired: true,
    challengeId: challenge.challengeId,
    expiresAt: challenge.expiresAt,
    demoCode: challenge.code,
    passwordExpired
  };
};

export const completeMfa = async ({ challengeId, code, ipAddress }) => {
  const { user, metadata } = await verifyMfaChallenge({
    challengeId,
    code,
    ipAddress
  });

  const now = new Date().toISOString();

  await database.run(
    `UPDATE users SET last_login_at = ?, updated_at = ? WHERE id = ?`,
    [now, now, user.id]
  );

  const tokens = await issueSessionTokens(user);

  await logSecurityEvent({
    userId: user.id,
    action: 'mfa_verified',
    metadata: { challengeId },
    ipAddress
  });

  await logSecurityEvent({
    userId: user.id,
    action: 'login_success',
    metadata: { passwordExpired: metadata?.passwordExpired ?? false },
    ipAddress
  });

  const refreshedUser = await database.get(`SELECT * FROM users WHERE id = ? LIMIT 1`, [user.id]);

  return {
    user: sanitizeUser(refreshedUser),
    tokens,
    passwordExpired: metadata?.passwordExpired ?? false
  };
};

export const refreshSession = async ({ refreshToken }) => {
  const payload = await verifyRefreshToken(refreshToken);
  const user = await database.get(`SELECT * FROM users WHERE id = ? LIMIT 1`, [payload.sub]);

  if (!user) {
    throw new Error('Usuário não encontrado.');
  }

  const tokens = await issueSessionTokens(user);

  await logSecurityEvent({
    userId: user.id,
    action: 'session_refreshed'
  });

  return { user: sanitizeUser(user), tokens };
};

export const revokeSession = async ({ refreshToken, accessJti, userId, ipAddress }) => {
  if (refreshToken) {
    await revokeRefreshToken(refreshToken);
  }

  if (accessJti && userId) {
    const expiresAtIso = new Date(Date.now() + settings.accessTokenTtlSeconds * 1000).toISOString();
    await revokeAccessTokenByJti(accessJti, userId, expiresAtIso);
  }

  await logSecurityEvent({
    userId,
    action: 'logout_completed',
    metadata: { hasRefreshToken: Boolean(refreshToken), accessJti },
    ipAddress
  });
};

export const changePassword = async ({ userId, currentPassword, newPassword }) => {
  const user = await database.get(`SELECT * FROM users WHERE id = ? LIMIT 1`, [userId]);

  if (!user) {
    throw new Error('Usuário não encontrado.');
  }

  const match = await verifyPassword(currentPassword, user.password_hash);

  if (!match) {
    throw new Error('Senha atual incorreta.');
  }

  if (!validatePasswordComplexity(newPassword)) {
    throw new Error(passwordRequirementsMessage);
  }

  const passwordHash = await hashPassword(newPassword);
  const now = new Date().toISOString();
  const passwordExpiresAt = calculatePasswordExpiry();

  await database.run(
    `UPDATE users SET password_hash = ?, last_password_change = ?, password_expires_at = ?, updated_at = ? WHERE id = ?`,
    [passwordHash, now, passwordExpiresAt, now, userId]
  );

  await logSecurityEvent({
    userId,
    action: 'password_changed'
  });
};

export const requestPasswordReset = async ({ email }) => {
  const normalizedEmail = email.trim().toLowerCase();
  const user = await findUserByEmail(normalizedEmail);

  if (!user) {
    await logSecurityEvent({
      action: 'password_reset_requested',
      metadata: { email: normalizedEmail, outcome: 'unknown_user' }
    });
    return { delivered: true };
  }

  const rawToken = crypto.randomBytes(48).toString('hex');
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + settings.passwordResetTtlSeconds * 1000);

  await database.run(
    `INSERT INTO tokens (id, user_id, token_hash, type, expires_at, revoked, created_at)
     VALUES (?, ?, ?, 'password_reset', ?, 0, ?)`
      ,
    [
      crypto.randomUUID(),
      user.id,
      tokenHash,
      expiresAt.toISOString(),
      new Date().toISOString()
    ]
  );

  const resetLink = `https://demo.plantelligence/reset?token=${rawToken}`;

  await logSecurityEvent({
    userId: user.id,
    action: 'password_reset_requested',
    metadata: { expiresAt: expiresAt.toISOString() }
  });

  return {
    delivered: true,
    token: rawToken,
    resetLink
  };
};

export const resetPassword = async ({ token, newPassword }) => {
  const tokenHash = hashToken(token);
  const record = await database.get(
    `SELECT * FROM tokens WHERE token_hash = ? AND type = 'password_reset' LIMIT 1`,
    [tokenHash]
  );

  if (!record) {
    throw new Error('Token inválido.');
  }

  if (record.revoked) {
    throw new Error('Token já utilizado.');
  }

  if (new Date(record.expires_at).getTime() <= Date.now()) {
    throw new Error('Token expirado.');
  }

  if (!validatePasswordComplexity(newPassword)) {
    throw new Error(passwordRequirementsMessage);
  }

  const passwordHash = await hashPassword(newPassword);
  const now = new Date().toISOString();
  const passwordExpiresAt = calculatePasswordExpiry();

  await database.run(
    `UPDATE users SET password_hash = ?, last_password_change = ?, password_expires_at = ?, updated_at = ? WHERE id = ?`,
    [passwordHash, now, passwordExpiresAt, now, record.user_id]
  );

  await database.run(
    `UPDATE tokens SET revoked = 1 WHERE id = ?`,
    [record.id]
  );

  await logSecurityEvent({
    userId: record.user_id,
    action: 'password_reset_completed'
  });
};

export const getUserProfile = async (userId) => {
  const user = await database.get(`SELECT * FROM users WHERE id = ? LIMIT 1`, [userId]);
  if (!user) {
    throw new Error('Usuário não encontrado.');
  }
  return sanitizeUser(user);
};

export const updateUserProfile = async ({
  userId,
  fullName,
  phone,
  consentGiven
}) => {
  const now = new Date().toISOString();
  await database.run(
    `UPDATE users SET full_name = ?, phone = ?, consent_given = ?, consent_timestamp = CASE WHEN ? = 1 THEN COALESCE(consent_timestamp, ?) ELSE consent_timestamp END, updated_at = ? WHERE id = ?`,
    [
      fullName?.trim() ?? null,
      phone?.trim() ?? null,
      consentGiven ? 1 : 0,
      consentGiven ? 1 : 0,
      consentGiven ? now : null,
      now,
      userId
    ]
  );

  await logSecurityEvent({
    userId,
    action: 'user_profile_updated',
    metadata: { consentGiven }
  });

  return getUserProfile(userId);
};

export const requestDataDeletion = async ({ userId, reason }) => {
  await database.run(
    `UPDATE users SET deletion_requested = 1, updated_at = ? WHERE id = ?`,
    [new Date().toISOString(), userId]
  );

  await logSecurityEvent({
    userId,
    action: 'data_deletion_requested',
    metadata: { reason }
  });
};
