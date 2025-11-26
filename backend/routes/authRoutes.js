import { Router } from 'express';
import {
  registerUser,
  confirmRegistrationEmail,
  finalizeRegistration,
  loginUser,
  initiateMfaMethod,
  refreshSession,
  revokeSession,
  requestPasswordReset,
  resetPassword,
  completeMfa
} from '../auth/authService.js';
import { loginRateLimiter } from '../middleware/rateLimiter.js';

const router = Router();

router.post('/register', async (req, res) => {
  try {
    const result = await registerUser(req.body);
    return res.status(201).json(result);
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
});

router.post('/register/confirm', async (req, res) => {
  try {
    const { challengeId, code } = req.body;
    const response = await confirmRegistrationEmail({ challengeId, code, ipAddress: req.ip });
    return res.json(response);
  } catch (error) {
    return res.status(error.statusCode ?? 400).json({ message: error.message });
  }
});

router.post('/register/otp', async (req, res) => {
  try {
    const { otpSetupId, otpCode } = req.body;
    const user = await finalizeRegistration({ otpSetupId, otpCode, ipAddress: req.ip });
    return res.json({ user });
  } catch (error) {
    return res.status(error.statusCode ?? 400).json({ message: error.message });
  }
});

router.post('/login', loginRateLimiter, async (req, res) => {
  try {
    const result = await loginUser({
      ...req.body,
      ipAddress: req.ip
    });

    if (result.mfaRequired) {
      return res.json(result);
    }

    return res.json({ mfaRequired: false });
  } catch (error) {
    return res.status(401).json({ message: error.message });
  }
});

router.post('/mfa/initiate', async (req, res) => {
  try {
    const { sessionId, method } = req.body;
    const result = await initiateMfaMethod({ sessionId, method, ipAddress: req.ip });
    return res.json(result);
  } catch (error) {
    return res.status(error.statusCode ?? 400).json({ message: error.message });
  }
});

router.post('/mfa/verify', async (req, res) => {
  try {
    const { sessionId, method, code, otpEnrollmentId } = req.body;
    const result = await completeMfa({
      sessionId,
      method,
      code,
      otpEnrollmentId,
      ipAddress: req.ip
    });

    return res.json({
      user: result.user,
      tokens: {
        accessToken: result.tokens.access.token,
        accessExpiresAt: result.tokens.access.expiresAt,
        accessJti: result.tokens.access.jti,
        refreshToken: result.tokens.refresh.token,
        refreshExpiresAt: result.tokens.refresh.expiresAt,
        refreshJti: result.tokens.refresh.jti
      },
      passwordExpired: result.passwordExpired
    });
  } catch (error) {
    return res.status(error.statusCode ?? 400).json({ message: error.message });
  }
});

router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    const result = await refreshSession({ refreshToken });
    return res.json({
      user: result.user,
      tokens: {
        accessToken: result.tokens.access.token,
        accessExpiresAt: result.tokens.access.expiresAt,
        accessJti: result.tokens.access.jti,
        refreshToken: result.tokens.refresh.token,
        refreshExpiresAt: result.tokens.refresh.expiresAt,
        refreshJti: result.tokens.refresh.jti
      }
    });
  } catch (error) {
    return res.status(401).json({ message: error.message });
  }
});

router.post('/logout', async (req, res) => {
  try {
    const { refreshToken, accessJti, userId } = req.body;
    await revokeSession({ refreshToken, accessJti, userId });
    return res.status(204).end();
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
});

router.post('/password-reset/request', async (req, res) => {
  try {
    const result = await requestPasswordReset(req.body);
    return res.json({ message: 'Se existir uma conta, o e-mail de recuperação foi enviado.', mock: result });
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
});

router.post('/password-reset/confirm', async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    await resetPassword({ token, newPassword });
    return res.json({ message: 'Senha redefinida com sucesso.' });
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
});

export default router;
