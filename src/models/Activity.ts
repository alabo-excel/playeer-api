import { Schema, model, Document } from 'mongoose';

export interface IActivity extends Document {
  userId: string;
  type: 'user_registration' | 'user_login' | 'user_logout' | 'profile_update' | 'password_change' |
  'highlight_upload' | 'highlight_delete' | 'highlight_views' | 'profile_views' |
  'subscription_created' | 'subscription_canceled' | 'subscription_renewed' | 'subscription_expired' |
  'plan_created' | 'plan_updated' | 'plan_deleted' |
  'user_activated' | 'user_deactivated' | 'user_deleted' | 'user_verified' |
  'admin_action' | 'security' | 'system' | 'payment' | 'error';
  activityRefId?: string;
  description: string;
  userAgent?: string;
  metadata?: Record<string, any>;
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
    enum: [
      'user_registration', 'user_login', 'user_logout', 'profile_update', 'password_change',
      'highlight_upload', 'highlight_delete', 'highlight_views', 'profile_views',
      'subscription_created', 'subscription_canceled', 'subscription_renewed', 'subscription_expired',
      'plan_created', 'plan_updated', 'plan_deleted',
      'user_activated', 'user_deactivated', 'user_deleted', 'user_verified',
      'admin_action', 'security', 'system', 'payment', 'error'
    ],
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
  userAgent: {
    type: String,
    default: null
  },
  metadata: {
    type: Schema.Types.Mixed,
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const Activity = model<IActivity>('Activity', activitySchema);
export default Activity; 