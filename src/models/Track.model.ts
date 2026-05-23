import mongoose, { Schema } from 'mongoose';
import type { TrackSurface } from '../types/shared.types.js';
import { TRACK_SURFACES } from '../types/shared.types.js';

export interface ITrack {
  name: string;
  location: string;
  countryCode: string;
  surfaceDefault: TrackSurface;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const TrackSchema = new Schema<ITrack>(
  {
    name: { type: String, required: true, trim: true },
    location: { type: String, required: true, trim: true },
    countryCode: { type: String, default: 'VN', trim: true, uppercase: true },
    surfaceDefault: { type: String, enum: TRACK_SURFACES, default: 'turf' },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

TrackSchema.index({ name: 1, location: 1 });
TrackSchema.index({ isActive: 1 });

export const Track = mongoose.model<ITrack>('Track', TrackSchema);
