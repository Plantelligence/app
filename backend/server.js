import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { resolve as pathResolve } from 'path';
import { fileURLToPath } from 'url';
import { settings, getFirebaseApp } from './config/settings.js';
import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import cryptoRoutes from './routes/cryptoRoutes.js';
import greenhouseRoutes from './routes/greenhouseRoutes.js';
import { cleanupExpiredTokens } from './auth/tokenService.js';
import { logSecurityEvent } from './logs/logger.js';

// Ensure Firebase is initialised early for both local and serverless runtimes.
getFirebaseApp();

const app = express();

app.use(helmet());
const allowedOrigins = (settings.frontendOrigin ?? '')
  .split(',')
  .map((entry) => entry.trim())
  .filter(Boolean);

app.use(
  cors({
    credentials: true,
    origin: (origin, callback) => {
      if (!origin) {
        callback(null, true);
        return;
      }

      const isAllowed =
        allowedOrigins.length === 0 ||
        allowedOrigins.some((allowed) => {
          if (allowed === '*') {
            return true;
          }
          if (allowed.startsWith('http://') || allowed.startsWith('https://')) {
            return allowed === origin;
          }
          return origin.includes(allowed);
        });

      callback(isAllowed ? null : new Error('Origin not allowed by CORS'), isAllowed);
    }
  })
);
app.use(express.json());

app.use(async (req, res, next) => {
  res.on('finish', () => {
    if (res.statusCode >= 400) {
      logSecurityEvent({
        action: 'http_error',
        metadata: {
          method: req.method,
          path: req.path,
          status: res.statusCode
        },
        ipAddress: req.ip
      }).catch(() => undefined);
    }
  });
  next();
});

app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/crypto', cryptoRoutes);
app.use('/api/greenhouse', greenhouseRoutes);

app.use((req, res) => res.status(404).json({ message: 'Endpoint não encontrado.' }));

app.use((err, req, res, _next) => {
  // eslint-disable-next-line no-console
  console.error('Unhandled error', err);
  res.status(500).json({ message: 'Erro interno.' });
});

const isServerlessRuntime = Boolean(process.env.VERCEL || process.env.SERVERLESS);
let serverInstance;

const startHttpServer = () => {
  if (serverInstance) {
    return;
  }

  serverInstance = app.listen(settings.port, () => {
    // eslint-disable-next-line no-console
    console.log(`Plantelligence backend listening on port ${settings.port}`);
  });

  process.on('SIGINT', () => {
    serverInstance?.close(() => {
      process.exit(0);
    });
  });

  setInterval(() => {
    cleanupExpiredTokens().catch(() => undefined);
  }, 60_000);
};

const currentModulePath = fileURLToPath(import.meta.url);
const entryPointPath = process.argv[1] ? pathResolve(process.argv[1]) : null;

if (!isServerlessRuntime && entryPointPath === currentModulePath) {
  startHttpServer();
}

export const handler = app;
export default app;
