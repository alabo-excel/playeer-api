import { Router } from 'express';
import {
  getAllUsers,
  getUserById,
  updateUser,
  deleteUser,
  getUserProfile,
  updateUserProfile,
  getUsersByRole,
  getActiveUsers,
  setActiveStatus,
  softDeleteUser,
  selfDeactivateAccount,
  selfDeleteAccount,
  getActiveNotDeletedUsers,
  viewProfile
} from '../controllers/userController';
import { authenticateToken, authorizeRoles } from '../middlewares/authMiddleware';
import { upload } from '../middlewares/multer';

const router = Router();

// Apply authentication middleware to all user routes
router.use(authenticateToken);

// Protected routes (require authentication)
router.get('/', authenticateToken, getAllUsers);
router.get('/profile', authenticateToken, getUserProfile);
router.put('/profile', upload.single('profilePicture'), updateUserProfile);
router.get('/active', authenticateToken, getActiveUsers);
// Get all active and not deleted users
router.get('/active-not-deleted', authenticateToken, getActiveNotDeletedUsers);
router.get('/role/:role', authenticateToken, getUsersByRole);

// View a user's profile (requires authentication)
router.get('/view/:userId', authenticateToken, viewProfile);

// User self-service routes
router.patch('/me/deactivate', authenticateToken, selfDeactivateAccount);
router.patch('/me/soft-delete', authenticateToken, selfDeleteAccount);

// Admin routes (require admin role)
router.get('/:id', authenticateToken, authorizeRoles('admin'), getUserById);
router.put('/:id', authenticateToken, authorizeRoles('admin'), updateUser);
router.delete('/:id', authenticateToken, authorizeRoles('admin'), deleteUser);
router.patch('/:id/active', authenticateToken, authorizeRoles('admin'), setActiveStatus);
router.patch('/:id/soft-delete', authenticateToken, authorizeRoles('admin'), softDeleteUser);

export default router; 