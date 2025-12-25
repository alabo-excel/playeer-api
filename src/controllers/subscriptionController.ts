import { Request, Response } from 'express';
import User from '../models/User';
import { unsubscribePaystackSubscription } from '../utils/paystackUnsubscribe';

// Helper function to determine subscription status
const getSubscriptionStatus = (user: any): 'active' | 'expired' | 'canceled' | 'free' => {
    if (user.plan === 'free') {
        return 'free';
    }

    const now = new Date();
    const renewalDate = user.renewalDate ? new Date(user.renewalDate) : null;

    // If no renewal date, consider it canceled
    if (!renewalDate) {
        return 'canceled';
    }

    // If renewal date has passed, it's expired
    if (renewalDate <= now) {
        return 'expired';
    }

    // If there's no Paystack subscription ID, it's canceled (won't auto-renew)
    if (!user.paystackSubscriptionId) {
        return 'canceled';
    }

    // Otherwise, it's active
    return 'active';
};

// Get all subscribers (users with paid plans)
export const getAllSubscribers = async (req: Request, res: Response) => {
    try {
        const {
            page = 1,
            limit = 10,
            plan,
            sortBy = 'createdAt',
            sortOrder = 'desc',
            search = ''
        } = req.query;

        // Build query for subscribers (exclude free plan users and only include regular users)
        const query: any = {
            plan: { $ne: 'free' },
            isActive: true,
            isDeleted: false,
            role: 'user'
        };

        // Filter by specific plan if provided
        if (plan && ['monthly', 'yearly'].includes(plan as string)) {
            query.plan = plan;
        }

        // Add search functionality
        if (search && typeof search === 'string' && search.trim() !== '') {
            const searchRegex = new RegExp(search.trim(), 'i'); // Case-insensitive search
            query.$or = [
                { firstName: { $regex: searchRegex } },
                { lastName: { $regex: searchRegex } },
                { email: { $regex: searchRegex } },
                { username: { $regex: searchRegex } },
                {
                    $expr: {
                        $regexMatch: {
                            input: { $concat: ['$firstName', ' ', '$lastName'] },
                            regex: search.trim(),
                            options: 'i'
                        }
                    }
                }
            ];
        }

        // Calculate pagination
        const pageNum = parseInt(page as string, 10);
        const limitNum = parseInt(limit as string, 10);
        const skip = (pageNum - 1) * limitNum;

        // Build sort object
        const sortObj: any = {};
        sortObj[sortBy as string] = sortOrder === 'asc' ? 1 : -1;

        // Execute query with pagination
        const subscribers = await User.find(query)
            .select('-password')
            .sort(sortObj)
            .skip(skip)
            .limit(limitNum)
            .lean();

        // Add subscription status to each subscriber
        const subscribersWithStatus = subscribers.map(subscriber => ({
            ...subscriber,
            subscriptionStatus: getSubscriptionStatus(subscriber)
        }));

        // Get total count for pagination
        const totalSubscribers = await User.countDocuments(query);

        // Calculate pagination info
        const totalPages = Math.ceil(totalSubscribers / limitNum);
        const hasNextPage = pageNum < totalPages;
        const hasPrevPage = pageNum > 1;

        res.status(200).json({
            success: true,
            message: 'Subscribers retrieved successfully',
            data: {
                subscribers: subscribersWithStatus,
                search: search || '',
                pagination: {
                    currentPage: pageNum,
                    totalPages,
                    totalSubscribers,
                    limit: limitNum,
                    hasNextPage,
                    hasPrevPage
                }
            }
        });
    } catch (error) {
        console.error('Error getting subscribers:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};

// Get subscribers with active subscriptions
export const getActiveSubscribers = async (req: Request, res: Response) => {
    try {
        const { page = 1, limit = 10, plan } = req.query;

        // Build query for active subscribers (only regular users)
        const query: any = {
            plan: { $ne: 'free' },
            isActive: true,
            isDeleted: false,
            renewalDate: { $gt: new Date() }, // Subscription not expired
            role: 'user'
        };

        // Filter by specific plan if provided
        if (plan && ['monthly', 'yearly'].includes(plan as string)) {
            query.plan = plan;
        }

        // Calculate pagination
        const pageNum = parseInt(page as string, 10);
        const limitNum = parseInt(limit as string, 10);
        const skip = (pageNum - 1) * limitNum;

        // Execute query
        const activeSubscribers = await User.find(query)
            .select('-password')
            .sort({ renewalDate: -1 })
            .skip(skip)
            .limit(limitNum)
            .lean();

        // Add subscription status to each subscriber
        const subscribersWithStatus = activeSubscribers.map(subscriber => ({
            ...subscriber,
            subscriptionStatus: getSubscriptionStatus(subscriber)
        }));

        // Get total count
        const totalActive = await User.countDocuments(query);

        // Calculate pagination info
        const totalPages = Math.ceil(totalActive / limitNum);

        res.status(200).json({
            success: true,
            message: 'Active subscribers retrieved successfully',
            data: {
                subscribers: subscribersWithStatus,
                pagination: {
                    currentPage: pageNum,
                    totalPages,
                    totalActive,
                    limit: limitNum,
                    hasNextPage: pageNum < totalPages,
                    hasPrevPage: pageNum > 1
                }
            }
        });
    } catch (error) {
        console.error('Error getting active subscribers:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};

// Get subscription statistics
export const getSubscriptionStats = async (req: Request, res: Response) => {
    try {
        // Get all users with subscriptions (only regular users)
        const allUsers = await User.find({
            isActive: true,
            isDeleted: false,
            role: 'user'
        }).lean();

        // Count by status
        const statusCounts = {
            active: 0,
            canceled: 0,
            expired: 0,
            free: 0
        };

        const planCounts = {
            free: { active: 0, canceled: 0, expired: 0, total: 0 },
            monthly: { active: 0, canceled: 0, expired: 0, total: 0 },
            yearly: { active: 0, canceled: 0, expired: 0, total: 0 }
        };

        // Process each user
        allUsers.forEach(user => {
            const status = getSubscriptionStatus(user);
            const plan = user.plan || 'free';

            // Count by status
            statusCounts[status]++;

            // Count by plan and status
            if (planCounts[plan as keyof typeof planCounts]) {
                planCounts[plan as keyof typeof planCounts][status as keyof typeof planCounts.free]++;
                planCounts[plan as keyof typeof planCounts].total++;
            }
        });

        // Calculate totals
        const totalUsers = allUsers.length;
        const totalSubscribers = planCounts.monthly.total + planCounts.yearly.total;
        const activeSubscribers = planCounts.monthly.active + planCounts.yearly.active; // Only count active paid subscribers

        res.status(200).json({
            success: true,
            message: 'Subscription statistics retrieved successfully',
            data: {
                totalUsers,
                totalSubscribers,
                activeSubscribers,
                // statusBreakdown: statusCounts,
                // planBreakdown: planCounts,
                summary: {
                    activeSubscriptions: activeSubscribers,
                    canceledSubscriptions: statusCounts.canceled,
                    expiredSubscriptions: statusCounts.expired,
                    freeUsers: statusCounts.free
                }
            }
        });
    } catch (error) {
        console.error('Error getting subscription stats:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};

// Get subscribers by status (active, canceled, expired)
export const getSubscribersByStatus = async (req: Request, res: Response) => {
    try {
        const { status, page = 1, limit = 10, plan, search = '' } = req.query;

        // Validate status parameter
        if (!status || !['active', 'canceled', 'expired', 'free'].includes(status as string)) {
            return res.status(400).json({
                success: false,
                message: 'Valid status is required (active, canceled, expired, or free)'
            });
        }

        const requestedStatus = status as 'active' | 'canceled' | 'expired' | 'free';

        // Get all users first, then filter by status (only regular users)
        let query: any = {
            isActive: true,
            isDeleted: false,
            role: 'user'
        };

        // Filter by plan if provided
        if (plan && ['free', 'monthly', 'yearly'].includes(plan as string)) {
            query.plan = plan;
        }

        // Add search functionality
        if (search && typeof search === 'string' && search.trim() !== '') {
            const searchRegex = new RegExp(search.trim(), 'i'); // Case-insensitive search
            query.$or = [
                { firstName: { $regex: searchRegex } },
                { lastName: { $regex: searchRegex } },
                { email: { $regex: searchRegex } },
                { username: { $regex: searchRegex } },
                {
                    $expr: {
                        $regexMatch: {
                            input: { $concat: ['$firstName', ' ', '$lastName'] },
                            regex: search.trim(),
                            options: 'i'
                        }
                    }
                }
            ];
        }

        // Calculate pagination
        const pageNum = parseInt(page as string, 10);
        const limitNum = parseInt(limit as string, 10);

        // Get all matching users (we'll filter by status in memory since it's computed)
        const allUsers = await User.find(query)
            .select('-password')
            .lean();

        // Filter by subscription status
        const filteredUsers = allUsers.filter(user =>
            getSubscriptionStatus(user) === requestedStatus
        );

        // Apply pagination to filtered results
        const totalFiltered = filteredUsers.length;
        const skip = (pageNum - 1) * limitNum;
        const paginatedUsers = filteredUsers.slice(skip, skip + limitNum);

        // Add subscription status to each user
        const usersWithStatus = paginatedUsers.map(user => ({
            ...user,
            subscriptionStatus: getSubscriptionStatus(user)
        }));

        // Calculate pagination info
        const totalPages = Math.ceil(totalFiltered / limitNum);

        res.status(200).json({
            success: true,
            message: `Subscribers with ${requestedStatus} status retrieved successfully`,
            data: {
                subscribers: usersWithStatus,
                requestedStatus,
                search: search || '',
                pagination: {
                    currentPage: pageNum,
                    totalPages,
                    totalWithStatus: totalFiltered,
                    limit: limitNum,
                    hasNextPage: pageNum < totalPages,
                    hasPrevPage: pageNum > 1
                }
            }
        });
    } catch (error) {
        console.error('Error getting subscribers by status:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};
// Get subscribers expiring soon
export const getExpiringSubscribers = async (req: Request, res: Response) => {
    try {
        const { days = 7, page = 1, limit = 10 } = req.query;

        const daysAhead = parseInt(days as string, 10);
        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + daysAhead);

        // Find subscribers expiring within the specified days (only regular users)
        const query = {
            plan: { $ne: 'free' },
            isActive: true,
            isDeleted: false,
            role: 'user',
            renewalDate: {
                $gt: new Date(),
                $lte: expiryDate
            }
        };

        // Calculate pagination
        const pageNum = parseInt(page as string, 10);
        const limitNum = parseInt(limit as string, 10);
        const skip = (pageNum - 1) * limitNum;

        // Execute query
        const expiringSubscribers = await User.find(query)
            .select('-password')
            .sort({ renewalDate: 1 }) // Sort by expiry date (earliest first)
            .skip(skip)
            .limit(limitNum)
            .lean();

        // Add subscription status to each subscriber
        const subscribersWithStatus = expiringSubscribers.map(subscriber => ({
            ...subscriber,
            subscriptionStatus: getSubscriptionStatus(subscriber)
        }));

        // Get total count
        const totalExpiring = await User.countDocuments(query);

        // Calculate pagination info
        const totalPages = Math.ceil(totalExpiring / limitNum);

        res.status(200).json({
            success: true,
            message: `Subscribers expiring in next ${daysAhead} days retrieved successfully`,
            data: {
                subscribers: subscribersWithStatus,
                expiringInDays: daysAhead,
                pagination: {
                    currentPage: pageNum,
                    totalPages,
                    totalExpiring,
                    limit: limitNum,
                    hasNextPage: pageNum < totalPages,
                    hasPrevPage: pageNum > 1
                }
            }
        });
    } catch (error) {
        console.error('Error getting expiring subscribers:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};

// Cancel subscription (Admin can cancel any subscription, users can cancel their own)
export const cancelSubscription = async (req: Request, res: Response) => {
    try {
        const { userId } = req.params;
        const { reason } = req.body || {};

        // Check if user is trying to cancel their own subscription or if admin/moderator
        const isAuthorized =
            req.user?.id === userId ||
            ['admin', 'moderator'].includes(req.user?.role || '');

        if (!isAuthorized) {
            return res.status(403).json({
                success: false,
                message: 'Unauthorized: You can only cancel your own subscription'
            });
        }

        // Find the user
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Check if user has an active subscription
        if (user.plan === 'free') {
            return res.status(400).json({
                success: false,
                message: 'User does not have an active paid subscription'
            });
        }

        // Check if subscription is already expired
        const now = new Date();
        const isExpired = user.renewalDate && user.renewalDate <= now;

        if (isExpired) {
            return res.status(400).json({
                success: false,
                message: 'Subscription is already expired'
            });
        }

        // Cancel subscription on Paystack first if it exists
        if (user.paystackSubscriptionId) {
            console.log(`Cancelling Paystack subscription: ${user.paystackSubscriptionId}`);
            const unsubscribeResult = await unsubscribePaystackSubscription(user.paystackSubscriptionId);
            if (!unsubscribeResult.success) {
                console.error('Failed to cancel Paystack subscription:', unsubscribeResult.error);
                // Continue anyway since we want to cancel locally even if Paystack fails
            } else {
                console.log('Paystack subscription cancelled successfully');
            }
        }

        // Cancel at end of billing period - keep current plan until renewal date
        // Just clear the paystack subscription ID so it won't auto-renew
        const updateData = {
            $set: {
                updatedAt: now
            },
            $unset: {
                paystackSubscriptionId: 1
            }
        };

        // Update the user
        const updatedUser = await User.findByIdAndUpdate(
            userId,
            updateData,
            { new: true, select: '-password' }
        );

        // Log the cancellation reason if provided
        if (reason) {
            console.log(`Subscription cancelled for user ${userId}. Reason: ${reason}`);
        }

        res.status(200).json({
            success: true,
            message: 'Subscription cancelled. User will remain on current plan until renewal date.',
            data: {
                user: updatedUser,
                cancellationType: 'end_of_period',
                cancelledAt: now,
                reason: reason || 'No reason provided'
            }
        });
    } catch (error) {
        console.error('Error cancelling subscription:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};

// Reactivate subscription (Admin only)
export const reactivateSubscription = async (req: Request, res: Response) => {
    try {
        const { userId } = req.params;
        const { plan, renewalDate, paystackSubscriptionId } = req.body;

        // Only admins and moderators can reactivate subscriptions
        if (!['admin', 'moderator'].includes(req.user?.role || '')) {
            return res.status(403).json({
                success: false,
                message: 'Unauthorized: Only admins can reactivate subscriptions'
            });
        }

        // Validate input
        if (!plan || !['monthly', 'yearly'].includes(plan)) {
            return res.status(400).json({
                success: false,
                message: 'Valid plan (monthly or yearly) is required'
            });
        }

        if (!renewalDate) {
            return res.status(400).json({
                success: false,
                message: 'Renewal date is required'
            });
        }

        // Find the user
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Update user subscription
        const updateData: any = {
            plan,
            renewalDate: new Date(renewalDate),
            updatedAt: new Date()
        };

        if (paystackSubscriptionId) {
            updateData.paystackSubscriptionId = paystackSubscriptionId;
        }

        const updatedUser = await User.findByIdAndUpdate(
            userId,
            updateData,
            { new: true, select: '-password' }
        );

        res.status(200).json({
            success: true,
            message: 'Subscription reactivated successfully',
            data: {
                user: updatedUser,
                reactivatedAt: new Date()
            }
        });
    } catch (error) {
        console.error('Error reactivating subscription:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};
