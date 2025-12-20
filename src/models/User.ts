import { Schema, model, Document, Types } from 'mongoose';

// Interface for User document
export interface FootballJourneyEntry {
  teamName: string;
  position: string;
  from: Date;
  to: Date;
  keyHighlights?: string;
}

export interface Achievement {
  title: string;
  competitionName: string;
  organizer: string;
  date: Date;
  description?: string;
  photo?: string;
}

export interface Certificate {
  certificateTitle: string;
  issuedBy: string;
  dateIssued: Date;
  description?: string;
  photo?: string;
}

export interface IUser extends Document {
  fullName: string;
  email: string;
  password: string;
  otp?: string | null;
  otpVerified: boolean;
  username?: string;
  phone?: string;
  address?: string;
  dateOfBirth?: Date;
  profilePicture?: string;
  country?: string;
  city?: string;
  gender?: 'male' | 'female' | 'other';
  height?: string;
  weight?: string;
  currentTeam?: string;
  previousClub?: string;
  yearsOfExperience?: string;
  mainPosition?: string;
  secondaryPosition?: string;
  dominantFoot?: 'left' | 'right' | 'both';
  jerseyNumber?: string;
  plan: 'free' | 'monthly' | 'yearly';
  renewalDate?: Date;
  profileViews?: string[];
  highlightPlays?: number;
  footballJourney?: FootballJourneyEntry[];
  achievements?: Achievement[];
  certificates?: Certificate[];
  welcome: boolean;
  isActive: boolean;
  isVerified: boolean;
  isDeleted: boolean;
  role: 'user' | 'admin' | 'moderator';
  lastLogin?: Date;
  createdAt: Date;
  updatedAt: Date;
  visibility: 'public' | 'private';
  paystackSubscriptionId?: string;
  // Methods
  // comparePassword(candidatePassword: string): Promise<boolean>;
}

// User schema
const footballJourneySchema = new Schema<FootballJourneyEntry>({
  teamName: {
    type: String,
    required: true,
    trim: true,
    maxlength: [100, 'Team name cannot exceed 100 characters']
  },
  position: {
    type: String,
    required: true,
    trim: true,
    maxlength: [50, 'Position cannot exceed 50 characters']
  },
  from: {
    type: Date,
    required: true
  },
  to: {
    type: Date,
    required: true
  },
  keyHighlights: {
    type: String,
    trim: true,
    maxlength: [1000, 'Key highlights cannot exceed 1000 characters']
  }
});

// Achievement schema
const achievementSchema = new Schema<Achievement>({
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: [100, 'Title cannot exceed 100 characters']
  },
  competitionName: {
    type: String,
    required: true,
    trim: true,
    maxlength: [100, 'Competition name cannot exceed 100 characters']
  },
  organizer: {
    type: String,
    required: true,
    trim: true,
    maxlength: [100, 'Organizer cannot exceed 100 characters']
  },
  date: {
    type: Date,
    required: true
  },
  description: {
    type: String,
    trim: true,
    maxlength: [1000, 'Description cannot exceed 1000 characters']
  },
  photo: {
    type: String,
    trim: true
  }
});

// Certificate schema
const certificateSchema = new Schema<Certificate>({
  certificateTitle: {
    type: String,
    required: true,
    trim: true,
    maxlength: [100, 'Certificate title cannot exceed 100 characters']
  },
  issuedBy: {
    type: String,
    required: true,
    trim: true,
    maxlength: [100, 'Issued by cannot exceed 100 characters']
  },
  dateIssued: {
    type: Date,
    required: true
  },
  description: {
    type: String,
    trim: true,
    maxlength: [1000, 'Description cannot exceed 1000 characters']
  },
  photo: {
    type: String,
    trim: true
  }
});

