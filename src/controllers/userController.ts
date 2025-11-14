
import { Request, Response } from 'express';
import User, { IUser } from '../models/User';
import Highlight from '../models/Highlight';
import { uploadToCloudinary } from '../config/cloudinary';
import { unsubscribePaystackSubscription } from '../utils/paystackUnsubscribe';
// Cancel Paystack subscription for authenticated user

export const cancelSubscription = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      res.status(401).json({ success: false, message: 'User not authenticated' });
      return;
    }
    const user = await User.findById(userId);
    if (!user) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }
    if (!user.paystackSubscriptionId) {
      res.status(400).json({ success: false, message: 'No active Paystack subscription to cancel.' });
      return;
    }
    const result = await unsubscribePaystackSubscription(user.paystackSubscriptionId);
    if (!result.success) {
      res.status(500).json({ success: false, message: 'Failed to cancel Paystack subscription', error: result.error });
      return;
    }
    // Remove subscription ID from user, but keep plan and renewalDate until expiry
    user.paystackSubscriptionId = undefined;
    await user.save();
    res.status(200).json({ success: true, message: 'Subscription cancelled. You will retain paid access until your renewal date.', data: user });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error cancelling subscription', error: error instanceof Error ? error.message : 'Unknown error' });
  }
};

// Get all users
export const getAllUsers = async (req: Request, res: Response): Promise<void> => {
  try {
    const users = await User.find({ role: 'user' }).select('-password');
    res.status(200).json({
      success: true,
      count: users.length,
      data: users
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching users',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Get single user by ID
export const getUserById = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await User.findById(req.params.id).select('-password');

    if (!user) {
      res.status(404).json({
        success: false,
        message: 'User not found'
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: user
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching user',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Delete user
export const deleteUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);

    if (!user) {
      res.status(404).json({
        success: false,
        message: 'User not found'
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'User deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error deleting user',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Get user profile (for authenticated user)
export const getUserProfile = async (req: Request, res: Response): Promise<void> => {
  try {
    // This would typically get the user ID from the JWT token
    // For now, we'll use a placeholder
    const userId = (req as any).user?.id;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: 'User ID required'
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

    res.status(200).json({
      success: true,
      data: user
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching user profile',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Update user profile
export const updateUserProfile = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.params.id || req.body.userId;
    const file = req.file;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: 'User ID required'
      });
      return;
    }


    // Remove sensitive fields and only update provided fields
    const { password, role, isVerified, profilePicture, ...rest } = req.body;
    const updateData: any = {};
    for (const key in rest) {
      if (rest[key] !== undefined && rest[key] !== null && rest[key] !== "") {
        updateData[key] = rest[key];
      }
    }

    // Only update profilePicture if a file is provided
    if (file) {
      const uploadResult = await uploadToCloudinary(file.buffer, 'profile-pictures', 'image');
      updateData.profilePicture = uploadResult.url;
    }

    // Only update if there is at least one field to update
    if (Object.keys(updateData).length === 0) {
      res.status(400).json({ success: false, message: 'No valid fields provided for update' });
      return;
    }

    const user = await User.findByIdAndUpdate(
      userId,
      { $set: updateData },
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
      message: 'Profile updated successfully',
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
        message: 'Error updating profile',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
};

// Admin: Set user active status
export const setActiveStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { active } = req.body;
    if (typeof active !== 'boolean') {
      res.status(400).json({ success: false, message: 'active (boolean) is required in body' });
      return;
    }
    const user = await User.findByIdAndUpdate(id, { isActive: active }, { new: true });
    if (!user) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }
    res.status(200).json({ success: true, message: `User ${active ? 'activated' : 'deactivated'}`, data: user });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error updating user status', error: error instanceof Error ? error.message : 'Unknown error' });
  }
};

// Soft delete a user
export const softDeleteUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const user = await User.findByIdAndUpdate(id, { isDeleted: true }, { new: true });
    if (!user) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }
    res.status(200).json({ success: true, message: 'User deleted', data: user });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error deleting user', error: error instanceof Error ? error.message : 'Unknown error' });
  }
};

// User self-deactivate account
export const selfDeactivateAccount = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      res.status(401).json({ success: false, message: 'User not authenticated' });
      return;
    }
    const user = await User.findByIdAndUpdate(userId, { isActive: false }, { new: true });
    if (!user) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }
    res.status(200).json({ success: true, message: 'Account deactivated', data: user });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error deactivating account', error: error instanceof Error ? error.message : 'Unknown error' });
  }
};

