import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
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

const USERS_COLLECTION = 'users';
const TOKENS_COLLECTION = 'tokens';

export const initializeAuthService = async () => {
  // Firestore é schemaless, então nenhuma migração de coluna é necessária no momento.
};

const sanitizeUser = (row) => ({
  id: row.id,
  email: row.email,
  role: row.role,
  fullName: row.full_name ?? null,
  phone: row.phone ?? null,
  consentGiven: Boolean(row.consent_given),
  consentTimestamp: row.consent_timestamp ?? null,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  lastLoginAt: row.last_login_at ?? null,
  passwordExpiresAt: row.password_expires_at ?? null,
  deletionRequested: Boolean(row.deletion_requested),
  mfaEnabled: Boolean(row.mfa_enabled),
  mfaConfiguredAt: row.mfa_configured_at ?? null
});

const findUserByEmail = (email) =>
  database.get(USERS_COLLECTION, {
    filters: [{ field: 'email', value: email.trim().toLowerCase() }]
  });

const hasExistingUsers = async () => {
  try {
    return (await database.count(USERS_COLLECTION)) > 0;
  } catch (_error) {
    const sample = await database.all(USERS_COLLECTION, { limit: 1 });
    return sample.length > 0;
  }
};

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
  const isFirstUser = !(await hasExistingUsers());
  const role = isFirstUser ? 'Admin' : 'User';

  const userId = uuidv4();

  await database.run(USERS_COLLECTION, {
    id: userId,
    data: {
      email: normalizedEmail,
      password_hash: passwordHash,
      role,
      full_name: fullName?.trim() ?? null,
      phone: phone?.trim() ?? null,
      consent_given: consentGiven,
      consent_timestamp: consentGiven ? now : null,
      created_at: now,
      updated_at: now,
      last_password_change: now,
      password_expires_at: passwordExpiresAt,
      mfa_enabled: false,
      deletion_requested: false
    }
  });

  const user = await database.get(USERS_COLLECTION, { id: userId });

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

  await database.run(USERS_COLLECTION, {
    id: user.id,
    data: {
      last_login_at: now,
      updated_at: now
    },
    merge: true
  });

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

  const refreshedUser = await database.get(USERS_COLLECTION, { id: user.id });

  return {
    user: sanitizeUser(refreshedUser),
    tokens,
    passwordExpired: metadata?.passwordExpired ?? false
  };
};

export const refreshSession = async ({ refreshToken }) => {
  const payload = await verifyRefreshToken(refreshToken);
  const user = await database.get(USERS_COLLECTION, { id: payload.sub });

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
  const user = await database.get(USERS_COLLECTION, { id: userId });

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

  await database.run(USERS_COLLECTION, {
    id: userId,
    data: {
      password_hash: passwordHash,
      last_password_change: now,
      password_expires_at: passwordExpiresAt,
      updated_at: now
    },
    merge: true
  });

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

  await database.run(TOKENS_COLLECTION, {
    id: uuidv4(),
    data: {
      user_id: user.id,
      token_hash: tokenHash,
      type: 'password_reset',
      expires_at: expiresAt.toISOString(),
      revoked: false,
      created_at: new Date().toISOString()
    }
  });

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
  const record = await database.get(TOKENS_COLLECTION, {
    filters: [
      { field: 'token_hash', value: tokenHash },
      { field: 'type', value: 'password_reset' }
    ]
  });

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

  await database.run(USERS_COLLECTION, {
    id: record.user_id,
    data: {
      password_hash: passwordHash,
      last_password_change: now,
      password_expires_at: passwordExpiresAt,
      updated_at: now
    },
    merge: true
  });

  await database.run(TOKENS_COLLECTION, {
    id: record.id,
    data: {
      revoked: true,
      updated_at: now
    },
    merge: true
  });

  await logSecurityEvent({
    userId: record.user_id,
    action: 'password_reset_completed'
  });
};

export const getUserProfile = async (userId) => {
  const user = await database.get(USERS_COLLECTION, { id: userId });
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
  const existing = await database.get(USERS_COLLECTION, { id: userId });

  if (!existing) {
    throw new Error('Usuário não encontrado.');
  }

  const consentTimestamp = consentGiven
    ? existing.consent_timestamp ?? now
    : existing.consent_timestamp ?? null;

  await database.run(USERS_COLLECTION, {
    id: userId,
    data: {
      full_name: fullName?.trim() ?? null,
      phone: phone?.trim() ?? null,
      consent_given: Boolean(consentGiven),
      consent_timestamp: consentTimestamp,
      updated_at: now
    },
    merge: true
  });

  await logSecurityEvent({
    userId,
    action: 'user_profile_updated',
    metadata: { consentGiven }
  });

  return getUserProfile(userId);
};

export const requestDataDeletion = async ({ userId, reason }) => {
  await database.run(USERS_COLLECTION, {
    id: userId,
    data: {
      deletion_requested: true,
      updated_at: new Date().toISOString()
    },
    merge: true
  });

  await logSecurityEvent({
    userId,
    action: 'data_deletion_requested',
    metadata: { reason }
  });
};
