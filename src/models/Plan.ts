import { Schema, model, Document, Types } from 'mongoose';

// Interface for Plan document
export interface IPlan extends Document {
    planName: 'free' | 'monthly' | 'yearly';
    displayName: string;
    description: string;
    price: number;
    perks: string[];
    isActive: boolean;
    isPopular: boolean;
    paystackPlanCode?: string;
    sortOrder: number;
    createdAt: Date;
    updatedAt: Date;
}

// Plan schema
const planSchema = new Schema<IPlan>({
    planName: {
        type: String,
        required: [true, 'Plan name is required'],
        enum: ['free', 'monthly', 'yearly'],
        default: 'free'
    },
    displayName: {
        type: String,
        required: [true, 'Display name is required'],
        trim: true,
        minlength: [2, 'Display name must be at least 2 characters long'],
        maxlength: [100, 'Display name cannot exceed 100 characters']
    },
    description: {
        type: String,
        required: [true, 'Plan description is required'],
        trim: true,
        minlength: [10, 'Description must be at least 10 characters long'],
        maxlength: [500, 'Description cannot exceed 500 characters']
    },
    price: {
        type: Number,
        required: [true, 'Plan price is required'],
        min: [0, 'Price cannot be negative'],
        max: [999999.99, 'Price cannot exceed 999,999.99']
    },
    perks: [{
        type: String,
        required: true,
        trim: true,
        maxlength: [200, 'Perk description cannot exceed 200 characters']
    }],
    isActive: {
        type: Boolean,
        default: true
    },
    isPopular: {
        type: Boolean,
        default: false
    },
    paystackPlanCode: {
        type: String,
        unique: true,
        sparse: true,
        trim: true,
        maxlength: [100, 'Paystack plan code cannot exceed 100 characters']
    },
    sortOrder: {
        type: Number,
        required: [true, 'Sort order is required'],
        min: [0, 'Sort order cannot be negative'],
        default: 0
    }
}, {
    timestamps: true,
    toJSON: {
        transform: function (doc: any, ret: any) {
            // Remove any sensitive data if needed
            return ret;
        }
    },
    toObject: {
        transform: function (doc: any, ret: any) {
            // Remove any sensitive data if needed
            return ret;
        }
    }
});

// Indexes for better query performance
planSchema.index({ isActive: 1 });
planSchema.index({ sortOrder: 1 });
planSchema.index({ price: 1 });
planSchema.index({ isPopular: 1 });
planSchema.index({ planName: 1 });

// Compound index for common queries
planSchema.index({ isActive: 1, sortOrder: 1 });
planSchema.index({ planName: 1, isActive: 1 });

// Unique compound index - only one active plan per planName
planSchema.index(
    { planName: 1, isActive: 1 },
    {
        unique: true,
        partialFilterExpression: { isActive: true },
        name: 'unique_active_plan_per_name'
    }
);

// Static method to find active plans
planSchema.statics.findActivePlans = function () {
    return this.find({ isActive: true }).sort({ sortOrder: 1 });
};

// Static method to find plan by planName
planSchema.statics.findByPlanName = function (planName: string) {
    return this.find({ isActive: true, planName }).sort({ sortOrder: 1 });
};

// Pre-save middleware to ensure only one popular plan per planName
planSchema.pre('save', async function (this: IPlan, next: any) {
    if (this.isPopular && this.isModified('isPopular')) {
        try {
            // Remove popular flag from other plans of the same planName
            const Plan = this.constructor as any;
            await Plan.updateMany(
                {
                    planName: this.planName,
                    _id: { $ne: this._id },
                    isPopular: true
                },
                { isPopular: false }
            );
            next();
        } catch (error) {
            next(error as Error);
        }
    } else {
        next();
    }
});

// Pre-save middleware to set price to 0 for free plans
planSchema.pre('save', function (this: IPlan, next: any) {
    // Auto-set price to 0 for free plans
    if (this.planName === 'free') {
        this.price = 0;
    }

    next();
});

// Create and export the model
const Plan = model<IPlan>('Plan', planSchema);

export default Plan;