const userSchema = new Schema<IUser>({
  fullName: {
    type: String,
    required: [true, 'Full name is required'],
    trim: true,
    minlength: [2, 'Full name must be at least 2 characters long'],
    maxlength: [100, 'Full name cannot exceed 100 characters']
  },
  otp: {
    type: String,
    required: false,
  },
  otpVerified: {
    type: Boolean,
    default: false
  },
  paystackSubscriptionId: { type: String },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [
      /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
      'Please enter a valid email address'
    ]
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters long']
  },
  phone: {
    type: String,
    trim: true,
    maxlength: [15, 'Phone number cannot exceed 15 characters']
  },
  address: {
    type: String,
    trim: true,
    maxlength: [100, 'Address cannot exceed 100 characters']
  },
  username: {
    type: String,
    unique: true,
    sparse: true,
    trim: true,
    minlength: [3, 'Username must be at least 3 characters long'],
    maxlength: [30, 'Username cannot exceed 30 characters'],
    match: [/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores']
  },
  dateOfBirth: {
    type: Date,
    validate: {
      validator: function (value: Date) {
        return !value || value < new Date();
      },
      message: 'Date of birth cannot be in the future'
    }
  },
  profilePicture: {
    type: String,
    default: null
  },
  country: {
    type: String,
    trim: true,
    maxlength: [56, 'Country name cannot exceed 56 characters']
  },
  city: {
    type: String,
    trim: true,
    maxlength: [85, 'City name cannot exceed 85 characters']
  },
  gender: {
    type: String,
    enum: ['male', 'female', 'other'],
    default: 'other'
  },
  height: {
    type: String,
    trim: true,
    maxlength: [10, 'Height cannot exceed 10 characters']
  },
  weight: {
    type: String,
    trim: true,
    maxlength: [10, 'Weight cannot exceed 10 characters']
  },
  currentTeam: {
    type: String,
    trim: true,
    maxlength: [100, 'Team name cannot exceed 100 characters']
  },
  previousClub: {
    type: String,
    trim: true,
    maxlength: [500, 'Previous clubs cannot exceed 500 characters']
  },
  yearsOfExperience: {
    type: String,
    trim: true,
    maxlength: [10, 'Years of experience cannot exceed 10 characters']
  },
  mainPosition: {
    type: String,
    trim: true,
    maxlength: [50, 'Position cannot exceed 50 characters']
  },
  secondaryPosition: {
    type: String,
    trim: true,
    maxlength: [100, 'Secondary positions cannot exceed 100 characters']
  },
  dominantFoot: {
    type: String,
    enum: ['left', 'right', 'both'],
    default: 'right'
  },
  jerseyNumber: {
    type: String,
    trim: true,
    maxlength: [10, 'Jersey number cannot exceed 10 characters']
  },
  plan: {
    type: String,
    enum: ['free', 'monthly', 'yearly'],
    default: 'free'
  },
  renewalDate: {
    type: Date
  },
  profileViews: [{
    type: String,
    ref: 'User'
  }],
  footballJourney: [footballJourneySchema],
  achievements: [achievementSchema],
  certificates: [certificateSchema],
  welcome: {
    type: Boolean,
    default: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  isDeleted: {
    type: Boolean,
    default: false
  },
  role: {
    type: String,
    enum: ['user', 'admin', 'moderator'],
    default: 'user'
  },
  lastLogin: {
    type: Date,
    default: null
  },
  visibility: {
    type: String,
    enum: ['public', 'private'],
    default: 'public'
  }
}, {
  timestamps: true,
  toJSON: {
    transform: function (doc: any, ret: any) {
      delete ret.password;
      return ret;
    }
  },
  toObject: {
    transform: function (doc: any, ret: any) {
      delete ret.password;
      return ret;
    }
  }
});

// Indexes for better query performance
userSchema.index({ isActive: 1 });
userSchema.index({ role: 1 });

// Pre-save middleware to hash password
// userSchema.pre('save', async function(this: IUser, next: any) {
//   // Only hash the password if it has been modified (or is new)
//   if (!this.isModified('password')) return next();

//   try {
//     // Password hashing is now handled in the auth controller
//     // This ensures passwords are always hashed before saving
//     const bcrypt = require('bcrypt');
//     this.password = await bcrypt.hash(this.password, 12);
//     next();
//   } catch (error) {
//     next(error as Error);
//   }
// });

// Method to compare password
// userSchema.methods.comparePassword = async function(candidatePassword: string): Promise<boolean> {
//   try {
//     // Here you would compare with bcrypt
//     const bcrypt = require('bcrypt');
//     return await bcrypt.compare(candidatePassword, this.password);
//     return candidatePassword === this.password; // Temporary simple comparison
//   } catch (error) {
//     return false;
//   }
// };

// Static method to find active users
userSchema.statics.findActiveUsers = function () {
  return this.find({ isActive: true });
};

// Static method to find users by role
userSchema.statics.findByRole = function (role: string) {
  return this.find({ role });
};

// Create and export the model
const User = model<IUser>('User', userSchema);

export default User;
