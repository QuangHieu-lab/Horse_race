import mongoose, { Schema, type Model } from 'mongoose';
import bcrypt from 'bcryptjs';
import { SpectatorProfile } from './SpectatorProfile.model.js';
import type { UserRole } from '../types/shared.types.js';
import { USER_ROLES } from '../types/shared.types.js';

export interface IJockeyProfile {
  licenseNumber?: string;
  licenseExpiry?: Date | null;
  isSuspended: boolean;
}

export interface IRefereeProfile {
  certificationId?: string;
}

export interface IUser {
  email: string;
  passwordHash: string;
  role: UserRole;
  fullName: string;
  phone?: string;
  avatarUrl?: string;
  isActive: boolean;
  jockeyProfile?: IJockeyProfile;
  refereeProfile?: IRefereeProfile;
  createdAt: Date;
  updatedAt: Date;
}

export interface IUserMethods {
  comparePassword(plain: string): Promise<boolean>;
}

type UserModel = Model<IUser, Record<string, never>, IUserMethods>;

const JockeyProfileSchema = new Schema<IJockeyProfile>(
  {
    licenseNumber: { type: String, trim: true },
    licenseExpiry: { type: Date, default: null },
    isSuspended: { type: Boolean, default: false },
  },
  { _id: false },
);

const RefereeProfileSchema = new Schema<IRefereeProfile>(
  {
    certificationId: { type: String, trim: true },
  },
  { _id: false },
);

const UserSchema = new Schema<IUser, UserModel, IUserMethods>(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, required: true, enum: USER_ROLES },
    fullName: { type: String, required: true, trim: true },
    phone: { type: String, trim: true },
    avatarUrl: { type: String },
    isActive: { type: Boolean, default: true },
    jockeyProfile: { type: JockeyProfileSchema, default: undefined },
    refereeProfile: { type: RefereeProfileSchema, default: undefined },
  },
  { timestamps: true },
);

UserSchema.pre('save', async function (next) {
  if (!this.isModified('passwordHash')) return next();
  this.passwordHash = await bcrypt.hash(this.passwordHash, 12);
  next();
});

UserSchema.methods.comparePassword = function (plain: string): Promise<boolean> {
  return bcrypt.compare(plain, this.passwordHash);
};

UserSchema.index({ role: 1, isActive: 1 });
UserSchema.index({ 'jockeyProfile.licenseNumber': 1 }, { sparse: true });

UserSchema.post('save', async function (doc) {
  if (doc.role !== 'spectator') return;
  await SpectatorProfile.findOneAndUpdate(
    { userId: doc._id },
    { $setOnInsert: { userId: doc._id } },
    { upsert: true },
  );
});

export const User = mongoose.model<IUser, UserModel>('User', UserSchema);
