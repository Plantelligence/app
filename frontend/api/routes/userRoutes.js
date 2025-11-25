import { Router } from 'express';
import {
  authenticate
} from '../middleware/authMiddleware.js';
import { requireRole } from '../middleware/roleMiddleware.js';
import {
  getUserProfile,
  updateUserProfile,
  changePassword,
  requestDataDeletion
} from '../auth/authService.js';
import { getSecurityLogs } from '../logs/logger.js';

const router = Router();

router.get('/me', authenticate, async (req, res) => {
  try {
    const profile = await getUserProfile(req.user.id);
    return res.json({ user: profile, requiresPasswordReset: req.user.requiresPasswordReset });
  } catch (error) {
    return res.status(404).json({ message: error.message });
  }
});

router.put('/me', authenticate, async (req, res) => {
  try {
    const updated = await updateUserProfile({
      userId: req.user.id,
      fullName: req.body.fullName,
      phone: req.body.phone,
      consentGiven: req.body.consentGiven
    });
    return res.json({ user: updated });
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
});

router.post('/change-password', authenticate, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    await changePassword({ userId: req.user.id, currentPassword, newPassword });
    return res.json({ message: 'Senha alterada com sucesso.' });
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
});

router.post('/deletion-request', authenticate, async (req, res) => {
  try {
    await requestDataDeletion({ userId: req.user.id, reason: req.body.reason });
    return res.json({ message: 'Solicitação de exclusão registrada.' });
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
});

router.get('/logs', authenticate, requireRole('Admin'), async (req, res) => {
  try {
    const logs = await getSecurityLogs(100);
    return res.json({ logs });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

export default router;
