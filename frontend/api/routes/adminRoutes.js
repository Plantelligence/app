import { Router } from 'express';
import { authenticate } from '../middleware/authMiddleware.js';
import { requireRole } from '../middleware/roleMiddleware.js';
import { database } from '../services/database.js';

const router = Router();

router.get('/secure-data', authenticate, requireRole('Admin'), async (_req, res) => {
  const totalUsers = await database.count('users');
  return res.json({
    message: 'Acesso concedido apenas a administradores.',
    metrics: {
      totalUsers
    }
  });
});

export default router;
