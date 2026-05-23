import mongoose, { Schema } from 'mongoose';
import type { RedemptionStatus } from '../types/shared.types.js';

export interface IRedemption {
  spectatorId: mongoose.Types.ObjectId;
  productId: mongoose.Types.ObjectId;
  pointsSpent: number;
  status: RedemptionStatus;
  quantity: number;
  totalPoints: number;
  deliveryNote?: string;
  adminNote?: string;
  processedBy?: mongoose.Types.ObjectId | null;
  processedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const RedemptionSchema = new Schema<IRedemption>(
  {
    spectatorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    pointsSpent: { type: Number, required: true, min: 1 },
    quantity: { type: Number, required: true, min: 1, default: 1 },
    totalPoints: { type: Number, required: true, min: 1 },
    status: {
      type: String,
      enum: ['pending', 'approved', 'fulfilled', 'rejected', 'refunded'],
      default: 'pending',
    },
    deliveryNote: { type: String, trim: true },
    adminNote: { type: String, trim: true },
    processedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    processedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

RedemptionSchema.pre('save', function (next) {
  this.totalPoints = this.pointsSpent * this.quantity;
  next();
});

RedemptionSchema.index({ spectatorId: 1, status: 1 });
RedemptionSchema.index({ productId: 1 });
RedemptionSchema.index({ status: 1 });
RedemptionSchema.index({ createdAt: -1 });

export const Redemption = mongoose.model<IRedemption>('Redemption', RedemptionSchema);
