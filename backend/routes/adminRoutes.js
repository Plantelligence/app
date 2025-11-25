import { Router } from 'express';
import { authenticate } from '../middleware/authMiddleware.js';
import { requireRole } from '../middleware/roleMiddleware.js';
import { database } from '../services/database.js';

const router = Router();

router.get('/secure-data', authenticate, requireRole('Admin'), async (req, res) => {
  const userCountRow = await database.get('SELECT COUNT(1) as total FROM users');
  return res.json({
    message: 'Acesso concedido apenas a administradores.',
    metrics: {
      totalUsers: userCountRow?.total ?? 0
    }
  });
});

export default router;
