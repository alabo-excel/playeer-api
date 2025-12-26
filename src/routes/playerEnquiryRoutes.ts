import { Router } from 'express';
import { createEnquiry, getEnquiries, getEnquiry } from '../controllers/playerEnquiry';

const router = Router();

// Public - submit a player enquiry
router.post('/player-enquiries', createEnquiry);

// Public - list enquiries (pagination, filter by playerId/email)
router.get('/player-enquiries', getEnquiries);

// Public - get single enquiry
router.get('/player-enquiries/:id', getEnquiry);

export default router;
