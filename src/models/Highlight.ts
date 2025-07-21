import { Schema, model, Document } from 'mongoose';

export interface IHighlight extends Document {
  title: string;
  video: string;
  description?: string;
  tags?: string;
  views: string[]; // Array of user IDs
  userId: string; // ID of the user who created the highlight
}

const highlightSchema = new Schema<IHighlight>({
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: [100, 'Title cannot exceed 100 characters']
  },
  video: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true,
    maxlength: [1000, 'Description cannot exceed 1000 characters']
  },
  tags: {
    type: String,
    trim: true,
    maxlength: [200, 'Tags cannot exceed 200 characters']
  },
  views: [{
    type: String,
    ref: 'User'
  }],
  userId: {
    type: String,
    required: true,
    ref: 'User'
  }
}, {
  timestamps: true
});

const Highlight = model<IHighlight>('Highlight', highlightSchema);
export default Highlight; 