import mongoose, { Schema, type Model } from 'mongoose';
import { Horse } from './Horse.model.js';
import { User } from './User.model.js';
import type { InvitationStatus } from '../types/shared.types.js';

export interface IJockeyInvitation {
  _id: mongoose.Types.ObjectId;
  horseOwnerId: mongoose.Types.ObjectId;
  jockeyId: mongoose.Types.ObjectId;
  horseId: mongoose.Types.ObjectId;
  raceId: mongoose.Types.ObjectId;
  status: InvitationStatus;
  message?: string;
  respondedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const JockeyInvitationSchema = new Schema<IJockeyInvitation>(
  {
    horseOwnerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    jockeyId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    horseId: { type: Schema.Types.ObjectId, ref: 'Horse', required: true },
    raceId: { type: Schema.Types.ObjectId, ref: 'Race', required: true },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'declined'],
      default: 'pending',
    },
    message: { type: String, trim: true, maxlength: 500 },
    respondedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

JockeyInvitationSchema.pre('save', async function (next) {
  const owner = await User.findById(this.horseOwnerId).select('role isActive').lean();
  if (!owner?.isActive || owner.role !== 'horse_owner') {
    return next(new Error('horseOwnerId must be an active horse_owner'));
  }

  const jockey = await User.findById(this.jockeyId).select('role isActive').lean();
  if (!jockey?.isActive || jockey.role !== 'jockey') {
    return next(new Error('jockeyId must be an active jockey'));
  }

  const horse = await Horse.findById(this.horseId);
  if (!horse || horse.ownerId.toString() !== this.horseOwnerId.toString()) {
    return next(new Error('horse must belong to horseOwnerId'));
  }

  if (this.isNew) {
    const Model = this.constructor as Model<IJockeyInvitation>;
    const existing = await Model.findOne({
      jockeyId: this.jockeyId,
      raceId: this.raceId,
      status: 'pending',
    });
    if (existing) {
      return next(new Error('A pending invitation already exists for this jockey and race'));
    }
  }

  const becomingAccepted =
    this.status === 'accepted' && (this.isNew || this.isModified('status'));

  if (becomingAccepted) {
    try {
      const { onInvitationAccepted } = await import('../services/race-participant.service.js');
      await onInvitationAccepted(this);
      if (!this.respondedAt) this.respondedAt = new Date();
    } catch (err) {
      return next(err instanceof Error ? err : new Error(String(err)));
    }
  }

  next();
});

JockeyInvitationSchema.index({ jockeyId: 1, status: 1 });
JockeyInvitationSchema.index({ horseOwnerId: 1 });
JockeyInvitationSchema.index({ raceId: 1 });
JockeyInvitationSchema.index({ horseId: 1 });
JockeyInvitationSchema.index({ jockeyId: 1, raceId: 1 });

export const JockeyInvitation = mongoose.model<IJockeyInvitation>(
  'JockeyInvitation',
  JockeyInvitationSchema,
);
