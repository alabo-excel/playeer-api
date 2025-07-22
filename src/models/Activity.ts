import { Schema, model, Document } from 'mongoose';

export interface IActivity extends Document {
  userId: string;
  type: 'highlight_upload' | 'highlight_views' | 'profile_views';
  activityRefId?: string;
  description: string;
  createdAt: Date;
}

const activitySchema = new Schema<IActivity>({
  userId: {
    type: String,
    required: true,
    ref: 'User'
  },
  type: {
    type: String,
    enum: ['highlight_upload', 'highlight_views', 'profile_views'],
    required: true
  },
  activityRefId: {
    type: String,
    default: null
  },
  description: {
    type: String,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const Activity = model<IActivity>('Activity', activitySchema);
export default Activity; 