import { Router } from 'express';
import {
  createHighlight,
  editHighlight,
  deleteHighlight,
  viewHighlight,
  getUserHighlights
} from '../controllers/highlightController';
import { authenticateToken } from '../middlewares/authMiddleware';
import { upload } from '../middlewares/multer';

const router = Router();

// Public route to get a user's highlights
router.get('/user/:userId', getUserHighlights);

// Authenticated routes
router.post('/', authenticateToken, upload.single('video'), createHighlight);
router.put('/:id', authenticateToken, upload.single('video'), editHighlight);
router.delete('/:id', authenticateToken, deleteHighlight);
router.get('/view/:id', viewHighlight);

export default router; 