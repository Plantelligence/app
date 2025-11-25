import { Router } from 'express';
import { authenticate } from '../middleware/authMiddleware.js';
import {
  getCommunicationPublicKey,
  simulateSecureMessage,
  verifySecureMessage
} from '../crypto/communicationService.js';

const router = Router();

router.get('/public-key', authenticate, (req, res) =>
  res.json({ publicKey: getCommunicationPublicKey() })
);

router.post('/simulate', authenticate, (req, res) => {
  const { message } = req.body;
  if (!message) {
    return res.status(400).json({ message: 'Mensagem é obrigatória.' });
  }

  const simulation = simulateSecureMessage(message);
  return res.json({
    ...simulation,
    verification: verifySecureMessage(simulation)
  });
});

export default router;
