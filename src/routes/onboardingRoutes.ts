import { Router } from 'express';
import {
  completeOnboarding,
  getOnboardingStatus,
  updateOnboardingField,
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
router.patch('/field', updateOnboardingField);

// Football journey
router.post('/journey', addFootballJourneyEntry);
router.put('/journey', editFootballJourneyEntry);
router.delete('/journey', deleteFootballJourneyEntry);

// Achievements
router.post('/achievement', upload.single('photo'), addAchievement);
router.put('/achievement', editAchievement);
router.delete('/achievement', deleteAchievement);

// Certificates
router.post('/certificate', upload.single('photo'), addCertificate);
router.put('/certificate', editCertificate);
router.delete('/certificate', deleteCertificate);

export default router; 