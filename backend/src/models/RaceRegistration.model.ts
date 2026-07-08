import mongoose, { Schema } from 'mongoose';
import { Horse } from './Horse.model.js';
import { Race } from './Race.model.js';
import { User } from './User.model.js';
import type { RegistrationStatus } from '../types/shared.types.js';
import { isPenaltyActive } from '../utils/penalty-status.util.js';

/**
 * Đơn đăng ký ngựa vào cuộc đua — admin duyệt trước khi thêm vào Race.participants.
 * (Bổ sung so với database.txt gốc — khớp use case "Duyệt đăng ký tham gia")
 */
export interface IRaceRegistration {
  raceId: mongoose.Types.ObjectId;
  horseId: mongoose.Types.ObjectId;
  ownerId: mongoose.Types.ObjectId;
  jockeyId?: mongoose.Types.ObjectId | null;
  status: RegistrationStatus;
  adminNote?: string;
  processedBy?: mongoose.Types.ObjectId | null;
  processedAt?: Date | null;
  waiverAcceptedAt?: Date | null;
  insuranceNote?: string;
  createdAt: Date;
  updatedAt: Date;
}

const RaceRegistrationSchema = new Schema<IRaceRegistration>(
  {
    raceId: { type: Schema.Types.ObjectId, ref: 'Race', required: true },
    horseId: { type: Schema.Types.ObjectId, ref: 'Horse', required: true },
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    jockeyId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
    },
    adminNote: { type: String, trim: true },
    processedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    processedAt: { type: Date, default: null },
    waiverAcceptedAt: { type: Date, default: null },
    insuranceNote: { type: String, trim: true },
  },
  { timestamps: true },
);

RaceRegistrationSchema.index({ raceId: 1, horseId: 1 }, { unique: true });
RaceRegistrationSchema.index({ ownerId: 1, status: 1 });
RaceRegistrationSchema.index({ raceId: 1, status: 1 });

RaceRegistrationSchema.pre('save', async function (next) {
  const horse = await Horse.findById(this.horseId);
  if (!horse) return next(new Error('Horse not found'));
  if (horse.ownerId.toString() !== this.ownerId.toString()) {
    return next(new Error('ownerId must match horse owner'));
  }
  if (['pending', 'approved'].includes(this.status) && isPenaltyActive(horse.penaltyStatus)) {
    return next(new Error('Horse is banned from competition'));
  }
  const owner = await User.findById(this.ownerId).select('role isActive penaltyStatus').lean();
  if (!owner?.isActive || owner.role !== 'horse_owner') {
    return next(new Error('ownerId must be an active horse_owner user'));
  }
  if (['pending', 'approved'].includes(this.status) && isPenaltyActive(owner.penaltyStatus)) {
    return next(new Error('Horse owner is banned from competition'));
  }
  if (this.isNew || this.isModified('status')) {
    if (['pending', 'approved'].includes(this.status) && horse.healthStatus !== 'fit') {
      return next(new Error('Only fit horses can register for a race'));
    }
  }

  if (this.jockeyId) {
    const jockey = await User.findById(this.jockeyId).select('role isActive jockeyProfile.penaltyStatus').lean();
    if (!jockey?.isActive || jockey.role !== 'jockey') {
      return next(new Error('jockeyId must be an active jockey user'));
    }
    if (['pending', 'approved'].includes(this.status) && isPenaltyActive(jockey.jockeyProfile?.penaltyStatus)) {
      return next(new Error('Jockey is banned from competition'));
    }
  }

  const race = await Race.findById(this.raceId).select('status maxParticipants').lean();
  if (!race) return next(new Error('Race not found'));
  if (race.status === 'cancelled') return next(new Error('Cannot register for a cancelled race'));

  next();
});

export const RaceRegistration = mongoose.model<IRaceRegistration>(
  'RaceRegistration',
  RaceRegistrationSchema,
);
