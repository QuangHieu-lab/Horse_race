import mongoose, { Schema } from 'mongoose';
import type { ViolationCategory, ViolationSeverity, PenaltyApplied } from '../types/shared.types.js';

export interface IViolationRule {
  code: string;
  name: string;
  description: string;
  category: ViolationCategory;
  severity: ViolationSeverity;
  penaltyApplied: PenaltyApplied;
  banDurationDays: number;
  isActive: boolean;
  createdBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const ViolationRuleSchema = new Schema<IViolationRule>(
  {
    code: { type: String, required: true, unique: true, trim: true, uppercase: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, required: true },
    category: {
      type: String,
      enum: ['race_conduct', 'medical', 'equipment', 'administrative'],
      required: true,
    },
    severity: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical'],
      default: 'medium',
    },
    penaltyApplied: {
      type: String,
      enum: ['warning', 'fine', 'disqualify','disqualification', 'time_ban', 'permanent_ban'],
      required: true,
    },
    banDurationDays: { type: Number, min: 0, default: 0 },
    isActive: { type: Boolean, default: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true },
);


ViolationRuleSchema.index({ category: 1, isActive: 1 });
ViolationRuleSchema.index({ penaltyType: 1 });

export const ViolationRule = mongoose.model<IViolationRule>('ViolationRule', ViolationRuleSchema);