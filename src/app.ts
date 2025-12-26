import express from 'express';
import cors from 'cors';
import cron from 'node-cron';
import { connectDB } from './config/database';
import authRoutes from './routes/authRoutes';
import userRoutes from './routes/userRoutes';
import onboardingRoutes from './routes/onboardingRoutes';
import highlightRoutes from './routes/highlightRoutes';
import paystackWebhookRoutes from './routes/paystackWebhookRoutes';
import subscriptionRoutes from './routes/subscriptionRoutes';
import planRoutes from './routes/planRoutes';
import playerEnquiryRoutes from './routes/playerEnquiryRoutes';
import { errorHandler } from './middlewares/errorHandler';
import User from './models/User';

const app = express();

// Enable CORS for all origins
app.use(cors());

// Connect to MongoDB
connectDB();

// Raw body for webhooks (before JSON parsing)
app.use('/api/webhook', express.raw({ type: 'application/json' }));

// JSON parsing for other routes
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/onboarding', onboardingRoutes);
app.use('/api/highlights', highlightRoutes);
app.use('/api/subscriptions', subscriptionRoutes);
app.use('/api/plans', planRoutes);
app.use('/api', paystackWebhookRoutes);
app.use('/api', playerEnquiryRoutes);

// Cron job to downgrade expired subscriptions
cron.schedule('0 0 * * *', async () => {
    try {
        console.log('Running daily cron job: Downgrading expired subscriptions...');

        const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);

        const result = await User.updateMany(
            {
                renewalDate: { $exists: true, $lt: twoDaysAgo },
                plan: { $in: ['monthly', 'yearly'] }
            },
            {
                $set: { plan: 'free' },
                $unset: { renewalDate: '', paystackSubscriptionId: '' },
                updatedAt: new Date()
            }
        );

        console.log(`Downgraded ${result.modifiedCount} expired subscriptions to free plan`);
    } catch (error) {
        console.error('Error in cron job - downgrading expired subscriptions:', error);
    }
});

// Global error handler (should be after routes)
app.use(errorHandler);

export default app;
