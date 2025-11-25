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
  dbPath: process.env.DB_PATH ?? path.join(backendRoot, 'db.sqlite'),
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
  logLevel: process.env.LOG_LEVEL ?? 'info'
};
