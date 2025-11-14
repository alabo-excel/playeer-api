import { Request, Response } from 'express';
import Plan from '../models/Plan';
import {
    createPaystackPlan,
    updatePaystackPlan,
    deactivatePaystackPlan,
    PaystackPlanData
} from '../utils/paystack';

// Create a new plan (Admin only) - Also creates on Paystack
export const createPlan = async (req: Request, res: Response) => {
    try {
        const {
            planName,
            price,
            perks,
            displayName,
            description,
            isPopular = false,
            sortOrder = 0
        } = req.body;

        // Validate required fields based on your frontend
        if (!planName || !price || !perks || !Array.isArray(perks)) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields: planName, price, perks'
            });
        }

        // Validate planName
        if (!['free', 'monthly', 'yearly'].includes(planName)) {
            return res.status(400).json({
                success: false,
                message: 'planName must be one of: free, monthly, yearly'
            });
        }

        // Check if we already have 3 plans (free, monthly, yearly limit)
        const totalPlans = await Plan.countDocuments({});
        if (totalPlans >= 3) {
            return res.status(409).json({
                success: false,
                message: 'Maximum number of plans (3) already exists. Cannot create more plans.'
            });
        }

        // Check if plan with same planName already exists
        const existingPlan = await Plan.findOne({ planName, isActive: true });
        if (existingPlan) {
            return res.status(409).json({
                success: false,
                message: 'Plan with this name already exists'
            });
        }

        // Validate perks array
        if (perks.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'At least one perk is required'
            });
        }

        // For free plans, price should be 0
        const finalPrice = planName === 'free' ? 0 : parseFloat(price);

        let paystackPlanCode = undefined;

        // Create plan on Paystack only for paid plans
        if (planName !== 'free' && finalPrice > 0) {
            const paystackPlanData: PaystackPlanData = {
                name: displayName || `${planName.charAt(0).toUpperCase() + planName.slice(1)} Plan`,
                interval: planName === 'yearly' ? 'annually' : 'monthly',
                amount: finalPrice * 100, // Convert to kobo
                currency: 'NGN',
                description: description || `${planName} subscription plan with ${perks.length} perks`,
                send_invoices: true,
                send_sms: false
            };

            const paystackResult = await createPaystackPlan(paystackPlanData);

            if (!paystackResult.success) {
                return res.status(500).json({
                    success: false,
                    message: 'Failed to create plan on Paystack',
                    error: paystackResult.error
                });
            }

            paystackPlanCode = paystackResult.planCode;
        }

        // Create new plan in database
        const planData = {
            planName,
            displayName: displayName || `${planName.charAt(0).toUpperCase() + planName.slice(1)} Plan`,
            description: description || `${planName} subscription plan`,
            price: finalPrice,
            perks: perks.map((perk: string) => perk.trim()).filter(Boolean),
            isPopular,
            paystackPlanCode,
            sortOrder: parseInt(sortOrder) || 0
        };

        const newPlan = new Plan(planData);
        await newPlan.save();

        res.status(201).json({
            success: true,
            message: 'Plan created successfully',
            data: {
                plan: newPlan,
                paystackPlanCode: paystackPlanCode || null
            }
        });
    } catch (error) {
        console.error('Error creating plan:', error);
        if (error instanceof Error && error.name === 'ValidationError') {
            return res.status(400).json({
                success: false,
                message: 'Validation error',
                error: error.message
            });
        }
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};

