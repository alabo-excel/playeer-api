import { Router } from 'express';
import {
  getAllUsers,
  getUserById,
  deleteUser,
  getUserProfile,
  updateUserProfile,
  setActiveStatus,
  softDeleteUser,
  selfDeactivateAccount,
  selfDeleteAccount,
  getActiveNotDeletedUsers,
  viewProfile,
  dismissWelcome,
  toggleVisibility,
  getAdminStats,
} from '../controllers/userController';
// Toggle user visibility (self or admin)
import { authenticateToken, authorizeRoles } from '../middlewares/authMiddleware';
import { upload } from '../middlewares/multer';

const router = Router();

// Apply authentication middleware to all user routes
// router.use(authenticateToken);

// Protected routes (require authentication)
router.get('/', authenticateToken, getAllUsers);
router.get('/profile', authenticateToken, getUserProfile);
router.put('/profile', upload.single('profilePicture'), updateUserProfile);
router.patch('/:id/visibility', authenticateToken, toggleVisibility);

// Get all active and not deleted users
router.get('/active-not-deleted', getActiveNotDeletedUsers);

// View a user's profile (requires authentication)
router.get('/view/:userId', authenticateToken, viewProfile);

// User self-service routes
router.patch('/me/deactivate', authenticateToken, selfDeactivateAccount);
router.patch('/me/soft-delete', authenticateToken, selfDeleteAccount);
router.patch('/dismiss-welcome', authenticateToken, dismissWelcome);

// Admin routes (require admin role)
router.get('/:id', authenticateToken, authorizeRoles('admin'), getUserById);
router.delete('/:id', authenticateToken, authorizeRoles('admin'), deleteUser);
router.patch('/:id/active', authenticateToken, authorizeRoles('admin'), setActiveStatus);
router.patch('/:id/soft-delete', authenticateToken, authorizeRoles('admin'), softDeleteUser);
router.get('/admin/stats', authenticateToken, authorizeRoles('admin', 'moderator'), getAdminStats);



export default router; 