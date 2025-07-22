import { Request, Response } from 'express';
import Activity, { IActivity } from '../models/Activity';

// Log a new activity
export const logActivity = async (
  userId: string,
  type: IActivity['type'],
  description: string,
  activityRefId?: string
) => {
  await Activity.create({ userId, type, description, activityRefId });
};

// Get all activities for a user
export const getUserActivities = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      res.status(401).json({ success: false, message: 'User not authenticated' });
      return;
    }
    const activities = await Activity.find({ userId }).sort({ createdAt: -1 });
    res.status(200).json({ success: true, data: activities });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching activities', error: error instanceof Error ? error.message : 'Unknown error' });
  }
}; 