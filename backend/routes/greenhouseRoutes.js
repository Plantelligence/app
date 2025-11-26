import { Router } from 'express';
import { authenticate } from '../middleware/authMiddleware.js';
import {
  listFlowerProfiles,
  listGreenhouses,
  createGreenhouse,
  getGreenhouseForOwner,
  updateGreenhouseBasics,
  updateAlertSettings,
  deleteGreenhouse,
  evaluateAndHandleGreenhouseMetrics
} from '../services/greenhouseService.js';

const router = Router();

router.get('/recommendations', authenticate, (req, res) => {
  return res.json({ profiles: listFlowerProfiles() });
});

router.get('/', authenticate, async (req, res) => {
  try {
    const greenhouses = await listGreenhouses(req.user.id);
    return res.json({ greenhouses });
  } catch (error) {
    return res.status(error.statusCode ?? 500).json({ message: error.message });
  }
});

router.post('/', authenticate, async (req, res) => {
  try {
    const greenhouse = await createGreenhouse({
      ownerId: req.user.id,
      name: req.body?.name,
      flowerProfileId: req.body?.flowerProfileId ?? null
    });
    return res.status(201).json({ greenhouse });
  } catch (error) {
    return res.status(error.statusCode ?? 400).json({ message: error.message });
  }
});

router.get('/:greenhouseId', authenticate, async (req, res) => {
  try {
    const greenhouse = await getGreenhouseForOwner({
      greenhouseId: req.params.greenhouseId,
      ownerId: req.user.id
    });
    return res.json({ greenhouse });
  } catch (error) {
    return res.status(error.statusCode ?? 500).json({ message: error.message });
  }
});

router.put('/:greenhouseId', authenticate, async (req, res) => {
  try {
    const greenhouse = await updateGreenhouseBasics({
      greenhouseId: req.params.greenhouseId,
      ownerId: req.user.id,
      name: req.body?.name,
      flowerProfileId: req.body?.flowerProfileId
    });
    return res.json({ greenhouse });
  } catch (error) {
    return res.status(error.statusCode ?? 400).json({ message: error.message });
  }
});

router.delete('/:greenhouseId', authenticate, async (req, res) => {
  try {
    const result = await deleteGreenhouse({
      greenhouseId: req.params.greenhouseId,
      ownerId: req.user.id
    });
    return res.json(result);
  } catch (error) {
    return res.status(error.statusCode ?? 400).json({ message: error.message });
  }
});

router.patch('/:greenhouseId/alerts', authenticate, async (req, res) => {
  try {
    const greenhouse = await updateAlertSettings({
      greenhouseId: req.params.greenhouseId,
      ownerId: req.user.id,
      alertsEnabled: req.body?.alertsEnabled
    });
    return res.json({ greenhouse });
  } catch (error) {
    return res.status(error.statusCode ?? 400).json({ message: error.message });
  }
});

router.post('/:greenhouseId/evaluate', authenticate, async (req, res) => {
  try {
    const result = await evaluateAndHandleGreenhouseMetrics({
      greenhouseId: req.params.greenhouseId,
      ownerId: req.user.id,
      metrics: req.body?.metrics ?? {},
      notify: Boolean(req.body?.notify),
      forceNotify: Boolean(req.body?.forceNotify)
    });
    return res.json(result);
  } catch (error) {
    return res.status(error.statusCode ?? 400).json({ message: error.message });
  }
});

export default router;
