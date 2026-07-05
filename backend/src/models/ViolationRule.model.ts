import mongoose, { Schema, Document } from 'mongoose';

export interface IViolationRule extends Document {
  code: string;
  name: string;
  description: string;
  category: 'race_conduct' | 'medical' | 'equipment' | 'administrative';
  severity: 'low' | 'medium' | 'high' | 'critical';
  
  // 🚀 CHỈ GIỮ LẠI CÁC HÌNH THỨC CẤM THI ĐẤU VÀ XỬ LÝ TẠI TRẬN (Đã xóa 'fine')
  penaltyApplied: 'warning' | 'demote' | 'disqualify' | 'disqualification' | 'restart' | 'time_ban' | 'permanent_ban';
  
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
    penaltyApplied: {
      type: String,
      // 🚀 CẬP NHẬT ENUM TẠI ĐÂY ĐỂ MONGOOSE CHẶN ĐỨNG MỌI CỐ GẮNG TRUYỀN 'fine'
      enum: [
        'warning', 
        'demote', 
        'disqualify', 
        'disqualification', 
        'restart', 
        'time_ban', 
        'permanent_ban'
      ],
      required: true,
    },
    banDurationDays: { type: Number, min: 0, default: 0 },
    isActive: { type: Boolean, default: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true },
);

// Mongoose tự động xử lý index cho các trường có unique: true (như trường code)
// Index hỗ trợ truy vấn tốc độ cao cho Admin
ViolationRuleSchema.index({ penaltyApplied: 1 });
ViolationRuleSchema.index({ category: 1 });
ViolationRuleSchema.index({ isActive: 1 });

export const ViolationRule = mongoose.model<IViolationRule>('ViolationRule', ViolationRuleSchema);
