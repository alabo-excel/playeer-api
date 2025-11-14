import { Router } from 'express';
import {
    getAllSubscribers,
    getActiveSubscribers,
    getSubscriptionStats,
    getExpiringSubscribers,
    cancelSubscription,
    reactivateSubscription,
    getSubscribersByStatus
} from '../controllers/subscriptionController';
import { authenticateToken, authorizeRoles } from '../middlewares/authMiddleware';

const router = Router();

// Apply authentication middleware to all subscription routes
router.use(authenticateToken);

// Routes that require admin/moderator access
router.get('/all', authorizeRoles('admin', 'moderator'), getAllSubscribers);
router.get('/active', authorizeRoles('admin', 'moderator'), getActiveSubscribers);
router.get('/stats', authorizeRoles('admin', 'moderator'), getSubscriptionStats);
router.get('/expiring', authorizeRoles('admin', 'moderator'), getExpiringSubscribers);
router.get('/status/:status', authorizeRoles('admin', 'moderator'), getSubscribersByStatus);

// Admin-only routes
router.post('/:userId/reactivate', authorizeRoles('admin', 'moderator'), reactivateSubscription);

// Routes accessible by users (for their own subscription) and admins
router.post('/:userId/cancel', cancelSubscription);

export default router;
