import { Router } from 'express';
import { paystackWebhook } from '../controllers/paystackWebhookController';

const router = Router();

// Paystack webhook endpoint
router.post('/webhook', paystackWebhook);

export default router;
