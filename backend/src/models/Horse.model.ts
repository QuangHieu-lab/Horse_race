import mongoose, { Schema } from 'mongoose';
import type { HealthStatus } from '../types/shared.types.js';

export interface IHorse {
  ownerId: mongoose.Types.ObjectId;
  name: string;
  registrationId?: string;
  breed: string;
  sire?: string;
  dam?: string;
  trainerName?: string;
  age: number;
  color?: string;
  weight?: number;
  healthStatus: HealthStatus;
  imageUrl?: string;
  currentJockeyId?: mongoose.Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const HorseSchema = new Schema<IHorse>(
  {
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true, trim: true },
    registrationId: { type: String, trim: true },
    breed: { type: String, required: true, trim: true },
    sire: { type: String, trim: true },
    dam: { type: String, trim: true },
    trainerName: { type: String, trim: true },
    age: { type: Number, required: true, min: 1, max: 30 },
    color: { type: String, trim: true },
    weight: { type: Number, min: 350, max: 600 },
    healthStatus: {
      type: String,
      enum: ['fit', 'injured', 'retired'],
      default: 'fit',
    },
    imageUrl: { type: String },
    currentJockeyId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true },
);

HorseSchema.index({ ownerId: 1 });
HorseSchema.index({ registrationId: 1 }, { sparse: true, unique: true });
HorseSchema.index({ healthStatus: 1 });
HorseSchema.index({ currentJockeyId: 1 });
HorseSchema.index({ ownerId: 1, healthStatus: 1 });

export const Horse = mongoose.model<IHorse>('Horse', HorseSchema);
