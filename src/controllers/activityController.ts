import { Request, Response } from 'express';
import Activity, { IActivity } from '../models/Activity';
import User from '../models/User';

// Enhanced activity logging with additional context
export const logActivity = async (
  userId: string,
  type: IActivity['type'],
  description: string,
  activityRefId?: string,
  req?: Request,
  metadata?: Record<string, any>
) => {
  try {
    const activityData: any = {
      userId,
      type,
      description,
      activityRefId
    };

    // Add request context if available
    if (req) {
      activityData.userAgent = req.headers['user-agent'];
    }

    // Add metadata if provided
    if (metadata) {
      activityData.metadata = metadata;
    }

    await Activity.create(activityData);
  } catch (error) {
    console.error('Error logging activity:', error);
  }
};

// Log activity with automatic user detection from request
export const logRequestActivity = async (
  req: Request,
  type: IActivity['type'],
  description: string,
  activityRefId?: string,
  metadata?: Record<string, any>
) => {
  const userId = (req as any).user?.id;
  if (userId) {
    await logActivity(userId, type, description, activityRefId, req, metadata);
  }
};

// Get all activities for a user
export const getUserActivities = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      res.status(401).json({ success: false, message: 'User not authenticated' });
      return;
    }

    const { page = 1, limit = 20, type } = req.query;
    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;

    // Build query
    const query: any = { userId };
    if (type && typeof type === 'string') {
      query.type = type;
    }

    const activities = await Activity.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean();

    const totalActivities = await Activity.countDocuments(query);
    const totalPages = Math.ceil(totalActivities / limitNum);

    res.status(200).json({
      success: true,
      data: {
        activities,
        pagination: {
          currentPage: pageNum,
          totalPages,
          totalActivities,
          limit: limitNum,
          hasNextPage: pageNum < totalPages,
          hasPrevPage: pageNum > 1
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching activities',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Get all platform activities for admin
export const getAllActivities = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      page = 1,
      limit = 50,
      type,
      userId,
      startDate,
      endDate,
      search
    } = req.query;

    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;

    // Build query
    const query: any = {};

    // Filter by activity type
    if (type && typeof type === 'string') {
      query.type = type;
    }

    // Filter by specific user
    if (userId && typeof userId === 'string') {
      query.userId = userId;
    }

    // Date range filter
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) {
        query.createdAt.$gte = new Date(startDate as string);
      }
      if (endDate) {
        query.createdAt.$lte = new Date(endDate as string);
      }
    }

    // Search in description
    if (search && typeof search === 'string') {
      query.description = { $regex: search, $options: 'i' };
    }

    // Get activities with user information
    const activities = await Activity.aggregate([
      { $match: query },
      {
        $lookup: {
          from: 'users',
          localField: 'userId',
          foreignField: '_id',
          as: 'user',
          pipeline: [
            {
              $project: {
                email: 1,
                firstName: 1,
                lastName: 1,
                role: 1,
                username: 1
              }
            }
          ]
        }
      },
      {
        $unwind: {
          path: '$user',
          preserveNullAndEmptyArrays: true
        }
      },
      { $sort: { createdAt: -1 } },
      { $skip: skip },
      { $limit: limitNum }
    ]);

    const totalActivities = await Activity.countDocuments(query);
    const totalPages = Math.ceil(totalActivities / limitNum);

    res.status(200).json({
      success: true,
      data: {
        activities,
        pagination: {
          currentPage: pageNum,
          totalPages,
          totalActivities,
          limit: limitNum,
          hasNextPage: pageNum < totalPages,
          hasPrevPage: pageNum > 1
        },
        filters: {
          type: type || null,
          userId: userId || null,
          startDate: startDate || null,
          endDate: endDate || null,
          search: search || null
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching platform activities',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Get activity statistics for admin dashboard
export const getActivityStats = async (req: Request, res: Response): Promise<void> => {
  try {
    const { period = '30' } = req.query;
    const days = parseInt(period as string, 10);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Get activity counts by type
    const activityStats = await Activity.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: '$type',
          count: { $sum: 1 }
        }
      },
      {
        $sort: { count: -1 }
      }
    ]);

    // Get daily activity trend
    const dailyActivity = await Activity.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: '%Y-%m-%d',
              date: '$createdAt'
            }
          },
          count: { $sum: 1 }
        }
      },
      {
        $sort: { '_id': 1 }
      }
    ]);

    // Get most active users
    const activeUsers = await Activity.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: '$userId',
          activityCount: { $sum: 1 }
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'user',
          pipeline: [
            {
              $project: {
                email: 1,
                firstName: 1,
                lastName: 1,
                username: 1
              }
            }
          ]
        }
      },
      {
        $unwind: '$user'
      },
      {
        $sort: { activityCount: -1 }
      },
      {
        $limit: 10
      }
    ]);

    res.status(200).json({
      success: true,
      data: {
        period: `${days} days`,
        activityStats,
        dailyActivity,
        activeUsers
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching activity statistics',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}; 