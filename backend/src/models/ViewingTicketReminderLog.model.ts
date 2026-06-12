import mongoose, { Schema } from 'mongoose';
import type { ViewingReminderKind } from '../types/shared.types.js';

export interface IViewingTicketReminderLog {
  userId: mongoose.Types.ObjectId;
  raceId: mongoose.Types.ObjectId;
  reminderDate: string;
  kind: ViewingReminderKind;
  createdAt: Date;
}

const ViewingTicketReminderLogSchema = new Schema<IViewingTicketReminderLog>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    raceId: { type: Schema.Types.ObjectId, ref: 'Race', required: true },
    reminderDate: { type: String, required: true, trim: true },
    kind: {
      type: String,
      enum: ['sale_open', 'daily_reminder', 'purchased_reminder'],
      required: true,
    },
    createdAt: { type: Date, default: () => new Date() },
  },
  { timestamps: false },
);

ViewingTicketReminderLogSchema.index(
  { userId: 1, raceId: 1, reminderDate: 1, kind: 1 },
  { unique: true },
);
ViewingTicketReminderLogSchema.index({ raceId: 1, reminderDate: 1 });

export const ViewingTicketReminderLog = mongoose.model<IViewingTicketReminderLog>(
  'ViewingTicketReminderLog',
  ViewingTicketReminderLogSchema,
);
