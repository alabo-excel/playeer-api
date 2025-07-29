import { Request, Response } from 'express';
import User, { IUser } from '../models/User';
import Highlight from '../models/Highlight';
import { Types } from 'mongoose';
import { uploadToCloudinary } from '../config/cloudinary';

// Complete onboarding process
export const completeOnboarding = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.id;
    const profilePicture = req.file;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
      return;
    }

    const {
      country,
      city,
      gender,
      height,
      weight,
      currentTeam,
      previousClub,
      yearsOfExperience,
      mainPosition,
      secondaryPosition,
      dominantFoot,
      jerseyNumber,
      plan,
      address,
      dateOfBirth
    } = req.body;

    // Validate required fields
    const requiredFields = ['country', 'city', 'gender', "address", 'height', 'weight', 'currentTeam', 'yearsOfExperience', 'mainPosition', 'dominantFoot', 'plan'];
    const missingFields = requiredFields.filter(field => !req.body[field]);

    if (missingFields.length > 0) {
      res.status(400).json({
        success: false,
        message: 'Missing required fields',
        missingFields
      });
      return;
    }

    // Validate enum values
    if (!['male', 'female', 'other'].includes(gender)) {
      res.status(400).json({
        success: false,
        message: 'Invalid gender value. Must be male, female, or other'
      });
      return;
    }

    if (!['left', 'right', 'both'].includes(dominantFoot)) {
      res.status(400).json({
        success: false,
        message: 'Invalid dominant foot value. Must be left, right, or both'
      });
      return;
    }

    if (!['free', 'monthly', 'yearly'].includes(plan)) {
      res.status(400).json({
        success: false,
        message: 'Invalid plan value. Must be free, monthly, or yearly'
      });
      return;
    }

    // Validate numeric fields
    if (typeof height !== 'string') {
      res.status(400).json({
        success: false,
        message: 'Height must be a string'
      });
      return;
    }

    if (typeof weight !== 'string') {
      res.status(400).json({
        success: false,
        message: 'Weight must be a string'
      });
      return;
    }

    if (typeof yearsOfExperience !== 'string') {
      res.status(400).json({
        success: false,
        message: 'Years of experience must be a string'
      });
      return;
    }

    if (jerseyNumber && typeof jerseyNumber !== 'string') {
      res.status(400).json({
        success: false,
        message: 'Jersey number must be a string'
      });
      return;
    }

    // Calculate renewal date based on plan
    let renewalDate: Date | undefined;
    if (plan !== 'free') {
      const now = new Date();
      if (plan === 'monthly') {
        renewalDate = new Date(now.getFullYear(), now.getMonth() + 1, now.getDate());
      } else if (plan === 'yearly') {
        renewalDate = new Date(now.getFullYear() + 1, now.getMonth(), now.getDate());
      }
    }

    // Prepare update object
    const updateData: any = {
      country,
      city,
      gender,
      height,
      weight,
      currentTeam,
      previousClub: previousClub || '',
      yearsOfExperience,
      mainPosition,
      secondaryPosition: secondaryPosition || '',
      dominantFoot,
      jerseyNumber,
      plan,
      dateOfBirth,
      renewalDate,
      address,
      isVerified: true
    };

    // If a file is uploaded, upload to Cloudinary and set profilePicture field
    if (profilePicture) {
      const uploadResult = await uploadToCloudinary(profilePicture.buffer, 'profile-pictures', 'image');
      updateData.profilePicture = uploadResult.url;
    }

    // Update user profile
    const user = await User.findByIdAndUpdate(
      userId,
      updateData,
      {
        new: true,
        runValidators: true
      }
    ).select('-password');

    if (!user) {
      res.status(404).json({
        success: false,
        message: 'User not found'
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'Onboarding completed successfully',
      data: user
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'ValidationError') {
      res.status(400).json({
        success: false,
        message: 'Validation error',
        error: error.message
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Error completing onboarding',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
};

// Get onboarding status
export const getOnboardingStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.id;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
      return;
    }

    const user = await User.findById(userId).select('-password');

    if (!user) {
      res.status(404).json({
        success: false,
        message: 'User not found'
      });
      return;
    }

    // Check which fields are completed
    const requiredFields = ['country', 'city', 'gender', 'height', 'weight', 'currentTeam', 'yearsOfExperience', 'mainPosition', 'dominantFoot', 'plan', 'dateOfBirth', 'address', 'profilePicture', 'previousClub', 'secondaryPosition', "jerseyNumber", "footballJourney", "achievements", "certificates", "username"];
    const completedFields = requiredFields.filter((field) => {
      const value = user[field as keyof IUser];

      if (Array.isArray(value)) {
        return value.length > 0;
      }

      return Boolean(value); // truthy check for strings, numbers, etc.
    });
    const isCompleted = completedFields.length === requiredFields.length;

    // Calculate total highlight views
    const highlights = await Highlight.find({ userId });
    const totalHighlightViews = highlights.reduce((sum, h) => sum + (h.views ? h.views.length : 0), 0);

    res.status(200).json({
      success: true,
      data: {
        totalViews: user?.profileViews?.length ?? 0,
        totalHighlightViews,
        progress: Math.round((completedFields.length / requiredFields.length) * 100)
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error getting onboarding status',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Update specific onboarding field
export const updatePlan = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.id;
    const { value } = req.body;

    if (!userId) {
      res.status(401).json({ success: false, message: 'User not authenticated' });
      return;
    }

    // Only allow updating the plan field
    if (!['monthly', 'yearly'].includes(value)) {
      res.status(400).json({
        success: false,
        message: 'Invalid plan value. Can only upgrade to monthly or yearly.'
      });
      return;
    }

    // Fetch user to check current plan
    const user = await User.findById(userId);
    if (!user) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }
    if (user.plan !== 'free') {
      res.status(403).json({
        success: false,
        message: 'You can only upgrade from the free plan.'
      });
      return;
    }

    // Calculate renewal date
    const now = new Date();
    let renewalDate: Date | undefined;
    if (value === 'monthly') {
      renewalDate = new Date(now.getFullYear(), now.getMonth() + 1, now.getDate());
    } else if (value === 'yearly') {
      renewalDate = new Date(now.getFullYear() + 1, now.getMonth(), now.getDate());
    }

    // Update only the plan and renewalDate
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { plan: value, renewalDate },
      { new: true, runValidators: true }
    ).select('-password');

    res.status(200).json({
      success: true,
      message: 'Plan updated successfully',
      data: updatedUser
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'ValidationError') {
      res.status(400).json({
        success: false,
        message: 'Validation error',
        error: error.message
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Error updating plan',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
};

// Add a football journey entry
export const addFootballJourneyEntry = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.id;
    const entry = req.body;

    if (!userId) {
      res.status(401).json({ success: false, message: 'User not authenticated' });
      return;
    }

    // Validate required fields
    const requiredFields = ['teamName', 'position', 'from', 'to'];
    const missingFields = requiredFields.filter(field => !entry[field]);
    if (missingFields.length > 0) {
      res.status(400).json({ success: false, message: 'Missing required fields', missingFields });
      return;
    }

    // Get user and check plan
    const user = await User.findById(userId).select('-password');
    if (!user) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }
    if (user.plan === 'free' && Array.isArray(user.footballJourney) && user.footballJourney.length >= 2) {
      res.status(403).json({
        success: false,
        message: 'Free accounts are limited to 2 football journey entries. Upgrade to monthly or yearly plan to add more.'
      });
      return;
    }

    // Add entry to user's footballJourney
    entry._id = new Types.ObjectId();
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $push: { footballJourney: entry } },
      { new: true, runValidators: true }
    ).select('-password');

    res.status(200).json({
      success: true,
      message: 'Football journey entry added',
      data: updatedUser?.footballJourney
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'ValidationError') {
      res.status(400).json({ success: false, message: 'Validation error', error: error.message });
    } else {
      res.status(500).json({ success: false, message: 'Error adding football journey entry', error: error instanceof Error ? error.message : 'Unknown error' });
    }
  }
};

// Edit a football journey entry by _id
export const editFootballJourneyEntry = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.id;
    const { entry, id } = req.body;

    if (!userId) {
      res.status(401).json({ success: false, message: 'User not authenticated' });
      return;
    }
    if (!id) {
      res.status(400).json({ success: false, message: 'Entry _id is required' });
      return;
    }
    // Validate required fields
    const requiredFields = ['teamName', 'position', 'from', 'to'];
    const missingFields = requiredFields.filter(field => !entry[field]);
    if (missingFields.length > 0) {
      res.status(400).json({ success: false, message: 'Missing required fields', missingFields });
      return;
    }
    // Find user
    const user = await User.findById(userId);
    if (!user) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }
    const fj = user.footballJourney as any[];
    const idx = fj.findIndex(e => e._id && e._id.toString() === id);
    if (idx === -1) {
      res.status(400).json({ success: false, message: 'Football journey entry not found' });
      return;
    }
    entry._id = id;
    fj[idx] = entry;
    user.footballJourney = fj;
    await user.save();
    res.status(200).json({
      success: true,
      message: 'Football journey entry updated',
      data: user.footballJourney
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'ValidationError') {
      res.status(400).json({ success: false, message: 'Validation error', error: error.message });
    } else {
      res.status(500).json({ success: false, message: 'Error editing football journey entry', error: error instanceof Error ? error.message : 'Unknown error' });
    }
  }
};

// Delete a football journey entry by _id
export const deleteFootballJourneyEntry = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.id;
    const { id } = req.params;

    if (!userId) {
      res.status(401).json({ success: false, message: 'User not authenticated' });
      return;
    }
    if (!id) {
      res.status(400).json({ success: false, message: 'Entry _id is required' });
      return;
    }
    const user = await User.findById(userId);
    if (!user) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }
    user.footballJourney = (user.footballJourney as any[]).filter(e => !e._id || e._id.toString() !== id);
    await user.save();
    res.status(200).json({
      success: true,
      message: 'Football journey entry deleted',
      data: user.footballJourney
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error deleting football journey entry', error: error instanceof Error ? error.message : 'Unknown error' });
  }
};