// User self-delete (soft delete) account
export const selfDeleteAccount = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      res.status(401).json({ success: false, message: 'User not authenticated' });
      return;
    }
    const user = await User.findByIdAndUpdate(userId, { isDeleted: true }, { new: true });
    if (!user) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }
    res.status(200).json({ success: true, message: 'Account deleted', data: user });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error deleting account', error: error instanceof Error ? error.message : 'Unknown error' });
  }
};

// Get all active and not deleted users
export const getActiveNotDeletedUsers = async (req: Request, res: Response): Promise<void> => {
  try {
    // Return users who are active, not deleted, and have public visibility
    const users = await User.find({
      isActive: true,
      isDeleted: false,
      visibility: 'public'
    }).select('-password');
    res.status(200).json({
      success: true,
      count: users.length,
      data: users
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching users',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// View a user's profile (add viewer to profileViews if not already present)
export const viewProfile = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;
    const viewerId = (req as any).user?.id;

    if (!viewerId) {
      res.status(401).json({ success: false, message: 'User not authenticated' });
      return;
    }

    if (viewerId === userId) {
      res.status(400).json({ success: false, message: 'Cannot view your own profile' });
      return;
    }

    // Find user and add viewer to profileViews if not already present
    const user = await User.findOneAndUpdate(
      { _id: userId, isDeleted: false, isActive: true, profileViews: { $ne: viewerId } },
      { $push: { profileViews: viewerId } },
      { new: true, select: '-password' }
    ) || await User.findById(userId).select('-password');

    if (!user) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }

    if (user.isDeleted || !user.isActive) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }

    // If profileViews is now odd, log activity
    // if (user.profileViews && user.profileViews.length % 2 === 1) {
    //   await logActivity(viewerId, 'profile_views', `User profile has ${user.profileViews.length} number of views.`, String(user._id));
    // }

    res.status(200).json({ success: true, data: user });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error viewing profile', error: error instanceof Error ? error.message : 'Unknown error' });
  }
};

// Set welcome flag to false
export const dismissWelcome = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.id;

    if (!userId) {
      res.status(401).json({ success: false, message: 'User not authenticated' });
      return;
    }

    const user = await User.findByIdAndUpdate(
      userId,
      { welcome: false },
      { new: true }
    ).select('-password');

    if (!user) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'Welcome dismissed successfully',
      data: user
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error dismissing welcome',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Toggle user visibility (public/private)
export const toggleVisibility = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.params.id || req.body.userId;
    const { visibility } = req.body
    if (!userId) {
      res.status(401).json({ success: false, message: 'User ID required' });
      return;
    }
    // Find user
    const user = await User.findById(userId);
    if (!user) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }
    // Toggle visibility
    // const newVisibility = user.visibility === 'public' ? 'private' : 'public';
    user.visibility = visibility;
    await user.save();
    res.status(200).json({ success: true, message: `Visibility set to ${visibility}`, data: user });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error toggling visibility', error: error instanceof Error ? error.message : 'Unknown error' });
  }
};

// Get admin dashboard statistics
export const getAdminStats = async (req: Request, res: Response): Promise<void> => {
  try {
    // Get total users count (only regular users)
    const totalUsers = await User.countDocuments({
      role: 'user',
      isDeleted: false
    });

    // Get verified users count (only regular users)
    const verifiedUsers = await User.countDocuments({
      role: 'user',
      isVerified: true,
      isDeleted: false
    });

    // Get highlight videos count
    const highlightVideos = await Highlight.countDocuments({});

    // Get active subscribers count (users with paid plans that are still active)
    const now = new Date();
    const activeSubscribers = await User.countDocuments({
      role: 'user',
      plan: { $in: ['monthly', 'yearly'] },
      renewalDate: { $gt: now },
      paystackSubscriptionId: { $nin: [null, undefined] },
      isActive: true,
      isDeleted: false
    });

    // Get top 5 countries by user count
    const topCountries = await User.aggregate([
      {
        $match: {
          role: 'user',
          isDeleted: false,
          country: { $exists: true, $nin: [null, ''] }
        }
      },
      {
        $group: {
          _id: '$country',
          userCount: { $sum: 1 }
        }
      },
      {
        $sort: { userCount: -1 }
      },
      {
        $limit: 5
      },
      {
        $project: {
          country: '$_id',
          userCount: 1,
          _id: 0
        }
      }
    ]);

    res.status(200).json({
      success: true,
      message: 'Admin statistics retrieved successfully',
      data: {
        totalUsers,
        verifiedUsers,
        highlightVideos,
        activeSubscribers,
        topCountries
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching admin statistics',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};



