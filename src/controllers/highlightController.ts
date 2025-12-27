import { Request, Response } from 'express';
import Highlight from '../models/Highlight';
import User from '../models/User';
import { uploadToCloudinary } from '../config/cloudinary';

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
      views: 0
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
    const { title, description, tags } = req.body;
    const file = req.file;

    let updateData: any = { title, description, tags };

    if (file) {
      // Upload new video to Cloudinary
      const uploadResult = await uploadToCloudinary(file.buffer, 'highlights', 'video');
      updateData.video = uploadResult.url;
    }

    const highlight = await Highlight.findByIdAndUpdate(
      id,
      updateData,
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
    // const userId = (req as any).user?.id;
    // if (!userId) {
    //   res.status(401).json({ success: false, message: 'User not authenticated' });
    //   return;
    // }
    // Increment numeric views count by 1 on every view
    try {
      const highlight = await Highlight.findByIdAndUpdate(
        id,
        { $inc: { views: 1 } },
        { new: true }
      );
      if (!highlight) {
        res.status(404).json({ success: false, message: 'Highlight not found' });
        return;
      }
      res.status(200).json({ success: true, data: highlight });
      return;
    } catch (err: any) {
      // On any failure of $inc (legacy array or other), attempt to read current doc
      // console.warn('Increment failed, attempting fallback conversion for highlight views:', err?.message || err);
      try {
        const doc = await Highlight.findById(id).lean();
        if (!doc) {
          res.status(404).json({ success: false, message: 'Highlight not found' });
          return;
        }

        let numericViews = 0;
        if (Array.isArray((doc as any).views)) {
          numericViews = (doc as any).views.length;
        } else if (typeof (doc as any).views === 'number') {
          numericViews = (doc as any).views;
        } else {
          // If views is another type, coerce to number safely
          const coerced = Number((doc as any).views);
          numericViews = Number.isFinite(coerced) ? coerced : 0;
        }

        const updated = await Highlight.findByIdAndUpdate(id, { $set: { views: numericViews + 1 } }, { new: true });
        if (!updated) {
          res.status(500).json({ success: false, message: 'Error updating highlight views' });
          return;
        }
        res.status(200).json({ success: true, data: updated });
        return;
      } catch (fallbackErr) {
        console.error('Fallback update failed for highlight views:', fallbackErr);
        res.status(500).json({ success: false, message: 'Error viewing highlight', error: fallbackErr instanceof Error ? fallbackErr.message : fallbackErr });
        return;
      }
    }
    // If views is now even, log activity
    // if (highlight.views.length % 2 === 0) {
    //   await logActivity(userId, 'highlight_views', `Highlight has an ${highlight.views.length} number of views.`, String(highlight._id));
    // }
    // res.status(200).json({ success: true, data: highlight });
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


