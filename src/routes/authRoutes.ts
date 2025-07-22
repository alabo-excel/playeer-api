import { Router } from 'express';
import {
  register,
  login,
  changePassword,
  forgotPassword,
  resetPassword,
  logout
} from '../controllers/authController';
import { authenticateToken } from '../middlewares/authMiddleware';

const router = Router();

// Public routes
router.post('/register', register);
router.post('/login', login);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);
router.post('/logout', logout);

// Protected routes (require authentication)
router.put('/change-password', authenticateToken, changePassword);

export default router; 