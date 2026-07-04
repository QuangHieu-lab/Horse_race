import mongoose, { Schema } from 'mongoose';
import type { GoingCondition, RaceStatus, TrackSurface } from '../types/shared.types.js';
import { GOING_CONDITIONS, TRACK_SURFACES } from '../types/shared.types.js';
import { activeParticipants, validateParticipants } from '../utils/race-participants.js';

export interface IParticipant {
  horseId: mongoose.Types.ObjectId;
  jockeyId: mongoose.Types.ObjectId;
  ownerId: mongoose.Types.ObjectId;
  laneNumber: number;
  clothNumber?: number;
  carriedWeight?: number;
  vetApprovedAt?: Date | null;
  scratchedAt?: Date | null;
  confirmedAt?: Date | null;
  isDisqualified?: boolean;
  disqualifiedReason?: string;
  disqualifiedAt?: Date | null;
}

export interface IViewingTicket {
  enabled: boolean;
  pricePoints: number;
  announceAt?: Date | null;
  saleOpensAt?: Date | null;
  saleExpiresAt?: Date | null;
  announcementMessage?: string;
  allowVipRedemption: boolean;
}

export interface IRace {
  tournamentId: mongoose.Types.ObjectId;
  meetingId?: mongoose.Types.ObjectId | null;
  trackId?: mongoose.Types.ObjectId | null;
  name: string;
  round: number;
  raceClass?: string;
  scheduledAt: Date;
  distance?: number;
  surface?: TrackSurface;
  going?: GoingCondition;
  weather?: string;
  streamUrl?: string;
  predictionOpenAt?: Date | null;
  predictionCloseAt?: Date | null;
  maxParticipants: number;
  status: RaceStatus;
  refereeId?: mongoose.Types.ObjectId | null;
  cancelReason?: string;
  cancelledAt?: Date | null;
  participants: IParticipant[];
  viewingTicket: IViewingTicket;
  createdAt: Date;
  updatedAt: Date;
}

const ViewingTicketSchema = new Schema<IViewingTicket>(
  {
    enabled: { type: Boolean, default: false },
    pricePoints: { type: Number, default: 0, min: 0 },
    announceAt: { type: Date, default: null },
    saleOpensAt: { type: Date, default: null },
    saleExpiresAt: { type: Date, default: null },
    announcementMessage: { type: String, trim: true },
    allowVipRedemption: { type: Boolean, default: false },
  },
  { _id: false },
);

const ParticipantSchema = new Schema<IParticipant>(
  {
    horseId: { type: Schema.Types.ObjectId, ref: 'Horse', required: true },
    jockeyId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    laneNumber: { type: Number, required: true, min: 1 },
    clothNumber: { type: Number, min: 1 },
    carriedWeight: { type: Number, min: 40, max: 80 },
    isDisqualified: { type: Boolean, default: false },
    disqualifiedReason: { type: String },
    disqualifiedAt: { type: Date, default: null },  
    vetApprovedAt: { type: Date, default: null },
    scratchedAt: { type: Date, default: null },
    confirmedAt: { type: Date, default: null },
  },
  { _id: false },
);

const RaceSchema = new Schema<IRace>(
  {
    tournamentId: { type: Schema.Types.ObjectId, ref: 'Tournament', required: true },
    meetingId: { type: Schema.Types.ObjectId, ref: 'RaceMeeting', default: null },
    trackId: { type: Schema.Types.ObjectId, ref: 'Track', default: null },
    name: { type: String, required: true, trim: true },
    round: { type: Number, required: true, min: 1 },
    raceClass: { type: String, trim: true },
    scheduledAt: { type: Date, required: true },
    distance: { type: Number, min: 100 },
    surface: { type: String, enum: TRACK_SURFACES, default: null },
    going: { type: String, enum: GOING_CONDITIONS, default: 'unknown' },
    weather: { type: String, trim: true },
    streamUrl: { type: String, trim: true },
    predictionOpenAt: { type: Date, default: null },
    predictionCloseAt: { type: Date, default: null },
    maxParticipants: { type: Number, required: true, min: 2, max: 20 },
    status: {
      type: String,
      enum: ['scheduled', 'ongoing', 'completed', 'cancelled'],
      default: 'scheduled',
    },
    refereeId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    cancelReason: { type: String, trim: true },
    cancelledAt: { type: Date, default: null },
    participants: { type: [ParticipantSchema], default: [] },
    viewingTicket: {
      type: ViewingTicketSchema,
      default: () => ({
        enabled: false,
        pricePoints: 0,
        allowVipRedemption: false,
      }),
    },
  },
  { timestamps: true },
);

