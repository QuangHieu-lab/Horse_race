import mongoose, { Schema, Document } from 'mongoose';

export interface IViolationRule extends Document {
  code: string;
  name: string;
  description: string;
  category: 'race_conduct' | 'medical' | 'equipment' | 'administrative';
  severity: 'low' | 'medium' | 'high' | 'critical';

  // Đối tượng mà luật này áp dụng: ngựa, nài ngựa, hoặc cả hai.
  appliesTo: 'horse' | 'jockey' | 'both';

  penaltyApplied: 'warning' | 'result_void' | 'time_ban' | 'permanent_ban';
  requiresBanDuration: boolean;
  banDurationDays: number;
  isActive: boolean;
  createdBy?: mongoose.Types.ObjectId | null;
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
    appliesTo: {
      type: String,
      enum: ['horse', 'jockey', 'both'],
      default: 'both',
      required: true,
    },
    penaltyApplied: {
      type: String,
      enum: ['warning', 'result_void', 'time_ban', 'permanent_ban'],
      required: true,
    },
    requiresBanDuration: { type: Boolean, default: false },
    banDurationDays: { type: Number, min: 0, default: 0 },
    isActive: { type: Boolean, default: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true },
);

ViolationRuleSchema.pre('validate', function normalizeBanRequirement(next) {
  this.requiresBanDuration = this.penaltyApplied === 'time_ban';
  if (this.requiresBanDuration && this.banDurationDays <= 0) {
    this.invalidate('banDurationDays', 'Cấm có thời hạn phải có số ngày cấm lớn hơn 0');
  }
  if (!this.requiresBanDuration) {
    this.banDurationDays = 0;
  }
  next();
});

// Mongoose tự động xử lý index cho các trường có unique: true (như trường code)
// Index hỗ trợ truy vấn tốc độ cao cho Admin
ViolationRuleSchema.index({ penaltyApplied: 1 });
ViolationRuleSchema.index({ category: 1 });
ViolationRuleSchema.index({ isActive: 1 });
ViolationRuleSchema.index({ appliesTo: 1 });

export const ViolationRule = mongoose.model<IViolationRule>('ViolationRule', ViolationRuleSchema);
