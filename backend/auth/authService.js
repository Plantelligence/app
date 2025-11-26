import crypto from 'crypto';
import { Timestamp } from 'firebase-admin/firestore';
import { v4 as uuid } from 'uuid';
import { database } from '../services/database.js';
import { logSecurityEvent } from '../logs/logger.js';
import { sendMfaCodeEmail } from '../services/emailService.js';
import {
  hashPassword,
  verifyPassword,
  calculatePasswordExpiry,
  isPasswordExpired
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
import {
  createTotpSetup,
  recreateTotpSetup,
  verifyTotpCodeWithEncryptedSecret
} from './totpService.js';

const USERS_COLLECTION = 'users';
const TOKENS_COLLECTION = 'tokens';
const REGISTRATION_COLLECTION = 'registration_challenges';
const REGISTRATION_TTL_SECONDS = 600;
const REGISTRATION_MAX_ATTEMPTS = 5;
const REGISTRATION_OTP_MAX_ATTEMPTS = 5;
const OTP_ENROLLMENTS_COLLECTION = 'otp_enrollments';
const OTP_ENROLLMENT_TTL_SECONDS = 600;
const OTP_ENROLLMENT_MAX_ATTEMPTS = 5;
const LOGIN_SESSIONS_COLLECTION = 'login_sessions';
const LOGIN_SESSION_TTL_SECONDS = 600;
const ENFORCED_MFA_METHODS = ['email', 'otp'];

const normalizeEmail = (email) => email.trim().toLowerCase();

const toIsoString = (value) => {
  if (!value) {
    return null;
  }

  if (typeof value === 'string') {
    return value;
  }

  if (typeof value.toDate === 'function') {
    return value.toDate().toISOString();
  }

  return new Date(value).toISOString();
};

const mapUserDocument = (doc) => {
  if (!doc) {
    return null;
  }

  return {
    id: doc.id,
    email: doc.email,
    role: doc.role,
    fullName: doc.fullName ?? null,
    phone: doc.phone ?? null,
    consentGiven: Boolean(doc.consentGiven),
    consentTimestamp: doc.consentTimestamp ?? null,
    createdAt: doc.createdAt ?? null,
    updatedAt: doc.updatedAt ?? null,
    lastLoginAt: doc.lastLoginAt ?? null,
    passwordHash: doc.passwordHash,
    passwordExpiresAt: doc.passwordExpiresAt ?? null,
    lastPasswordChange: doc.lastPasswordChange ?? null,
    deletionRequested: Boolean(doc.deletionRequested),
    mfaEnabled: Boolean(doc.mfaEnabled),
    mfaConfiguredAt: doc.mfaConfiguredAt ?? null,
    mfa: doc.mfa ?? null
  };
};

const sanitizeUser = (user) => ({
  id: user.id,
  email: user.email,
  role: user.role,
  fullName: user.fullName ?? null,
  phone: user.phone ?? null,
  consentGiven: Boolean(user.consentGiven),
  consentTimestamp: user.consentTimestamp ?? null,
  createdAt: user.createdAt ?? null,
  updatedAt: user.updatedAt ?? null,
  lastLoginAt: user.lastLoginAt ?? null,
  passwordExpiresAt: user.passwordExpiresAt ?? null,
  deletionRequested: Boolean(user.deletionRequested),
  mfaEnabled: Boolean(user.mfaEnabled),
  mfaConfiguredAt: user.mfaConfiguredAt ?? null,
  mfa: user.mfa
    ? {
        enforcedMethods: Array.isArray(user.mfa.enforcedMethods)
          ? user.mfa.enforcedMethods
          : [],
        email: user.mfa.email
          ? {
              configuredAt: user.mfa.email.configuredAt ?? null,
              delivery: user.mfa.email.delivery ?? 'email'
            }
          : null,
        otp: user.mfa.otp
          ? {
              configuredAt: user.mfa.otp.configuredAt ?? null
            }
          : null
      }
    : null
});

export const getUserById = async (userId) => {
  const doc = await database.getById(USERS_COLLECTION, userId);
  return mapUserDocument(doc);
};

const findUserByEmail = async (email) => {
  const doc = await database.get(USERS_COLLECTION, (collectionRef) =>
    collectionRef.where('email', '==', email).limit(1)
  );

  return mapUserDocument(doc);
};

const getUserOtpSecret = (user) => user?.mfa?.otp?.secret ?? null;

const ensureEmailMfaConfiguredAt = (user, fallbackIso) =>
  user?.mfa?.email?.configuredAt ?? user?.createdAt ?? fallbackIso;

const isExpired = (record) => {
  if (!record) {
    return true;
  }

  const { expiresAt, expiresAtTs } = record;
  const expires = expiresAtTs?.toDate?.() ?? (expiresAt ? new Date(expiresAt) : null);

  if (!expires) {
    return true;
  }

  return expires.getTime() <= Date.now();
};

const createLoginSession = async ({ userId, passwordExpired }) => {
  const sessionId = uuid();
  const now = new Date();
  const nowIso = now.toISOString();
  const expiresAt = new Date(now.getTime() + LOGIN_SESSION_TTL_SECONDS * 1000);

  await database.setDocument(LOGIN_SESSIONS_COLLECTION, sessionId, {
    id: sessionId,
    userId,
    passwordExpired: Boolean(passwordExpired),
    createdAt: nowIso,
    createdAtTs: Timestamp.fromDate(now),
    updatedAt: nowIso,
    updatedAtTs: Timestamp.fromDate(now),
    expiresAt: expiresAt.toISOString(),
    expiresAtTs: Timestamp.fromDate(expiresAt),
    emailChallenge: null,
    otpEnrollment: null
  });

  return {
    sessionId,
    expiresAt: expiresAt.toISOString()
  };
};

const getLoginSession = async (sessionId) => {
  if (!sessionId) {
    return null;
  }

  const session = await database.getById(LOGIN_SESSIONS_COLLECTION, sessionId);
  return session ?? null;
};

const updateLoginSession = async (sessionId, updates) => {
  const now = new Date();
  await database.updateDocument(LOGIN_SESSIONS_COLLECTION, sessionId, {
    ...updates,
    updatedAt: now.toISOString(),
    updatedAtTs: Timestamp.fromDate(now)
  });
};

const clearLoginSession = async (sessionId) => {
  if (!sessionId) {
    return;
  }

  await database.deleteDocument(LOGIN_SESSIONS_COLLECTION, sessionId).catch(() => undefined);
};

const assertActiveLoginSession = (session) => {
  if (!session) {
    const error = new Error('Sessão de autenticação MFA inválida ou expirada.');
    error.statusCode = 404;
    throw error;
  }

  if (isExpired(session)) {
    clearLoginSession(session.id).catch(() => undefined);
    const error = new Error('Sessão de autenticação expirada. Refaça o login.');
    error.statusCode = 401;
    throw error;
  }
};

const findLatestOtpEnrollment = async (userId) =>
  database.get(OTP_ENROLLMENTS_COLLECTION, (collectionRef) =>
    collectionRef.where('userId', '==', userId).orderBy('createdAtTs', 'desc').limit(1)
  );

const reuseExistingOtpEnrollment = async (user, enrollment) => {
  const setup = recreateTotpSetup({
    email: user.email,
    stored: {
      encryptedSecret: enrollment.encryptedSecret,
      issuer: enrollment.issuer ?? settings.mfaIssuer,
      accountName: enrollment.accountName ?? user.email
    }
  });

  if (!setup) {
    await database.deleteDocument(OTP_ENROLLMENTS_COLLECTION, enrollment.id).catch(() => undefined);
    return null;
  }

  const now = new Date();
  const nowIso = now.toISOString();
  const updates = {
    updatedAt: nowIso,
    updatedAtTs: Timestamp.fromDate(now)
  };

  let expiresAtIso = enrollment.expiresAt;
  const attempts = enrollment.attempts ?? 0;

  if (isExpired(enrollment)) {
    const renewedExpiry = new Date(now.getTime() + OTP_ENROLLMENT_TTL_SECONDS * 1000);
    expiresAtIso = renewedExpiry.toISOString();
    updates.expiresAt = expiresAtIso;
    updates.expiresAtTs = Timestamp.fromDate(renewedExpiry);
    updates.attempts = 0;
  } else if (attempts >= OTP_ENROLLMENT_MAX_ATTEMPTS) {
    updates.attempts = 0;
  }

  if (updates.updatedAt || updates.expiresAt || updates.attempts !== undefined) {
    await database.updateDocument(OTP_ENROLLMENTS_COLLECTION, enrollment.id, updates);
  }

  return {
    enrollmentId: enrollment.id,
    secret: setup.secret,
    uri: setup.uri,
    issuer: setup.issuer,
    accountName: setup.accountName,
    expiresAt: expiresAtIso,
    debugCode: setup.debugCode,
    reused: true
  };
};

const createOtpEnrollmentForUser = async (user) => {
  const existing = await findLatestOtpEnrollment(user.id);

  if (existing) {
    const reused = await reuseExistingOtpEnrollment(user, existing);
    if (reused) {
      return reused;
    }
  }

  await database.deleteWhere(OTP_ENROLLMENTS_COLLECTION, (collectionRef) =>
    collectionRef.where('userId', '==', user.id)
  );

  const now = new Date();
  const nowIso = now.toISOString();
  const expiresAt = new Date(now.getTime() + OTP_ENROLLMENT_TTL_SECONDS * 1000);
  const expiresAtIso = expiresAt.toISOString();
  const enrollmentId = uuid();
  const setup = createTotpSetup({ email: user.email, issuer: settings.mfaIssuer });

  await database.setDocument(OTP_ENROLLMENTS_COLLECTION, enrollmentId, {
    id: enrollmentId,
    userId: user.id,
    encryptedSecret: setup.encryptedSecret,
    issuer: setup.issuer,
    accountName: setup.accountName,
    createdAt: nowIso,
    createdAtTs: Timestamp.fromDate(now),
    expiresAt: expiresAtIso,
    expiresAtTs: Timestamp.fromDate(expiresAt),
    attempts: 0
  });

  return {
    enrollmentId,
    secret: setup.secret,
    uri: setup.uri,
    issuer: setup.issuer,
    accountName: setup.accountName,
    expiresAt: expiresAtIso,
    debugCode: setup.debugCode,
    reused: false
  };
};

export const registerUser = async ({
  email,
  password,
  fullName,
  phone,
  consent
}) => {
  const normalizedEmail = normalizeEmail(email);
  const existing = await findUserByEmail(normalizedEmail);

  if (existing) {
    throw new Error('E-mail já cadastrado.');
  }

  await database.deleteWhere(REGISTRATION_COLLECTION, (collectionRef) =>
    collectionRef.where('email', '==', normalizedEmail)
  );

  const passwordHash = await hashPassword(password);
  const now = new Date();
  const nowIso = now.toISOString();
  const code = crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');
  const challengeId = uuid();
  const expiresAt = new Date(now.getTime() + REGISTRATION_TTL_SECONDS * 1000);
  const expiresAtIso = expiresAt.toISOString();

  await database.setDocument(REGISTRATION_COLLECTION, challengeId, {
    id: challengeId,
    email: normalizedEmail,
    codeHash: hashToken(code),
    passwordHash,
    fullName: fullName?.trim() ?? null,
    phone: phone?.trim() ?? null,
    consentGiven: Boolean(consent),
    consentTimestamp: consent ? nowIso : null,
    attempts: 0,
    otpAttempts: 0,
    emailVerifiedAt: null,
    otpSetup: null,
    createdAt: nowIso,
    createdAtTs: Timestamp.fromDate(now),
    expiresAt: expiresAtIso,
    expiresAtTs: Timestamp.fromDate(expiresAt)
  });

  await logSecurityEvent({
    action: 'registration_started',
    metadata: { email: normalizedEmail }
  });

  try {
    await sendMfaCodeEmail({
      to: normalizedEmail,
      code,
      expiresAt: expiresAtIso
    });
  } catch (error) {
    await database.deleteDocument(REGISTRATION_COLLECTION, challengeId).catch(() => undefined);
    await logSecurityEvent({
      action: 'registration_delivery_failed',
      metadata: { email: normalizedEmail, reason: error.message }
    });
    throw new Error('Não foi possível enviar o código de verificação. Tente novamente em instantes.');
  }

  await logSecurityEvent({
    action: 'registration_challenge_sent',
    metadata: { email: normalizedEmail }
  });

  return {
    challengeId,
    expiresAt: expiresAtIso,
    debugCode: settings.mfaDebugMode ? code : null
  };
};

export const confirmRegistrationEmail = async ({ challengeId, code, ipAddress }) => {
  const challenge = await database.getById(REGISTRATION_COLLECTION, challengeId);

  if (!challenge) {
    await logSecurityEvent({
      action: 'registration_challenge_missing',
      metadata: { challengeId },
      ipAddress
    });
    const error = new Error('Solicitação de cadastro inválida ou expirada.');
    error.statusCode = 404;
    throw error;
  }

  const expiresAtDate = challenge.expiresAtTs
    ? challenge.expiresAtTs.toDate()
    : new Date(challenge.expiresAt);

  if (expiresAtDate.getTime() <= Date.now()) {
    await database.deleteDocument(REGISTRATION_COLLECTION, challengeId);
    await logSecurityEvent({
      action: 'registration_code_expired',
      metadata: { challengeId, email: challenge.email },
      ipAddress
    });
    const error = new Error('Código de verificação expirado. Solicite um novo cadastro.');
    error.statusCode = 401;
    throw error;
  }

  if (challenge.attempts >= REGISTRATION_MAX_ATTEMPTS) {
    await logSecurityEvent({
      action: 'registration_code_locked',
      metadata: { challengeId, email: challenge.email, attempts: challenge.attempts },
      ipAddress
    });
    const error = new Error('Cadastro bloqueado por tentativas inválidas. Inicie o processo novamente.');
    error.statusCode = 423;
    throw error;
  }

  const providedHash = hashToken(code);

  if (providedHash !== challenge.codeHash) {
    const updatedAttempts = challenge.attempts + 1;
    const updatedAt = new Date();

    await database.updateDocument(REGISTRATION_COLLECTION, challengeId, {
      attempts: updatedAttempts,
      updatedAt: updatedAt.toISOString(),
      updatedAtTs: Timestamp.fromDate(updatedAt)
    });

    await logSecurityEvent({
      action: 'registration_code_invalid',
      metadata: { challengeId, email: challenge.email, attempts: updatedAttempts },
      ipAddress
    });

    const error = new Error('Código de verificação inválido.');
    error.statusCode = 401;
    throw error;
  }

  const now = new Date();
  const nowIso = now.toISOString();

  await logSecurityEvent({
    action: 'registration_email_verified',
    metadata: { challengeId, email: challenge.email },
    ipAddress
  });

  let otpSetup = null;
  if (challenge.otpSetup?.encryptedSecret) {
    otpSetup = recreateTotpSetup({
      email: challenge.email,
      stored: challenge.otpSetup
    });
  }

  if (!otpSetup) {
    otpSetup = createTotpSetup({ email: challenge.email, issuer: settings.mfaIssuer });
    await database.updateDocument(REGISTRATION_COLLECTION, challengeId, {
      otpSetup: {
        encryptedSecret: otpSetup.encryptedSecret,
        issuer: otpSetup.issuer,
        accountName: otpSetup.accountName
      }
    });
  }

  await database.updateDocument(REGISTRATION_COLLECTION, challengeId, {
    emailVerifiedAt: nowIso,
    otpAttempts: 0
  });

  return {
    nextStep: 'otp',
    otpSetupId: challengeId,
    secret: otpSetup.secret,
    uri: otpSetup.uri,
    issuer: otpSetup.issuer,
    accountName: otpSetup.accountName,
    debugCode: otpSetup.debugCode
  };
};

export const finalizeRegistration = async ({ otpSetupId, otpCode, ipAddress }) => {
  const challenge = await database.getById(REGISTRATION_COLLECTION, otpSetupId);

  if (!challenge) {
    await logSecurityEvent({
      action: 'registration_challenge_missing',
      metadata: { otpSetupId },
      ipAddress
    });
    const error = new Error('Solicitação de cadastro inválida ou expirada.');
    error.statusCode = 404;
    throw error;
  }

  if (!challenge.emailVerifiedAt) {
    const error = new Error('Confirme o e-mail antes de validar o aplicativo autenticador.');
    error.statusCode = 400;
    throw error;
  }

  if (!challenge.otpSetup?.encryptedSecret) {
    const error = new Error('Configuração OTP não encontrada. Reinicie o cadastro.');
    error.statusCode = 400;
    throw error;
  }

  if (challenge.otpAttempts >= REGISTRATION_OTP_MAX_ATTEMPTS) {
    await logSecurityEvent({
      action: 'registration_otp_locked',
      metadata: { otpSetupId, email: challenge.email, attempts: challenge.otpAttempts },
      ipAddress
    });
    const error = new Error('Configuração OTP bloqueada por tentativas inválidas. Reinicie o cadastro.');
    error.statusCode = 423;
    throw error;
  }

  const isOtpValid = verifyTotpCodeWithEncryptedSecret({
    token: otpCode,
    encryptedSecret: challenge.otpSetup.encryptedSecret
  });

  if (!isOtpValid) {
    const updatedAttempts = (challenge.otpAttempts ?? 0) + 1;
    const updatedAt = new Date();

    await database.updateDocument(REGISTRATION_COLLECTION, otpSetupId, {
      otpAttempts: updatedAttempts,
      updatedAt: updatedAt.toISOString(),
      updatedAtTs: Timestamp.fromDate(updatedAt)
    });

    await logSecurityEvent({
      action: 'registration_otp_invalid',
      metadata: { otpSetupId, email: challenge.email, attempts: updatedAttempts },
      ipAddress
    });

    const error = new Error('Código do autenticador inválido.');
    error.statusCode = 401;
    throw error;
  }

  const totalUsers = await database.count(USERS_COLLECTION);
  const role = totalUsers === 0 ? 'Admin' : 'User';
  const now = new Date();
  const nowIso = now.toISOString();
  const passwordExpiresAt = calculatePasswordExpiry();
  const userId = uuid();

  const emailConfiguredAt = challenge.emailVerifiedAt ?? nowIso;

  await database.setDocument(USERS_COLLECTION, userId, {
    id: userId,
    email: challenge.email,
    role,
    passwordHash: challenge.passwordHash,
    fullName: challenge.fullName ?? null,
    phone: challenge.phone ?? null,
    consentGiven: Boolean(challenge.consentGiven),
    consentTimestamp: challenge.consentGiven
      ? challenge.consentTimestamp ?? nowIso
      : null,
    createdAt: nowIso,
    updatedAt: nowIso,
    lastLoginAt: null,
    lastPasswordChange: nowIso,
    passwordExpiresAt,
    deletionRequested: false,
    mfaEnabled: true,
    mfaConfiguredAt: nowIso,
    mfa: {
      enforcedMethods: ENFORCED_MFA_METHODS,
      email: {
        delivery: 'email',
        configuredAt: emailConfiguredAt
      },
      otp: {
        configuredAt: nowIso,
        secret: challenge.otpSetup.encryptedSecret,
        issuer: challenge.otpSetup.issuer ?? settings.mfaIssuer,
        accountName: challenge.otpSetup.accountName ?? challenge.email
      }
    }
  });

  await database.deleteDocument(REGISTRATION_COLLECTION, otpSetupId);

  await logSecurityEvent({
    userId,
    action: 'user_registered',
    metadata: { email: challenge.email, role }
  });

  await logSecurityEvent({
    userId,
    action: 'mfa_totp_configured',
    metadata: { method: 'otp', issuer: challenge.otpSetup.issuer ?? settings.mfaIssuer }
  });

  const createdUser = await getUserById(userId);

  return sanitizeUser(createdUser);
};

export const loginUser = async ({ email, password, ipAddress }) => {
  const normalizedEmail = normalizeEmail(email);
  const user = await findUserByEmail(normalizedEmail);

  if (!user) {
    await logSecurityEvent({
      action: 'login_failed',
      metadata: { reason: 'unknown_email', email: normalizedEmail },
      ipAddress
    });
    throw new Error('Credenciais inválidas.');
  }

  const passwordMatch = await verifyPassword(password, user.passwordHash);

  if (!passwordMatch) {
    await logSecurityEvent({
      userId: user.id,
      action: 'login_failed',
      metadata: { reason: 'invalid_password' },
      ipAddress
    });
    throw new Error('Credenciais inválidas.');
  }

  const passwordExpired = isPasswordExpired(user.passwordExpiresAt);
  const session = await createLoginSession({ userId: user.id, passwordExpired });

  const otpSecretPayload = getUserOtpSecret(user);
  const otpIssuer = user.mfa?.otp?.issuer ?? settings.mfaIssuer;
  const otpAccountName = user.mfa?.otp?.accountName ?? user.email;

  let otpDebugCode = null;
  if (otpSecretPayload && settings.mfaDebugMode) {
    const existing = recreateTotpSetup({
      email: user.email,
      stored: {
        encryptedSecret: otpSecretPayload,
        issuer: otpIssuer,
        accountName: otpAccountName
      }
    });
    otpDebugCode = existing?.debugCode ?? null;
  }

  await logSecurityEvent({
    userId: user.id,
    action: 'mfa_session_created',
    metadata: {
      sessionId: session.sessionId,
      passwordExpired
    },
    ipAddress
  });

  return {
    mfaRequired: true,
    sessionId: session.sessionId,
    expiresAt: session.expiresAt,
    passwordExpired,
    methods: {
      email: {
        delivery: 'email'
      },
      otp: {
        configured: Boolean(otpSecretPayload),
        enrollmentRequired: !otpSecretPayload,
        issuer: otpIssuer,
        accountName: otpAccountName,
        ...(otpDebugCode ? { debugCode: otpDebugCode } : {})
      }
    }
  };
};

export const initiateMfaMethod = async ({ sessionId, method, ipAddress }) => {
  const session = await getLoginSession(sessionId);
  assertActiveLoginSession(session);

  const user = await getUserById(session.userId);

  if (!user) {
    await clearLoginSession(sessionId);
    const error = new Error('Usuário associado à sessão não encontrado.');
    error.statusCode = 404;
    throw error;
  }

  if (method === 'email') {
    const challenge = await createMfaChallenge({
      user,
      metadata: { passwordExpired: Boolean(session.passwordExpired) }
    });

    await updateLoginSession(sessionId, {
      emailChallenge: {
        id: challenge.challengeId,
        expiresAt: challenge.expiresAt
      }
    });

    await logSecurityEvent({
      userId: user.id,
      action: 'mfa_email_requested',
      metadata: { sessionId, challengeId: challenge.challengeId },
      ipAddress
    });

    return {
      method: 'email',
      challengeId: challenge.challengeId,
      expiresAt: challenge.expiresAt,
      debugCode: challenge.debugCode ?? null
    };
  }

  if (method === 'otp') {
    const otpSecretPayload = getUserOtpSecret(user);
    const issuer = user.mfa?.otp?.issuer ?? settings.mfaIssuer;
    const accountName = user.mfa?.otp?.accountName ?? user.email;

    if (otpSecretPayload) {
      let debugCode = null;
      if (settings.mfaDebugMode) {
        const existing = recreateTotpSetup({
          email: user.email,
          stored: {
            encryptedSecret: otpSecretPayload,
            issuer,
            accountName
          }
        });
        debugCode = existing?.debugCode ?? null;
      }

      await updateLoginSession(sessionId, {
        otpEnrollment: null
      });

      await logSecurityEvent({
        userId: user.id,
        action: 'mfa_totp_challenge_requested',
        metadata: { sessionId, configured: true },
        ipAddress
      });

      return {
        method: 'otp',
        configured: true,
        issuer,
        accountName,
        ...(debugCode ? { debugCode } : {})
      };
    }

    const enrollment = await createOtpEnrollmentForUser(user);

    await updateLoginSession(sessionId, {
      otpEnrollment: {
        id: enrollment.enrollmentId,
        expiresAt: enrollment.expiresAt
      }
    });

    await logSecurityEvent({
      userId: user.id,
      action: 'mfa_totp_enrollment_started',
      metadata: {
        sessionId,
        enrollmentId: enrollment.enrollmentId,
        reused: Boolean(enrollment.reused)
      },
      ipAddress
    });

    return {
      method: 'otp',
      configured: false,
      enrollmentId: enrollment.enrollmentId,
      secret: enrollment.secret,
      uri: enrollment.uri,
      issuer: enrollment.issuer,
      accountName: enrollment.accountName,
      expiresAt: enrollment.expiresAt,
      debugCode: enrollment.debugCode ?? null
    };
  }

  const error = new Error('Método de MFA inválido.');
  error.statusCode = 400;
  throw error;
};

export const completeMfa = async ({ sessionId, method, code, otpEnrollmentId, ipAddress }) => {
  const session = await getLoginSession(sessionId);
  assertActiveLoginSession(session);

  let user = await getUserById(session.userId);

  if (!user) {
    await clearLoginSession(sessionId);
    const error = new Error('Usuário associado à sessão não encontrado.');
    error.statusCode = 404;
    throw error;
  }

  const now = new Date();
  const nowIso = now.toISOString();
  let passwordExpired = Boolean(session.passwordExpired);

  if (method === 'email') {
    const challengeId = session.emailChallenge?.id;
    if (!challengeId) {
      const error = new Error('É necessário solicitar um novo código por e-mail.');
      error.statusCode = 400;
      throw error;
    }

    const { metadata } = await verifyMfaChallenge({
      challengeId,
      code,
      ipAddress
    });

    passwordExpired = metadata?.passwordExpired ?? passwordExpired;
  } else if (method === 'otp') {
    let secretPayload = getUserOtpSecret(user);
    let issuer = user.mfa?.otp?.issuer ?? settings.mfaIssuer;
    let accountName = user.mfa?.otp?.accountName ?? user.email;

    const sessionEnrollmentId = session.otpEnrollment?.id ?? null;
    const effectiveEnrollmentId = otpEnrollmentId ?? sessionEnrollmentId;

    if (effectiveEnrollmentId) {
      const enrollment = await database.getById(OTP_ENROLLMENTS_COLLECTION, effectiveEnrollmentId);

      if (!enrollment || enrollment.userId !== user.id) {
        await clearLoginSession(sessionId);
        const error = new Error('Cadastro de autenticador inválido ou expirado. Faça login novamente.');
        error.statusCode = 404;
        throw error;
      }

      if (isExpired(enrollment)) {
        await database.deleteDocument(OTP_ENROLLMENTS_COLLECTION, effectiveEnrollmentId).catch(() => undefined);
        await clearLoginSession(sessionId);
        const error = new Error('Cadastro de autenticador expirado. Faça login novamente.');
        error.statusCode = 401;
        throw error;
      }

      if (enrollment.attempts >= OTP_ENROLLMENT_MAX_ATTEMPTS) {
        await database.deleteDocument(OTP_ENROLLMENTS_COLLECTION, effectiveEnrollmentId).catch(() => undefined);
        await clearLoginSession(sessionId);
        const error = new Error('Cadastro de autenticador bloqueado. Faça login novamente.');
        error.statusCode = 423;
        throw error;
      }

      const isOtpValid = verifyTotpCodeWithEncryptedSecret({
        token: code,
        encryptedSecret: enrollment.encryptedSecret
      });

      if (!isOtpValid) {
        const updatedAttempts = (enrollment.attempts ?? 0) + 1;
        const updatedAt = new Date();

        await database.updateDocument(OTP_ENROLLMENTS_COLLECTION, effectiveEnrollmentId, {
          attempts: updatedAttempts,
          updatedAt: updatedAt.toISOString(),
          updatedAtTs: Timestamp.fromDate(updatedAt)
        });

        await logSecurityEvent({
          userId: user.id,
          action: 'mfa_totp_invalid',
          metadata: { otpEnrollmentId: effectiveEnrollmentId, attempts: updatedAttempts },
          ipAddress
        });

        const error = new Error('Código do autenticador inválido.');
        error.statusCode = 401;
        throw error;
      }

      secretPayload = enrollment.encryptedSecret;
      issuer = enrollment.issuer ?? issuer;
      accountName = enrollment.accountName ?? accountName;

      const emailConfiguredAt = ensureEmailMfaConfiguredAt(user, nowIso);

      await database.updateDocument(USERS_COLLECTION, user.id, {
        updatedAt: nowIso,
        mfaEnabled: true,
        mfaConfiguredAt: nowIso,
        mfa: {
          enforcedMethods: ENFORCED_MFA_METHODS,
          email: {
            delivery: 'email',
            configuredAt: emailConfiguredAt
          },
          otp: {
            configuredAt: nowIso,
            secret: secretPayload,
            issuer,
            accountName
          }
        }
      });

      await database.deleteDocument(OTP_ENROLLMENTS_COLLECTION, effectiveEnrollmentId).catch(() => undefined);

      await logSecurityEvent({
        userId: user.id,
        action: 'mfa_totp_configured',
        metadata: { method: 'otp', issuer },
        ipAddress
      });

      user = await getUserById(user.id);
    } else {
      if (!secretPayload) {
        const error = new Error('Nenhum autenticador configurado para este usuário.');
        error.statusCode = 400;
        throw error;
      }

      const isOtpValid = verifyTotpCodeWithEncryptedSecret({
        token: code,
        encryptedSecret: secretPayload
      });

      if (!isOtpValid) {
        await logSecurityEvent({
          userId: user.id,
          action: 'mfa_totp_invalid',
          metadata: { method: 'otp' },
          ipAddress
        });
        const error = new Error('Código do autenticador inválido.');
        error.statusCode = 401;
        throw error;
      }
    }
  } else {
    const error = new Error('Método de MFA inválido.');
    error.statusCode = 400;
    throw error;
  }

  await database.updateDocument(USERS_COLLECTION, user.id, {
    lastLoginAt: nowIso,
    updatedAt: nowIso
  });

  const tokens = await issueSessionTokens(user);

  await logSecurityEvent({
    userId: user.id,
    action: 'mfa_verified',
    metadata: { method },
    ipAddress
  });

  await logSecurityEvent({
    userId: user.id,
    action: 'login_success',
    metadata: { passwordExpired },
    ipAddress
  });

  const refreshedUser = await getUserById(user.id);

  await clearLoginSession(sessionId);

  return {
    user: sanitizeUser(refreshedUser),
    tokens,
    passwordExpired
  };
};

export const refreshSession = async ({ refreshToken }) => {
  const payload = await verifyRefreshToken(refreshToken);
  const user = await getUserById(payload.sub);

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

export const revokeSession = async ({ refreshToken, accessJti, userId }) => {
  if (refreshToken) {
    await revokeRefreshToken(refreshToken);
  }

  if (accessJti && userId) {
    const expiresAtIso = new Date(Date.now() + settings.accessTokenTtlSeconds * 1000).toISOString();
    await revokeAccessTokenByJti(accessJti, userId, expiresAtIso);
  }

  await logSecurityEvent({
    userId,
    action: 'session_revoked',
    metadata: { hasRefreshToken: Boolean(refreshToken), accessJti }
  });
};

export const changePassword = async ({
  userId,
  currentPassword,
  newPassword,
  verification,
  ipAddress
}) => {
  const user = await getUserById(userId);

  if (!user) {
    throw new Error('Usuário não encontrado.');
  }

  const verificationData = verification ?? {};
  let verificationMethod = null;

  const otpCode = verificationData.otpCode?.trim?.();
  const challengeId = verificationData.challengeId?.trim?.();
  const challengeCode = verificationData.code?.trim?.();

  if (otpCode) {
    const secret = getUserOtpSecret(user);

    if (!secret) {
      const error = new Error('Aplicativo autenticador não configurado.');
      error.statusCode = 409;
      throw error;
    }

    const isValid = verifyTotpCodeWithEncryptedSecret({
      token: otpCode,
      encryptedSecret: secret
    });

    if (!isValid) {
      const error = new Error('Código do autenticador inválido.');
      error.statusCode = 401;
      throw error;
    }

    verificationMethod = 'otp';
  }

  if (!verificationMethod && challengeId && challengeCode) {
    await verifyMfaChallenge({
      challengeId,
      code: challengeCode,
      ipAddress
    });
    verificationMethod = 'email';
  }

  if (!verificationMethod) {
    const error = new Error('Confirme a operação com MFA antes de alterar a senha.');
    error.statusCode = 401;
    throw error;
  }

  const match = await verifyPassword(currentPassword, user.passwordHash);

  if (!match) {
    throw new Error('Senha atual incorreta.');
  }

  const passwordHash = await hashPassword(newPassword);
  const now = new Date();
  const nowIso = now.toISOString();
  const passwordExpiresAt = calculatePasswordExpiry();

  await database.updateDocument(USERS_COLLECTION, userId, {
    passwordHash,
    lastPasswordChange: nowIso,
    passwordExpiresAt,
    updatedAt: nowIso
  });

  await logSecurityEvent({
    userId,
    action: 'password_changed',
    metadata: {
      verificationMethod
    }
  });
};

export const startUserOtpEnrollment = async ({ userId, ipAddress }) => {
  const user = await getUserById(userId);

  if (!user) {
    throw new Error('Usuário não encontrado.');
  }

  const enrollment = await createOtpEnrollmentForUser(user);

  await logSecurityEvent({
    userId,
    action: 'mfa_totp_enrollment_started',
    metadata: {
      context: 'self_service',
      enrollmentId: enrollment.enrollmentId,
      reused: Boolean(enrollment.reused)
    },
    ipAddress
  });

  return enrollment;
};

export const completeUserOtpEnrollment = async ({ userId, enrollmentId, code, ipAddress }) => {
  const user = await getUserById(userId);

  if (!user) {
    throw new Error('Usuário não encontrado.');
  }

  const enrollment = await database.getById(OTP_ENROLLMENTS_COLLECTION, enrollmentId);

  if (!enrollment || enrollment.userId !== userId) {
    throw new Error('Configuração de autenticador inválida ou expirada.');
  }

  if (isExpired(enrollment)) {
    await database.deleteDocument(OTP_ENROLLMENTS_COLLECTION, enrollmentId).catch(() => undefined);
    const error = new Error('Configuração de autenticador expirada. Inicie novamente.');
    error.statusCode = 401;
    throw error;
  }

  if (enrollment.attempts >= OTP_ENROLLMENT_MAX_ATTEMPTS) {
    await database.deleteDocument(OTP_ENROLLMENTS_COLLECTION, enrollmentId).catch(() => undefined);
    const error = new Error('Configuração de autenticador bloqueada por tentativas inválidas.');
    error.statusCode = 423;
    throw error;
  }

  const isValid = verifyTotpCodeWithEncryptedSecret({
    token: code,
    encryptedSecret: enrollment.encryptedSecret
  });

  if (!isValid) {
    const updatedAttempts = (enrollment.attempts ?? 0) + 1;
    const updatedAt = new Date();

    await database.updateDocument(OTP_ENROLLMENTS_COLLECTION, enrollmentId, {
      attempts: updatedAttempts,
      updatedAt: updatedAt.toISOString(),
      updatedAtTs: Timestamp.fromDate(updatedAt)
    });

    await logSecurityEvent({
      userId,
      action: 'mfa_totp_invalid',
      metadata: { otpEnrollmentId: enrollmentId, attempts: updatedAttempts, context: 'self_service' },
      ipAddress
    });

    const error = new Error('Código do autenticador inválido.');
    error.statusCode = 401;
    throw error;
  }

  const now = new Date();
  const nowIso = now.toISOString();
  const emailConfiguredAt = ensureEmailMfaConfiguredAt(user, nowIso);

  await database.updateDocument(USERS_COLLECTION, userId, {
    updatedAt: nowIso,
    mfaEnabled: true,
    mfaConfiguredAt: nowIso,
    mfa: {
      enforcedMethods: ENFORCED_MFA_METHODS,
      email: {
        delivery: 'email',
        configuredAt: emailConfiguredAt
      },
      otp: {
        configuredAt: nowIso,
        secret: enrollment.encryptedSecret,
        issuer: enrollment.issuer ?? settings.mfaIssuer,
        accountName: enrollment.accountName ?? user.email
      }
    }
  });

  await database.deleteDocument(OTP_ENROLLMENTS_COLLECTION, enrollmentId).catch(() => undefined);

  await logSecurityEvent({
    userId,
    action: 'mfa_totp_configured',
    metadata: { method: 'otp', issuer: enrollment.issuer ?? settings.mfaIssuer, context: 'self_service' },
    ipAddress
  });

  const refreshedUser = await getUserById(userId);
  return sanitizeUser(refreshedUser);
};

export const requestPasswordReset = async ({ email }) => {
  const normalizedEmail = normalizeEmail(email);
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
  const now = new Date();
  const expiresAt = new Date(now.getTime() + settings.passwordResetTtlSeconds * 1000);
  const tokenId = uuid();

  await database.setDocument(TOKENS_COLLECTION, tokenId, {
    id: tokenId,
    userId: user.id,
    tokenHash,
    type: 'password_reset',
    expiresAt: expiresAt.toISOString(),
    expiresAtTs: Timestamp.fromDate(expiresAt),
    revoked: false,
    createdAt: now.toISOString(),
    createdAtTs: Timestamp.fromDate(now)
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
  const record = await database.get(TOKENS_COLLECTION, (collectionRef) =>
    collectionRef
      .where('tokenHash', '==', tokenHash)
      .where('type', '==', 'password_reset')
      .limit(1)
  );

  if (!record) {
    throw new Error('Token inválido.');
  }

  if (record.revoked) {
    throw new Error('Token já utilizado.');
  }

  const expiresAtDate = record.expiresAtTs
    ? record.expiresAtTs.toDate()
    : new Date(record.expiresAt);

  if (expiresAtDate.getTime() <= Date.now()) {
    throw new Error('Token expirado.');
  }

  const user = await getUserById(record.userId);

  if (!user) {
    throw new Error('Usuário não encontrado.');
  }

  const passwordHash = await hashPassword(newPassword);
  const now = new Date();
  const nowIso = now.toISOString();
  const passwordExpiresAt = calculatePasswordExpiry();

  await database.updateDocument(USERS_COLLECTION, record.userId, {
    passwordHash,
    lastPasswordChange: nowIso,
    passwordExpiresAt,
    updatedAt: nowIso
  });

  await database.updateDocument(TOKENS_COLLECTION, record.id, {
    revoked: true,
    revokedAt: nowIso,
    revokedAtTs: Timestamp.fromDate(now)
  });

  await logSecurityEvent({
    userId: record.userId,
    action: 'password_reset_completed'
  });
};

export const getUserProfile = async (userId) => {
  const user = await getUserById(userId);

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
  const user = await getUserById(userId);

  if (!user) {
    throw new Error('Usuário não encontrado.');
  }

  const now = new Date();
  const nowIso = now.toISOString();
  const consent = Boolean(consentGiven);
  const updates = {
    fullName: fullName?.trim() ?? null,
    phone: phone?.trim() ?? null,
    consentGiven: consent,
    updatedAt: nowIso
  };

  if (consent) {
    updates.consentTimestamp = user.consentTimestamp ?? nowIso;
  }

  await database.updateDocument(USERS_COLLECTION, userId, updates);

  await logSecurityEvent({
    userId,
    action: 'user_profile_updated',
    metadata: { consentGiven: consent }
  });

  return getUserProfile(userId);
};

export const listUsers = async () => {
  const docs = await database.all(USERS_COLLECTION, (collectionRef) =>
    collectionRef.orderBy('createdAtTs', 'desc')
  );

  return docs.map((doc) => sanitizeUser(mapUserDocument(doc)));
};

export const updateUserRole = async ({ actorUserId, targetUserId, role }) => {
  const normalizedRole = role === 'Admin' ? 'Admin' : 'User';
  const actor = await getUserById(actorUserId);

  if (!actor || actor.role !== 'Admin') {
    const error = new Error('Apenas administradores podem alterar perfis de acesso.');
    error.statusCode = 403;
    throw error;
  }

  const target = await getUserById(targetUserId);

  if (!target) {
    const error = new Error('Usuário alvo não encontrado.');
    error.statusCode = 404;
    throw error;
  }

  const now = new Date();
  const nowIso = now.toISOString();

  await database.updateDocument(USERS_COLLECTION, targetUserId, {
    role: normalizedRole,
    updatedAt: nowIso
  });

  await logSecurityEvent({
    userId: targetUserId,
    action: 'user_role_updated',
    metadata: {
      actorId: actorUserId,
      role: normalizedRole
    }
  });

  return getUserProfile(targetUserId);
};

export const requestDataDeletion = async ({ userId, reason }) => {
  const now = new Date().toISOString();

  await database.updateDocument(USERS_COLLECTION, userId, {
    deletionRequested: true,
    updatedAt: now
  });

  await logSecurityEvent({
    userId,
    action: 'data_deletion_requested',
    metadata: { reason }
  });
};