// Get all plans with filtering and sorting
export const getAllPlans = async (req: Request, res: Response) => {
    try {
        const {
            page = 1,
            limit = 10,
            isActive,
            planName,
            minPrice,
            maxPrice,
            isPopular,
            sortBy = 'sortOrder',
            sortOrder = 'asc',
            includeInactive = false
        } = req.query;

        // Build query
        const query: any = {};

        // Filter by active status (default to active only unless admin requests otherwise)
        if (isActive !== undefined) {
            query.isActive = isActive === 'true';
        } else if (!includeInactive || includeInactive === 'false') {
            query.isActive = true;
        }

        // Filter by planName
        if (planName && ['free', 'monthly', 'yearly'].includes(planName as string)) {
            query.planName = planName;
        }

        // Filter by price range
        if (minPrice || maxPrice) {
            query.price = {};
            if (minPrice) query.price.$gte = parseFloat(minPrice as string);
            if (maxPrice) query.price.$lte = parseFloat(maxPrice as string);
        }

        // Filter by popular status
        if (isPopular !== undefined) {
            query.isPopular = isPopular === 'true';
        }

        // Calculate pagination
        const pageNum = parseInt(page as string, 10);
        const limitNum = parseInt(limit as string, 10);
        const skip = (pageNum - 1) * limitNum;

        // Build sort object
        const sortObj: any = {};
        sortObj[sortBy as string] = sortOrder === 'asc' ? 1 : -1;

        // Execute query
        const plans = await Plan.find(query)
            .sort(sortObj)
            .skip(skip)
            .limit(limitNum)
            .lean();

        // Get total count
        const totalPlans = await Plan.countDocuments(query);

        // Calculate pagination info
        const totalPages = Math.ceil(totalPlans / limitNum);
        const hasNextPage = pageNum < totalPages;
        const hasPrevPage = pageNum > 1;

        res.status(200).json({
            success: true,
            message: 'Plans retrieved successfully',
            data: {
                plans,
                pagination: {
                    currentPage: pageNum,
                    totalPages,
                    totalPlans,
                    limit: limitNum,
                    hasNextPage,
                    hasPrevPage
                }
            }
        });
    } catch (error) {
        console.error('Error getting plans:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};

// Get active plans for public display
export const getActivePlans = async (req: Request, res: Response) => {
    try {
        const { planName } = req.query;

        const query: any = { isActive: true };

        // Filter by planName (free, monthly, yearly)
        if (planName && ['free', 'monthly', 'yearly'].includes(planName as string)) {
            query.planName = planName;
        }

        const plans = await Plan.find(query)
            .sort({ sortOrder: 1, price: 1 })
            .lean();

        res.status(200).json({
            success: true,
            message: 'Active plans retrieved successfully',
            data: { plans }
        });
    } catch (error) {
        console.error('Error getting active plans:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};

// Get plan by ID
export const getPlanById = async (req: Request, res: Response) => {
    try {
        const { planId } = req.params;

        const plan = await Plan.findById(planId);
        if (!plan) {
            return res.status(404).json({
                success: false,
                message: 'Plan not found'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Plan retrieved successfully',
            data: { plan }
        });
    } catch (error) {
        console.error('Error getting plan:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};

// Update plan (Admin only) - Also updates on Paystack
export const updatePlan = async (req: Request, res: Response) => {
    try {
        const { planId } = req.params;
        const updateData = req.body;

        // Remove fields that shouldn't be updated directly
        delete updateData._id;
        delete updateData.createdAt;
        delete updateData.updatedAt;
        delete updateData.paystackPlanCode; // Don't allow direct update of paystack plan code

        // Find the current plan
        const currentPlan = await Plan.findById(planId);
        if (!currentPlan) {
            return res.status(404).json({
                success: false,
                message: 'Plan not found'
            });
        }

        // If updating planName, ensure it's unique
        if (updateData.planName && updateData.planName !== currentPlan.planName) {
            const existingPlan = await Plan.findOne({
                planName: updateData.planName,
                _id: { $ne: planId },
                isActive: true
            });
            if (existingPlan) {
                return res.status(409).json({
                    success: false,
                    message: 'Plan with this name already exists'
                });
            }
        }

        // Validate planName if provided
        if (updateData.planName && !['free', 'monthly', 'yearly'].includes(updateData.planName)) {
            return res.status(400).json({
                success: false,
                message: 'planName must be one of: free, monthly, yearly'
            });
        }

        // Trim string fields
        if (updateData.displayName) updateData.displayName = updateData.displayName.trim();
        if (updateData.description) updateData.description = updateData.description.trim();
        if (updateData.currency) updateData.currency = updateData.currency.toUpperCase();

        // Clean perks array
        if (updateData.perks && Array.isArray(updateData.perks)) {
            updateData.perks = updateData.perks.map((perk: string) => perk.trim()).filter(Boolean);
            if (updateData.perks.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'At least one perk is required'
                });
            }
        }

        // Handle price update for free plans
        if (updateData.planName === 'free') {
            updateData.price = 0;
        }

        // Update plan on Paystack if it's a paid plan and has paystack plan code
        if (currentPlan.paystackPlanCode && currentPlan.planName !== 'free') {
            const paystackUpdateData: any = {};

            if (updateData.displayName) paystackUpdateData.name = updateData.displayName;
            if (updateData.description) paystackUpdateData.description = updateData.description;
            if (updateData.price) paystackUpdateData.amount = parseFloat(updateData.price) * 100; // Convert to kobo

            if (Object.keys(paystackUpdateData).length > 0) {
                const paystackResult = await updatePaystackPlan(currentPlan.paystackPlanCode, paystackUpdateData);

                if (!paystackResult.success) {
                    console.error('Failed to update plan on Paystack:', paystackResult.error);
                    // Continue with local update even if Paystack update fails
                }
            }
        }

        const updatedPlan = await Plan.findByIdAndUpdate(
            planId,
            updateData,
            { new: true, runValidators: true }
        );

        res.status(200).json({
            success: true,
            message: 'Plan updated successfully',
            data: { plan: updatedPlan }
        });
    } catch (error) {
        console.error('Error updating plan:', error);
        if (error instanceof Error && error.name === 'ValidationError') {
            return res.status(400).json({
                success: false,
                message: 'Validation error',
                error: error.message
            });
        }
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};

// Toggle plan active status (Admin only)
export const togglePlanStatus = async (req: Request, res: Response) => {
    try {
        const { planId } = req.params;

        const plan = await Plan.findById(planId);
        if (!plan) {
            return res.status(404).json({
                success: false,
                message: 'Plan not found'
            });
        }

        plan.isActive = !plan.isActive;
        await plan.save();

        res.status(200).json({
            success: true,
            message: `Plan ${plan.isActive ? 'activated' : 'deactivated'} successfully`,
            data: { plan }
        });
    } catch (error) {
        console.error('Error toggling plan status:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};

// Delete plan (Admin only) - Soft delete and deactivate on Paystack
export const deletePlan = async (req: Request, res: Response) => {
    try {
        const { planId } = req.params;

        const plan = await Plan.findById(planId);
        if (!plan) {
            return res.status(404).json({
                success: false,
                message: 'Plan not found'
            });
        }

        // Deactivate plan on Paystack if it has a plan code
        if (plan.paystackPlanCode && plan.planName !== 'free') {
            const paystackResult = await deactivatePaystackPlan(plan.paystackPlanCode);

            if (!paystackResult.success) {
                console.error('Failed to deactivate plan on Paystack:', paystackResult.error);
                // Continue with local deletion even if Paystack deactivation fails
            }
        }

        // Soft delete by setting isActive to false
        plan.isActive = false;
        await plan.save();

        res.status(200).json({
            success: true,
            message: 'Plan deleted successfully',
            data: { planId }
        });
    } catch (error) {
        console.error('Error deleting plan:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};

// Set plan as popular (Admin only)
export const setPlanPopular = async (req: Request, res: Response) => {
    try {
        const { planId } = req.params;

        const plan = await Plan.findById(planId);
        if (!plan) {
            return res.status(404).json({
                success: false,
                message: 'Plan not found'
            });
        }

        plan.isPopular = true;
        await plan.save(); // Pre-save middleware will handle removing popular flag from others

        res.status(200).json({
            success: true,
            message: 'Plan marked as popular successfully',
            data: { plan }
        });
    } catch (error) {
        console.error('Error setting plan as popular:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};

// Get plan statistics (Admin only)
export const getPlanStats = async (req: Request, res: Response) => {
    try {
        // Get plan counts by various categories
        const stats = await Plan.aggregate([
            {
                $group: {
                    _id: null,
                    totalPlans: { $sum: 1 },
                    activePlans: { $sum: { $cond: ['$isActive', 1, 0] } },
                    inactivePlans: { $sum: { $cond: ['$isActive', 0, 1] } },
                    popularPlans: { $sum: { $cond: ['$isPopular', 1, 0] } },
                    averagePrice: { $avg: '$price' },
                    minPrice: { $min: '$price' },
                    maxPrice: { $max: '$price' },
                    plansByType: {
                        $push: {
                            planName: '$planName',
                            isActive: '$isActive'
                        }
                    }
                }
            }
        ]);

        // Get plan breakdown by planName
        const planNameStats = await Plan.aggregate([
            {
                $group: {
                    _id: '$planName',
                    total: { $sum: 1 },
                    active: { $sum: { $cond: ['$isActive', 1, 0] } },
                    averagePrice: { $avg: '$price' }
                }
            }
        ]);

        const formattedStats = stats[0] || {
            totalPlans: 0,
            activePlans: 0,
            inactivePlans: 0,
            popularPlans: 0,
            averagePrice: 0,
            minPrice: 0,
            maxPrice: 0
        };

        // Format plan name stats
        const planBreakdown = planNameStats.reduce((acc: any, curr: any) => {
            acc[curr._id] = {
                total: curr.total,
                active: curr.active,
                averagePrice: curr.averagePrice
            };
            return acc;
        }, {});

        res.status(200).json({
            success: true,
            message: 'Plan statistics retrieved successfully',
            data: {
                overview: formattedStats,
                planBreakdown
            }
        });
    } catch (error) {
        console.error('Error getting plan stats:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};

// Sync plan with Paystack (Admin only) - Create or update plan on Paystack
export const syncPlanWithPaystack = async (req: Request, res: Response) => {
    try {
        const { planId } = req.params;

        const plan = await Plan.findById(planId);
        if (!plan) {
            return res.status(404).json({
                success: false,
                message: 'Plan not found'
            });
        }

        // Skip sync for free plans
        if (plan.planName === 'free') {
            return res.status(400).json({
                success: false,
                message: 'Free plans cannot be synced with Paystack'
            });
        }

        const paystackPlanData: PaystackPlanData = {
            name: plan.displayName,
            interval: plan.planName === 'yearly' ? 'annually' : 'monthly',
            amount: plan.price * 100, // Convert to kobo
            currency: 'NGN', // Default to NGN since we removed currency field
            description: plan.description,
            send_invoices: true,
            send_sms: false
        };

        let paystackResult;

        if (plan.paystackPlanCode) {
            // Update existing plan on Paystack
            paystackResult = await updatePaystackPlan(plan.paystackPlanCode, paystackPlanData);
        } else {
            // Create new plan on Paystack
            paystackResult = await createPaystackPlan(paystackPlanData);

            if (paystackResult.success && paystackResult.planCode) {
                // Update local plan with new Paystack plan code
                plan.paystackPlanCode = paystackResult.planCode;
                await plan.save();
            }
        }

        if (!paystackResult.success) {
            return res.status(500).json({
                success: false,
                message: 'Failed to sync plan with Paystack',
                error: paystackResult.error
            });
        }

        res.status(200).json({
            success: true,
            message: 'Plan synced with Paystack successfully',
            data: {
                plan,
                paystackData: paystackResult.planData
            }
        });
    } catch (error) {
        console.error('Error syncing plan with Paystack:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};
