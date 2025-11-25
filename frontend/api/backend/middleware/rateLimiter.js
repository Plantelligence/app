import rateLimit from 'express-rate-limit';
import { settings } from '../config/settings.js';

export const loginRateLimiter = rateLimit({
  windowMs: settings.rateLimitWindowMs,
  max: settings.rateLimitMax,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: 'Muitas tentativas de login. Tente novamente em instantes.'
  }
});
