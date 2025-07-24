import { Router } from 'express';
import {
  completeOnboarding,
  getOnboardingStatus,
  updatePlan,
  addFootballJourneyEntry,
  editFootballJourneyEntry,
  deleteFootballJourneyEntry,
  addAchievement,
  editAchievement,
  deleteAchievement,
  addCertificate,
  editCertificate,
  deleteCertificate,
  getPublicProfileData
} from '../controllers/onboardingController';
import { authenticateToken } from '../middlewares/authMiddleware';
import { upload } from '../middlewares/multer';

const router = Router();

// Public route for viewing profile data
router.get('/public-profile/:userId', getPublicProfileData);

// All subsequent routes require authentication
router.use(authenticateToken);

// Onboarding and profile management
router.post('/complete', upload.single('profilePicture'), completeOnboarding);
router.get('/status', getOnboardingStatus);
router.patch('/field', authenticateToken, updatePlan);

// Football journey
router.post('/journey', addFootballJourneyEntry);
router.put('/journey', editFootballJourneyEntry);
router.delete('/journey/:id', deleteFootballJourneyEntry);

// Achievements
router.post('/achievement', upload.single('photo'), addAchievement);
router.put('/achievement', editAchievement);
router.delete('/achievement/:id', deleteAchievement);

// Certificates
router.post('/certificate', upload.single('photo'), addCertificate);
router.put('/certificate', editCertificate);
router.delete('/certificate/:id', deleteCertificate);

export default router; 