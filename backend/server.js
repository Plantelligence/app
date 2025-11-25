import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { settings } from './config/settings.js';
import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import cryptoRoutes from './routes/cryptoRoutes.js';
import { logSecurityEvent } from './logs/logger.js';
import { initializeAuthService } from './auth/authService.js';

const app = express();

app.use(helmet());
app.use(
  cors({
    origin: settings.frontendOrigin,
    credentials: true
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

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/crypto', cryptoRoutes);

app.use((req, res) => res.status(404).json({ message: 'Endpoint não encontrado.' }));

app.use((err, req, res, _next) => {
  // eslint-disable-next-line no-console
  console.error('Unhandled error', err);
  res.status(500).json({ message: 'Erro interno.' });
});

let serverInstance;

export const startServer = async () => {
  if (serverInstance) {
    return serverInstance;
  }

  try {
    await initializeAuthService();
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to initialize backend services', error);
    throw error;
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

  return serverInstance;
};

if (process.env.VERCEL !== '1') {
  startServer().catch((error) => {
    // eslint-disable-next-line no-console
    console.error('Unhandled startup error', error);
    process.exit(1);
  });
}

export { app };
export default app;

