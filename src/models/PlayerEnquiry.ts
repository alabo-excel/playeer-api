import mongoose, { Document, Schema } from 'mongoose';

export interface IPlayerEnquiry extends Document {
    name: string;
    email: string;
    phone?: string;
    inquiryType: 'player_signing' | 'negotiations' | 'more_information' | 'expression_of_interest' | 'others' | '';
    designation: 'agent' | 'scout' | 'club' | 'academy' | 'coach' | 'broker' | 'others' | '';
    message?: string;
    playerId: string;
    createdAt: Date;
    updatedAt: Date;
}

const PlayerEnquirySchema: Schema = new Schema(
    {
        name: { type: String, required: true, trim: true },
        email: { type: String, required: true, trim: true, lowercase: true },
        phone: { type: String, trim: true },
        inquiryType: { type: String, enum: ['player_signing', 'negotiations', 'more_information', 'expression_of_interest', 'others', ''], default: '' },
        designation: { type: String, enum: ['agent', 'scout', 'club', 'academy', 'coach', 'broker', 'others', ''], default: '' },
        message: { type: String, trim: true },
        playerId: { type: String, required: true, index: true }
    },
    { timestamps: true }
);

PlayerEnquirySchema.index({ email: 1 });
PlayerEnquirySchema.index({ playerId: 1 });

export default mongoose.model<IPlayerEnquiry>('PlayerEnquiry', PlayerEnquirySchema);