// Add an achievement
export const addAchievement = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.id;
    const file = req.file;
    const achievement = req.body;

    if (!userId) {
      res.status(401).json({ success: false, message: 'User not authenticated' });
      return;
    }

    // Get user to check their plan
    const user = await User.findById(userId);
    if (!user) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }
    if (user.plan === 'free') {
      res.status(403).json({
        success: false,
        message: 'Free accounts cannot add achievements. Upgrade to monthly or yearly plan to add achievements.'
      });
      return;
    }

    // Validate required fields
    const requiredFields = ['title', 'competitionName', 'organizer', 'date'];
    const missingFields = requiredFields.filter(field => !achievement[field]);
    if (missingFields.length > 0) {
      res.status(400).json({ success: false, message: 'Missing required fields', missingFields });
      return;
    }

    // If a file is uploaded, upload to Cloudinary and set photo field
    if (file) {
      const uploadResult = await uploadToCloudinary(file.buffer, 'achievements', 'image');
      achievement.photo = uploadResult.url;
    }

    achievement._id = new Types.ObjectId();
    // Add achievement to user's achievements
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $push: { achievements: achievement } },
      { new: true, runValidators: true }
    ).select('-password');

    if (!updatedUser) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'Achievement added',
      data: updatedUser.achievements
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'ValidationError') {
      res.status(400).json({ success: false, message: 'Validation error', error: error.message });
    } else {
      res.status(500).json({ success: false, message: 'Error adding achievement', error: error instanceof Error ? error.message : 'Unknown error' });
    }
  }
};

