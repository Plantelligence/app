import { Router } from 'express';
import { authenticate } from '../middleware/authMiddleware.js';
import { requireRole } from '../middleware/roleMiddleware.js';
import { database } from '../services/database.js';
import {
  listUsers,
  updateUserRole
} from '../auth/authService.js';
import {
  listGreenhousesForAdmin,
  getGreenhouseForAdmin,
  updateGreenhouseTeam
} from '../services/greenhouseService.js';

const router = Router();

router.get('/secure-data', authenticate, requireRole('Admin'), async (req, res) => {
  const totalUsers = await database.count('users');
  return res.json({
    message: 'Acesso concedido apenas a administradores.',
    metrics: {
      totalUsers: totalUsers ?? 0
    }
  });
});

router.get('/users', authenticate, requireRole('Admin'), async (_req, res) => {
  try {
    const users = await listUsers();
    return res.json({ users });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

router.put('/users/:userId/role', authenticate, requireRole('Admin'), async (req, res) => {
  try {
    const user = await updateUserRole({
      actorUserId: req.user.id,
      targetUserId: req.params.userId,
      role: req.body?.role
    });
    return res.json({ user });
  } catch (error) {
    return res.status(error.statusCode ?? 400).json({ message: error.message });
  }
});

router.get('/users/:userId/greenhouses', authenticate, requireRole('Admin'), async (req, res) => {
  try {
    const greenhouses = await listGreenhousesForAdmin(req.params.userId);
    return res.json({ greenhouses });
  } catch (error) {
    return res.status(error.statusCode ?? 500).json({ message: error.message });
  }
});

router.get('/greenhouse/:greenhouseId', authenticate, requireRole('Admin'), async (req, res) => {
  try {
    const greenhouse = await getGreenhouseForAdmin(req.params.greenhouseId);
    return res.json({ greenhouse });
  } catch (error) {
    return res.status(error.statusCode ?? 400).json({ message: error.message });
  }
});

router.put('/greenhouse/:greenhouseId/team', authenticate, requireRole('Admin'), async (req, res) => {
  try {
    const greenhouse = await updateGreenhouseTeam({
      actorUserId: req.user.id,
      greenhouseId: req.params.greenhouseId,
      watcherIds: req.body?.watcherIds ?? []
    });
    return res.json({ greenhouse });
  } catch (error) {
    return res.status(error.statusCode ?? 400).json({ message: error.message });
  }
});

export default router;
