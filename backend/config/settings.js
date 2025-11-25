import * as fs from 'fs';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const backendRoot = path.resolve(__dirname, '..');
const envPath = path.join(backendRoot, '.env');

dotenv.config({ path: envPath, override: false });

dotenv.config({ override: false });

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
  firebaseCredentials: (() => {
    const parseJson = (rawValue) => {
      try {
        return JSON.parse(rawValue);
      } catch (error) {
        // eslint-disable-next-line no-console
        console.warn('Invalid Firebase credentials JSON detected.', error);
        return null;
      }
    };

    const envValue = process.env.FIREBASE_CREDENTIALS ?? process.env.FIREBASE_CREDENTIALS_BASE64;
    if (envValue) {
      const trimmed = envValue.trim();
      if (trimmed.startsWith('{')) {
        return parseJson(trimmed);
      }

      try {
        const decoded = Buffer.from(trimmed, 'base64').toString('utf8');
        return parseJson(decoded);
      } catch (error) {
        // eslint-disable-next-line no-console
        console.warn('Failed to decode FIREBASE_CREDENTIALS_BASE64 value.', error);
        return null;
      }
    }

    const localKeyPath = path.resolve(backendRoot, 'firebase-key.json');

    try {
      const fileContent = fs.readFileSync(localKeyPath, 'utf8');
      return parseJson(fileContent);
    } catch (error) {
      if (error.code === 'ENOENT') {
        // eslint-disable-next-line no-console
        console.warn('Local firebase-key.json not found. Set FIREBASE_CREDENTIALS to enable Firestore.');
        return null;
      }

      // eslint-disable-next-line no-console
      console.warn('Failed to load local firebase-key.json credentials.', error);
      return null;
    }
  })()
};
