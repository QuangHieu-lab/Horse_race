import mongoose, { Schema } from 'mongoose';
import type { NotificationRefModel, NotificationType } from '../types/shared.types.js';

export interface INotification {
  userId: mongoose.Types.ObjectId;
  type: NotificationType;
  title: string;
  message: string;
  isRead: boolean;
  refModel?: NotificationRefModel | null;
  refId?: mongoose.Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const NotificationSchema = new Schema<INotification>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    type: {
      type: String,
      enum: [
        'points_topup',
        'invitation_received',
        'invitation_accepted',
        'invitation_declined',
        'race_confirmed',
        'race_started',
        'race_cancelled',
        'result_confirmed',
        'result_published',
        'prediction_reward',
        'race_prize_reward',
        'registration_approved',
        'participant_scratched',
        'result_protest_filed',
        'jockey_penalty',
        'disqualification_notice',
        'viewing_ticket_sale_open',
        'viewing_ticket_daily_reminder',
        'viewing_ticket_purchased',
        'penalty_issued',
        'penalty_revoked',
      ],
      required: true,
    },
    title: { type: String, required: true, trim: true },
    message: { type: String, required: true, trim: true },
    isRead: { type: Boolean, default: false },
    refModel: {
      type: String,
      enum: [
        'Race',
        'Tournament',
        'Result',
        'JockeyInvitation',
        'Prediction',
        'RaceRegistration',
        'PredictionPool',
        'RaceMeeting',
        'Track',
        'RaceViewingPass',
      ],
      default: null,
    },
    refId: { type: Schema.Types.ObjectId, default: null },
  },
  { timestamps: true },
);

NotificationSchema.index({ userId: 1, isRead: 1 });
NotificationSchema.index({ userId: 1, createdAt: -1 });
NotificationSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: 60 * 60 * 24 * 90 },
);

export const Notification = mongoose.model<INotification>(
  'Notification',
  NotificationSchema,
);
