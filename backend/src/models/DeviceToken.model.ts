import mongoose, { Schema } from 'mongoose';

export type DevicePlatform = 'android' | 'ios';

export interface IDeviceToken {
  userId: mongoose.Types.ObjectId;
  token: string;
  platform: DevicePlatform;
  createdAt: Date;
  updatedAt: Date;
}

const DeviceTokenSchema = new Schema<IDeviceToken>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    token: { type: String, required: true, unique: true, trim: true },
    platform: { type: String, enum: ['android', 'ios'], required: true },
  },
  { timestamps: true },
);

DeviceTokenSchema.index({ userId: 1, token: 1 }, { unique: true });

export const DeviceToken = mongoose.model<IDeviceToken>('DeviceToken', DeviceTokenSchema);
