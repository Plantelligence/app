import fs from 'fs';
import crypto from 'crypto';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { cert, getApp, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const backendRoot = path.resolve(__dirname, '..');
const envPath = path.join(backendRoot, '.env');

dotenv.config({ path: envPath, override: false });
dotenv.config({ override: false });

const deriveTotpEncryptionKey = () => {
  const direct = process.env.MFA_TOTP_SECRET_KEY;

  if (direct) {
    try {
      const decoded = Buffer.from(direct, 'base64');
      if (decoded.length === 32) {
        return decoded;
      }
    } catch (error) {
      // Fallback below if base64 parsing fails
    }

    if (direct.length >= 32) {
      return crypto.createHash('sha256').update(direct).digest();
    }
  }

  const fallback = process.env.JWT_SECRET ?? 'change-me-in-production';
  return crypto.createHash('sha256').update(fallback).digest();
};

export const settings = {
  port: Number.parseInt(process.env.PORT ?? '4000', 10),
  frontendOrigin: process.env.FRONTEND_ORIGIN ?? 'http://localhost:5173',
  jwtSecret: process.env.JWT_SECRET ?? 'change-me-in-production',
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET ?? 'change-refresh-secret',
  passwordResetSecret: process.env.PASSWORD_RESET_SECRET ?? 'change-password-reset-secret',
  accessTokenTtlSeconds: Number.parseInt(process.env.ACCESS_TOKEN_TTL_SECONDS ?? '900', 10),
  refreshTokenTtlSeconds: Number.parseInt(process.env.REFRESH_TOKEN_TTL_SECONDS ?? '604800', 10),
  passwordResetTtlSeconds: Number.parseInt(process.env.PASSWORD_RESET_TTL_SECONDS ?? '900', 10),
  passwordExpiryDays: Number.parseInt(process.env.PASSWORD_EXPIRY_DAYS ?? '90', 10),
  rateLimitWindowMs: Number.parseInt(process.env.RATE_LIMIT_WINDOW_MS ?? '60000', 10),
  rateLimitMax: Number.parseInt(process.env.RATE_LIMIT_MAX ?? '5', 10),
  logLevel: process.env.LOG_LEVEL ?? 'info',
  firebaseProjectId: process.env.FIREBASE_PROJECT_ID ?? null,
  firestoreEmulatorHost: process.env.FIRESTORE_EMULATOR_HOST ?? null,
  useFirestoreEmulator:
    (process.env.FIREBASE_USE_EMULATOR ?? '').toLowerCase() === 'true' ||
    Boolean(process.env.FIRESTORE_EMULATOR_HOST),
  smtp: {
    host: process.env.SMTP_HOST ?? 'smtp.office365.com',
    port: Number.parseInt(process.env.SMTP_PORT ?? '587', 10),
    secure: (process.env.SMTP_SECURE ?? 'false').toLowerCase() === 'true',
    user: process.env.SMTP_USER ?? null,
    password: process.env.SMTP_PASSWORD ?? null,
    from: process.env.SMTP_FROM ?? process.env.SMTP_USER ?? null
  },
  mfaDebugMode: (process.env.MFA_DEBUG_MODE ?? 'false').toLowerCase() === 'true',
  mfaIssuer: process.env.MFA_ISSUER ?? 'Plantelligence'
};

settings.mfaTotpEncryptionKey = deriveTotpEncryptionKey();

let cachedServiceAccount;
let cachedCredential;
let cachedApp;
let cachedFirestore;

const buildCredentialsFromEnv = () => {
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL ?? null;
  const privateKeyRaw = process.env.FIREBASE_PRIVATE_KEY ?? null;

  if (!clientEmail || !privateKeyRaw) {
    return null;
  }

  const normalizePrivateKey = privateKeyRaw.includes('\\n')
    ? privateKeyRaw.replace(/\\n/g, '\n')
    : privateKeyRaw;

  const credential = {
    type: process.env.FIREBASE_TYPE ?? 'service_account',
    project_id: process.env.FIREBASE_PROJECT_ID ?? undefined,
    private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID ?? undefined,
    private_key: normalizePrivateKey,
    client_email: clientEmail,
    client_id: process.env.FIREBASE_CLIENT_ID ?? undefined,
    auth_uri: process.env.FIREBASE_AUTH_URI ?? 'https://accounts.google.com/o/oauth2/auth',
    token_uri: process.env.FIREBASE_TOKEN_URI ?? 'https://oauth2.googleapis.com/token',
    auth_provider_x509_cert_url:
      process.env.FIREBASE_AUTH_PROVIDER_X509_CERT_URL ?? 'https://www.googleapis.com/oauth2/v1/certs',
    client_x509_cert_url: process.env.FIREBASE_CLIENT_X509_CERT_URL ?? undefined,
    universe_domain: process.env.FIREBASE_UNIVERSE_DOMAIN ?? 'googleapis.com'
  };

  return JSON.stringify(
    Object.fromEntries(
      Object.entries(credential).filter(([, value]) => value !== undefined && value !== null)
    )
  );
};

const resolveCredentialsSource = () => {
  const inline = process.env.FIREBASE_CREDENTIALS;
  if (inline) {
    return inline;
  }

  const fileEnv = process.env.FIREBASE_CREDENTIALS_FILE;
  if (fileEnv) {
    const resolvedPath = path.isAbsolute(fileEnv)
      ? fileEnv
      : path.resolve(backendRoot, fileEnv);

    if (!fs.existsSync(resolvedPath)) {
      throw new Error(`FIREBASE_CREDENTIALS_FILE not found at path: ${resolvedPath}`);
    }

    return fs.readFileSync(resolvedPath, 'utf8');
  }

  return buildCredentialsFromEnv();
};

const coerceFirebaseJson = (raw) => {
  if (!raw) {
    return null;
  }

  let candidate = raw.trim();

  if (!candidate) {
    return null;
  }

  if (candidate.startsWith('"') && candidate.endsWith('"')) {
    const unwrapped = candidate.slice(1, -1).replace(/\\"/g, '"');
    candidate = unwrapped;
  }

  if (candidate.startsWith('{')) {
    return candidate;
  }

  try {
    const decoded = Buffer.from(candidate, 'base64').toString('utf8').trim();
    if (decoded.startsWith('{')) {
      return decoded;
    }
  } catch (error) {
    // Ignore and fall through to throw below
  }

  throw new Error('Firebase credentials must be provided as JSON or base64 encoded JSON.');
};

const parseFirebaseCredentials = () => {
  if (settings.useFirestoreEmulator) {
    return null;
  }

  if (cachedServiceAccount) {
    return cachedServiceAccount;
  }

  const raw = resolveCredentialsSource();

  if (!raw) {
    settings.useFirestoreEmulator = true;
    if (!settings.firestoreEmulatorHost) {
      settings.firestoreEmulatorHost = 'localhost:8080';
    }
    return null;
  }

  try {
    const jsonPayload = coerceFirebaseJson(raw);
    if (!jsonPayload) {
      return null;
    }

    const parsed = JSON.parse(jsonPayload);

    if (typeof parsed.private_key === 'string' && parsed.private_key.includes('\\n')) {
      parsed.private_key = parsed.private_key.replace(/\\n/g, '\n');
    }

    cachedServiceAccount = parsed;
    settings.firebaseProjectId = settings.firebaseProjectId ?? parsed.project_id ?? null;

    return parsed;
  } catch (error) {
    throw new Error(`Failed to parse FIREBASE_CREDENTIALS: ${error.message}`);
  }
};

const getFirebaseCredential = () => {
  if (settings.useFirestoreEmulator) {
    return null;
  }

  if (cachedCredential) {
    return cachedCredential;
  }

  const serviceAccount = parseFirebaseCredentials();

  if (!serviceAccount) {
    return null;
  }

  if (!serviceAccount.client_email || !serviceAccount.private_key) {
    throw new Error('Firebase credentials must include client_email and private_key.');
  }

  cachedCredential = cert({
    projectId: serviceAccount.project_id,
    clientEmail: serviceAccount.client_email,
    privateKey: serviceAccount.private_key
  });

  return cachedCredential;
};

export const getFirebaseApp = () => {
  if (cachedApp) {
    return cachedApp;
  }

  if (getApps().length > 0) {
    cachedApp = getApp();
    return cachedApp;
  }

  const serviceAccount = parseFirebaseCredentials();
  const credential = getFirebaseCredential();
  const projectId = settings.firebaseProjectId ?? serviceAccount?.project_id ?? 'plantelligence-local';

  if (settings.useFirestoreEmulator) {
    if (!settings.firestoreEmulatorHost) {
      settings.firestoreEmulatorHost = 'localhost:8080';
    }

      process.env.FIRESTORE_EMULATOR_HOST = settings.firestoreEmulatorHost;
      process.env.GOOGLE_CLOUD_PROJECT = projectId;
      settings.firebaseProjectId = projectId;
    cachedApp = initializeApp({ projectId });
    return cachedApp;
  }

  cachedApp = initializeApp({
      credential,
      projectId
  });

    settings.firebaseProjectId = projectId;
  return cachedApp;
};

export const getFirestoreDb = () => {
  if (cachedFirestore) {
    return cachedFirestore;
  }

  cachedFirestore = getFirestore(getFirebaseApp());
  return cachedFirestore;
};
