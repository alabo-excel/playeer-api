import express from 'express';
import cors from 'cors';
import { connectDB } from './config/database';
import authRoutes from './routes/authRoutes';
import userRoutes from './routes/userRoutes';
import onboardingRoutes from './routes/onboardingRoutes';
import highlightRoutes from './routes/highlightRoutes';
import { errorHandler } from './middlewares/errorHandler';

const app = express();

// Enable CORS for all origins
app.use(cors());

// Connect to MongoDB
connectDB();

app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/onboarding', onboardingRoutes);
app.use('/api/highlights', highlightRoutes);

// Global error handler (should be after routes)
app.use(errorHandler);

export default app;
