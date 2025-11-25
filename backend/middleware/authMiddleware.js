import { verifyAccessToken } from '../auth/tokenService.js';
import { getUserProfile } from '../auth/authService.js';

export const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Token de acesso ausente.' });
    }

    const token = authHeader.split(' ')[1];
    const payload = await verifyAccessToken(token);

    req.user = {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
      tokenJti: payload.jti,
      requiresPasswordReset: payload.requiresPasswordReset ?? false
    };

    if (!req.user.profile) {
      req.user.profile = await getUserProfile(req.user.id);
    }

    return next();
  } catch (error) {
    return res.status(401).json({ message: 'Token inválido ou expirado.' });
  }
};
