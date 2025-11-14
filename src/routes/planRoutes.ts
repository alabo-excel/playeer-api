import { Router } from 'express';
import {
    createPlan,
    getAllPlans,
    getActivePlans,
    getPlanById,
    updatePlan,
    togglePlanStatus,
    deletePlan,
    setPlanPopular,
    getPlanStats,
    syncPlanWithPaystack
} from '../controllers/planController';
import { authenticateToken, authorizeRoles } from '../middlewares/authMiddleware';

const router = Router();

// Public routes (no authentication required)
// GET /api/plans/active - Get active plans for public display
router.get('/active', getActivePlans);

// GET /api/plans/:planId - Get specific plan details
router.get('/:planId', getPlanById);

// Protected routes (authentication required)
router.use(authenticateToken);

// Admin/Moderator only routes
// POST /api/plans - Create new plan (also creates on Paystack)
router.post('/', authorizeRoles('admin', 'moderator'), createPlan);

// GET /api/plans - Get all plans with filtering (admin can see inactive plans)
router.get('/', authorizeRoles('admin', 'moderator'), getAllPlans);

// PUT /api/plans/:planId - Update plan (also updates on Paystack)
router.put('/:planId', authorizeRoles('admin', 'moderator'), updatePlan);

// PATCH /api/plans/:planId/toggle-status - Toggle plan active status
router.patch('/:planId/toggle-status', authorizeRoles('admin', 'moderator'), togglePlanStatus);

// DELETE /api/plans/:planId - Soft delete plan (also deactivates on Paystack)
router.delete('/:planId', authorizeRoles('admin', 'moderator'), deletePlan);

// PATCH /api/plans/:planId/set-popular - Set plan as popular
router.patch('/:planId/set-popular', authorizeRoles('admin', 'moderator'), setPlanPopular);

// POST /api/plans/:planId/sync-paystack - Sync plan with Paystack
router.post('/:planId/sync-paystack', authorizeRoles('admin', 'moderator'), syncPlanWithPaystack);

// GET /api/plans/stats/overview - Get plan statistics
router.get('/stats/overview', authorizeRoles('admin', 'moderator'), getPlanStats);

export default router;