RaceSchema.virtual('participantCount').get(function () {
  return activeParticipants(this.participants).length;
});

RaceSchema.virtual('isFull').get(function () {
  return activeParticipants(this.participants).length >= this.maxParticipants;
});

RaceSchema.set('toJSON', { virtuals: true });
RaceSchema.set('toObject', { virtuals: true });

RaceSchema.pre('save', function (next) {
  if (this.isNew && this.scheduledAt <= new Date()) {
    return next(new Error('scheduledAt must be in the future'));
  }

  const participantErr = validateParticipants(this.participants, this.maxParticipants);
  if (participantErr) return next(new Error(participantErr));

  const activeCount = activeParticipants(this.participants).length;
  if (this.isModified('status') && this.status === 'ongoing' && activeCount < 2) {
    return next(new Error('Race needs at least 2 active participants to start'));
  }

  if (this.isModified('status') && this.status === 'cancelled' && !this.cancelledAt) {
    this.cancelledAt = new Date();
  }

  next();
});

RaceSchema.pre('save', async function (next) {
  if (!this.isModified('status') || this.status !== 'completed') return next();

  const prev = await mongoose.model<IRace>('Race').findById(this._id).select('status').lean();
  if (prev && prev.status !== 'ongoing' && prev.status !== 'completed') {
    return next(new Error('Race can only be completed from ongoing status'));
  }
  next();
});

// ─── Đồng bộ trạng thái giải đấu theo trạng thái trận đua ────────────────────
// Bắt đầu đua (ongoing) → giải "Live"; đua xong (completed/cancelled) và không
// còn trận nào đang chạy → giải trở lại "Registration" (published).
// Không đụng tới giải đã 'completed' (admin tự bấm hoàn tất).
async function syncTournamentStatusForRace(
  tournamentId: mongoose.Types.ObjectId,
  raceStatus: string,
): Promise<void> {
  const { Tournament } = await import('./Tournament.model.js');
  const tour = await Tournament.findById(tournamentId).select('status').lean();
  if (!tour || tour.status === 'completed') return;

  if (raceStatus === 'ongoing') {
    if (tour.status !== 'ongoing') {
      await Tournament.updateOne({ _id: tournamentId }, { $set: { status: 'ongoing' } });
    }
    return;
  }

  if (raceStatus === 'completed' || raceStatus === 'cancelled') {
    const RaceModel = mongoose.models.Race as mongoose.Model<IRace>;
    const stillOngoing = await RaceModel.countDocuments({ tournamentId, status: 'ongoing' });
    if (stillOngoing === 0 && tour.status === 'ongoing') {
      await Tournament.updateOne({ _id: tournamentId }, { $set: { status: 'published' } });
    }
  }
}

RaceSchema.pre('save', function (next) {
  this.$locals.raceStatusChangedTo = this.isModified('status') ? this.status : null;
  next();
});

RaceSchema.post('save', async function (doc) {
  const changed = doc.$locals?.raceStatusChangedTo as string | null | undefined;
  if (!changed) return;
  try {
    await syncTournamentStatusForRace(doc.tournamentId, changed);
  } catch (err) {
    console.error('syncTournamentStatusForRace failed:', err);
  }
});

RaceSchema.index({ tournamentId: 1, status: 1 });
RaceSchema.index({ meetingId: 1 });
RaceSchema.index({ trackId: 1 });
RaceSchema.index({ scheduledAt: 1 });
RaceSchema.index({ refereeId: 1 });
RaceSchema.index({ 'participants.horseId': 1 });
RaceSchema.index({ 'participants.jockeyId': 1 });

export const Race = mongoose.model<IRace>('Race', RaceSchema);