// Edit an achievement by _id
export const editAchievement = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.id;
    const { id, achievement } = req.body;

    if (!userId) {
      res.status(401).json({ success: false, message: 'User not authenticated' });
      return;
    }
    if (!id) {
      res.status(400).json({ success: false, message: 'Achievement _id is required' });
      return;
    }
    // Validate required fields
    const requiredFields = ['title', 'competitionName', 'organizer', 'date'];
    const missingFields = requiredFields.filter(field => !achievement[field]);
    if (missingFields.length > 0) {
      res.status(400).json({ success: false, message: 'Missing required fields', missingFields });
      return;
    }
    // Find user
    const user = await User.findById(userId);
    if (!user) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }
    const arr = user.achievements as any[];
    const idx = arr.findIndex(e => e._id && e._id.toString() === id);
    if (idx === -1) {
      res.status(400).json({ success: false, message: 'Achievement not found' });
      return;
    }
    // Preserve existing photo if not provided in update
    achievement._id = id;
    if (!achievement.photo && arr[idx].photo) {
      achievement.photo = arr[idx].photo;
    }
    arr[idx] = achievement;
    user.achievements = arr;
    await user.save();
    res.status(200).json({
      success: true,
      message: 'Achievement updated',
      data: user.achievements
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'ValidationError') {
      res.status(400).json({ success: false, message: 'Validation error', error: error.message });
    } else {
      res.status(500).json({ success: false, message: 'Error editing achievement', error: error instanceof Error ? error.message : 'Unknown error' });
    }
  }
};

// Delete an achievement by _id
export const deleteAchievement = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.id;
    const { id } = req.params;

    if (!userId) {
      res.status(401).json({ success: false, message: 'User not authenticated' });
      return;
    }
    if (!id) {
      res.status(400).json({ success: false, message: 'Achievement _id is required' });
      return;
    }
    const user = await User.findById(userId);
    if (!user) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }
    user.achievements = (user.achievements as any[]).filter(e => !e._id || e._id.toString() !== id);
    await user.save();
    res.status(200).json({
      success: true,
      message: 'Achievement deleted',
      data: user.achievements
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error deleting achievement', error: error instanceof Error ? error.message : 'Unknown error' });
  }
};

