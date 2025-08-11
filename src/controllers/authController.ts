import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import User, { IUser } from '../models/User';
import config from '../config/config';
import { sendMail } from '../middlewares/sendMail';

// Generate JWT Token
const generateToken = (userId: string): string => {
  return jwt.sign({ userId }, config.jwtSecret, {
    expiresIn: '7d'
  });
};

const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();


// Register new user
export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, phone, username, password, fullName } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({
      $or: [
        { email: email?.toLowerCase() },
        { phone: phone },
        { username: username }
      ]
    });

    if (existingUser) {
      res.status(400).json({
        success: false,
        message: 'User with this email or phone Number already exists'
      });
      return;
    }

    // Hash password
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Create user with hashed password
    const user = await User.create({
      fullName,
      username,
      phone,
      password: hashedPassword,
      email: email?.toLowerCase()
    });

    const otp = generateOTP();
    // const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // expires in 10 mins
    user.otp = otp;
    // user.otpExpires = otpExpires;
    await user.save();


    await sendMail({
      to: user.email,
      subject: 'Account Verification',
      text: `Your OTP is ${otp}`
    });
    // Generate JWT token
    const token = generateToken((user as IUser)._id.toString());

    //  Remove password from response
    const userResponse = user.toObject();
    delete (userResponse as any).password;

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: userResponse,
      token
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
        message: 'Error registering user',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
};

export const verifyOtp = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      res.status(400).json({ success: false, message: 'Email and OTP are required.' });
      return;
    }

    const user = await User.findOne({ email: email.toLowerCase() });

    if (!user) {
      res.status(404).json({ success: false, message: 'User not found.' });
      return;
    }

    if (user.isVerified) {
      res.status(400).json({ success: false, message: 'User is already verified.' });
      return;
    }

    if (user.otp !== otp) {
      res.status(400).json({ success: false, message: 'Invalid or expired OTP.' });
      return;
    }

    user.otpVerified = true;
    user.otp = null;
    await user.save();

    // Generate JWT token
    const token = generateToken((user as IUser)._id.toString());

    // Remove password from response
    const userResponse = user.toObject();
    delete (userResponse as any).password;

    res.status(200).json({ 
      success: true, 
      message: 'User verified successfully.',
      data: userResponse,
      token
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'OTP verification failed.',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

// Login user
export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({
        success: false,
        message: 'Email and password are required'
      });
      return;
    }

    // Find user by email
    const user = await User.findOne({ email: email.toLowerCase() });

    if (!user) {
      res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
      return;
    }

    // Restrict login for deleted or inactive accounts
    if (user.isDeleted) {
      res.status(403).json({
        success: false,
        message: 'Account with this email does not exist or has been deleted'
      });
      return;
    }
    if (!user.isActive) {
      res.status(403).json({
        success: false,
        message: 'Account is deactivated. Please contact support.'
      });
      return;
    }

    // Compare password
    const isPasswordValid = await bcrypt.compare(password, user?.password);

    if (!isPasswordValid) {
      res.status(401).json({
        success: false,
        message: 'Incorect password'
      });
      return;
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    // Generate JWT token
    const token = generateToken((user as IUser)._id.toString());

    // Remove password from response
    const userResponse = user.toObject();
    delete (userResponse as any).password;

    res.status(200).json({
      success: true,
      message: 'Login successful',
      data: userResponse,
      token
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error during login',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Change password
export const changePassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.id;
    const { currentPassword, newPassword } = req.body;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
      return;
    }

    if (!currentPassword || !newPassword) {
      res.status(400).json({
        success: false,
        message: 'Current password and new password are required'
      });
      return;
    }

    const user = await User.findById(userId);

    if (!user) {
      res.status(404).json({
        success: false,
        message: 'User not found'
      });
      return;
    }

    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);

    if (!isCurrentPasswordValid) {
      res.status(400).json({
        success: false,
        message: 'Current password is incorrect'
      });
      return;
    }

    // Hash new password
    const saltRounds = 12;
    const hashedNewPassword = await bcrypt.hash(newPassword, saltRounds);

    // Update password
    user.password = hashedNewPassword;
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Password changed successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error changing password',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Forgot password (send reset email)
export const forgotPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email } = req.body;

    if (!email) {
      res.status(400).json({
        success: false,
        message: 'Email is required'
      });
      return;
    }

    const user = await User.findOne({ email: email.toLowerCase() });

    if (!user) {
      // Don't reveal if user exists or not for security
      res.status(200).json({
        success: true,
        message: 'If an account with that email exists, a password reset link has been sent'
      });
      return;
    }

    // Generate reset token (expires in 1 hour)
    const resetToken = jwt.sign(
      { userId: (user as IUser)._id.toString(), type: 'password-reset' },
      config.jwtSecret,
      { expiresIn: '1h' }
    );

    // Send email with reset link
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000/reset-password';
    const resetLink = `${frontendUrl}auth/reset-password?token=${resetToken}`;
    const mailText = `You requested a password reset. Click the link below to reset your password:\n${resetLink}\n\nIf you did not request this, please ignore this email.`;
    await sendMail({ to: user.email, subject: 'Password Reset', text: mailText });
    console.log('Password reset link:', resetLink);

    res.status(200).json({
      success: true,
      message: 'If an account with that email exists, a password reset link has been sent'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error processing forgot password request',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Reset password
export const resetPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      res.status(400).json({
        success: false,
        message: 'Token and new password are required'
      });
      return;
    }

    // Verify token
    const decoded = jwt.verify(token, config.jwtSecret) as any;

    if (decoded.type !== 'password-reset') {
      res.status(400).json({
        success: false,
        message: 'Invalid reset token'
      });
      return;
    }

    const user = await User.findById(decoded.userId);

    if (!user) {
      res.status(404).json({
        success: false,
        message: 'User not found'
      });
      return;
    }

    // Hash new password
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

    // Update password
    user.password = hashedPassword;
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Password reset successfully'
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'JsonWebTokenError') {
      res.status(400).json({
        success: false,
        message: 'Invalid or expired reset token'
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Error resetting password',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
};

// Logout (client-side token removal)
export const logout = async (req: Request, res: Response): Promise<void> => {
  try {
    // In a stateless JWT system, logout is handled client-side
    // You could implement a blacklist for tokens if needed
    res.status(200).json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error during logout',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};
