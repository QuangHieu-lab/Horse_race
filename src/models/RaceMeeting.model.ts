import mongoose, { Schema } from 'mongoose';
import type { MeetingStatus } from '../types/shared.types.js';

export interface IRaceMeeting {
  tournamentId: mongoose.Types.ObjectId;
  trackId: mongoose.Types.ObjectId;
  meetingDate: Date;
  name: string;
  status: MeetingStatus;
  createdAt: Date;
  updatedAt: Date;
}

const RaceMeetingSchema = new Schema<IRaceMeeting>(
  {
    tournamentId: { type: Schema.Types.ObjectId, ref: 'Tournament', required: true },
    trackId: { type: Schema.Types.ObjectId, ref: 'Track', required: true },
    meetingDate: { type: Date, required: true },
    name: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: ['scheduled', 'ongoing', 'completed', 'cancelled'],
      default: 'scheduled',
    },
  },
  { timestamps: true },
);

RaceMeetingSchema.index({ tournamentId: 1, meetingDate: 1 });
RaceMeetingSchema.index({ trackId: 1, meetingDate: 1 });

export const RaceMeeting = mongoose.model<IRaceMeeting>('RaceMeeting', RaceMeetingSchema);