// Add a certificate
export const addCertificate = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.id;
    const file = req.file;
    const certificate = req.body;

    if (!userId) {
      res.status(401).json({ success: false, message: 'User not authenticated' });
      return;
    }

    // Get user to check their plan
    const user = await User.findById(userId);
    if (!user) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }
    if (user.plan === 'free') {
      res.status(403).json({
        success: false,
        message: 'Free accounts cannot add certificates. Upgrade to monthly or yearly plan to add certificates.'
      });
      return;
    }

    // Validate required fields
    const requiredFields = ['certificateTitle', 'issuedBy', 'dateIssued'];
    const missingFields = requiredFields.filter(field => !certificate[field]);
    if (missingFields.length > 0) {
      res.status(400).json({ success: false, message: 'Missing required fields', missingFields });
      return;
    }

    // If a file is uploaded, upload to Cloudinary and set photo field
    if (file) {
      const uploadResult = await uploadToCloudinary(file.buffer, 'certificates', 'image');
      certificate.photo = uploadResult.url;
    }

    certificate._id = new Types.ObjectId();
    // Add certificate to user's certificates
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $push: { certificates: certificate } },
      { new: true, runValidators: true }
    ).select('-password');

    if (!updatedUser) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'Certificate added',
      data: updatedUser.certificates
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'ValidationError') {
      res.status(400).json({ success: false, message: 'Validation error', error: error.message });
    } else {
      res.status(500).json({ success: false, message: 'Error adding certificate', error: error instanceof Error ? error.message : 'Unknown error' });
    }
  }
};

// Edit a certificate by _id
export const editCertificate = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.id;
    const { id, certificate } = req.body;

    if (!userId) {
      res.status(401).json({ success: false, message: 'User not authenticated' });
      return;
    }
    if (!id) {
      res.status(400).json({ success: false, message: 'Certificate _id is required' });
      return;
    }
    // Validate required fields
    const requiredFields = ['certificateTitle', 'issuedBy', 'dateIssued'];
    const missingFields = requiredFields.filter(field => !certificate[field]);
    if (missingFields.length > 0) {
      res.status(400).json({ success: false, message: 'Missing required fields', missingFields });
      return;
    }
    // Find user
    const user = await User.findById(userId);
    if (!user) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }
    const arr = user.certificates as any[];
    const idx = arr.findIndex(e => e._id && e._id.toString() === id);
    if (idx === -1) {
      res.status(400).json({ success: false, message: 'Certificate not found' });
      return;
    }
    // Preserve existing photo if not provided in update
    certificate._id = id;
    if (!certificate.photo && arr[idx].photo) {
      certificate.photo = arr[idx].photo;
    }
    arr[idx] = certificate;
    user.certificates = arr;
    await user.save();
    res.status(200).json({
      success: true,
      message: 'Certificate updated',
      data: user.certificates
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'ValidationError') {
      res.status(400).json({ success: false, message: 'Validation error', error: error.message });
    } else {
      res.status(500).json({ success: false, message: 'Error editing certificate', error: error instanceof Error ? error.message : 'Unknown error' });
    }
  }
};

// Delete a certificate by _id
export const deleteCertificate = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.id;
    const { id } = req.params;

    if (!userId) {
      res.status(401).json({ success: false, message: 'User not authenticated' });
      return;
    }
    if (!id) {
      res.status(400).json({ success: false, message: 'Certificate _id is required' });
      return;
    }
    const user = await User.findById(userId);
    if (!user) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }
    user.certificates = (user.certificates as any[]).filter(e => !e._id || e._id.toString() !== id);
    await user.save();
    res.status(200).json({
      success: true,
      message: 'Certificate deleted',
      data: user.certificates
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error deleting certificate', error: error instanceof Error ? error.message : 'Unknown error' });
  }
};

// Get any user's public profile data (no authentication required)
export const getPublicProfileData = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;

    if (!userId) {
      res.status(400).json({ success: false, message: 'User ID is required' });
      return;
    }

    const user = await User.findById(userId).select('-password');
    if (!user) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }

    // Only return data for active and non-deleted users
    if (user.isDeleted || !user.isActive) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }

    // Create a copy of user data to modify
    const userData = user.toObject();

    // If user is on free plan and has more than 3 achievements, return only first 3
    if (user.plan === 'free' && user.achievements && user.achievements.length > 3) {
      userData.achievements = user.achievements.slice(0, 3);
    }

    res.status(200).json({
      success: true,
      data: userData
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching profile data', error: error instanceof Error ? error.message : 'Unknown error' });
  }
}; 