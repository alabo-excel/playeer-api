import { Request, Response } from 'express';
import Highlight from '../models/Highlight';
import User from '../models/User';
import { uploadToCloudinary } from '../config/cloudinary';
import path from 'path';

export const createHighlight = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.id;
    const file = req.file;
    const highlightData = req.body;

    if (!userId) {
      res.status(401).json({ success: false, message: 'User not authenticated' });
      return;
    }

    if (!file) {
      res.status(400).json({ success: false, message: 'Video file is required' });
      return;
    }

    // Get user to check their plan
    const user = await User.findById(userId);
    if (!user) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }

    // Check if user is on free plan and already has 2 highlights
    if (user.plan === 'free') {
      const highlightCount = await Highlight.countDocuments({ userId: user._id });
      if (highlightCount >= 2) {
        res.status(403).json({
          success: false,
          message: 'Free accounts are limited to 2 highlights. Upgrade to monthly or yearly plan to add more.'
        });
        return;
      }
    }

    // Upload video to Cloudinary
    const uploadResult = await uploadToCloudinary(file.buffer, 'highlights', 'video');

    const newHighlight = await Highlight.create({
      ...highlightData,
      video: uploadResult.url,
      userId: userId,
      views: []
    });

    res.status(201).json({
      success: true,
      message: 'Highlight created successfully',
      data: newHighlight
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'ValidationError') {
      res.status(400).json({ success: false, message: 'Validation error', error: error.message });
    } else {
      res.status(500).json({ success: false, message: 'Error creating highlight', error: error instanceof Error ? error.message : 'Unknown error' });
    }
  }
};

// Edit a highlight by id
export const editHighlight = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { title, video, description, tags } = req.body;
    const highlight = await Highlight.findByIdAndUpdate(
      id,
      { title, video, description, tags },
      { new: true, runValidators: true }
    );
    if (!highlight) {
      res.status(404).json({ success: false, message: 'Highlight not found' });
      return;
    }
    res.status(200).json({ success: true, message: 'Highlight updated', data: highlight });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error editing highlight', error: error instanceof Error ? error.message : 'Unknown error' });
  }
};

// Delete a highlight by id
export const deleteHighlight = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const highlight = await Highlight.findByIdAndDelete(id);
    if (!highlight) {
      res.status(404).json({ success: false, message: 'Highlight not found' });
      return;
    }
    res.status(200).json({ success: true, message: 'Highlight deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error deleting highlight', error: error instanceof Error ? error.message : 'Unknown error' });
  }
};

// View (get) a highlight by id and add user to views if not already present
export const viewHighlight = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.id;
    if (!userId) {
      res.status(401).json({ success: false, message: 'User not authenticated' });
      return;
    }
    // Only add userId if not already in views
    const highlight = await Highlight.findOneAndUpdate(
      { _id: id, views: { $ne: userId } },
      { $push: { views: userId } },
      { new: true }
    ) || await Highlight.findById(id);
    if (!highlight) {
      res.status(404).json({ success: false, message: 'Highlight not found' });
      return;
    }
    res.status(200).json({ success: true, data: highlight });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error viewing highlight', error: error instanceof Error ? error.message : 'Unknown error' });
  }
};

// Get a user's highlights (public), limit to 2 if user is on free plan and has more than 2
export const getUserHighlights = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;
    if (!userId) {
      res.status(400).json({ success: false, message: 'User ID is required' });
      return;
    }
    const user = await User.findById(userId);
    if (!user || user.isDeleted || !user.isActive) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }
    const highlights = await Highlight.find({ userId }).sort({ createdAt: -1 });
    let result = highlights;
    if (user.plan === 'free' && highlights.length > 2) {
      result = highlights.slice(0, 2);
    }
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching highlights', error: error instanceof Error ? error.message : 'Unknown error' });
  }
};


