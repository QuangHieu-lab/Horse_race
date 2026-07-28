import mongoose from 'mongoose';
import { User } from '../models/User.model.js';

type LicenseAssignableJockey = {
  _id: mongoose.Types.ObjectId;
  role: string;
  createdAt?: Date;
  jockeyProfile?: { licenseNumber?: string } | null;
};

export function buildJockeyLicenseNumber(
  userId: mongoose.Types.ObjectId | string,
  issuedAt = new Date(),
): string {
  const idSuffix = userId.toString().slice(-6).toUpperCase();
  return `VN-JKY-${issuedAt.getUTCFullYear()}-${idSuffix}`;
}

export function ensureJockeyLicenseNumber(user: LicenseAssignableJockey): string | undefined {
  if (user.role !== 'jockey' || !user.jockeyProfile) return undefined;

  const current = user.jockeyProfile.licenseNumber?.trim();
  if (current) return current;

  const licenseNumber = buildJockeyLicenseNumber(user._id, user.createdAt ?? new Date());
  user.jockeyProfile.licenseNumber = licenseNumber;
  return licenseNumber;
}

/** Cấp mã license ổn định cho các tài khoản Jockey cũ được tạo trước tính năng tự động. */
export async function backfillMissingJockeyLicenses(): Promise<number> {
  const jockeys = await User.find({
    role: 'jockey',
    $or: [
      { 'jockeyProfile.licenseNumber': { $exists: false } },
      { 'jockeyProfile.licenseNumber': null },
      { 'jockeyProfile.licenseNumber': '' },
    ],
  })
    .select('_id createdAt')
    .lean();

  if (!jockeys.length) return 0;

  const result = await User.bulkWrite(
    jockeys.map((jockey) => ({
      updateOne: {
        filter: { _id: jockey._id },
        update: {
          $set: {
            'jockeyProfile.licenseNumber': buildJockeyLicenseNumber(jockey._id, jockey.createdAt),
          },
        },
      },
    })),
    { ordered: false },
  );

  return result.modifiedCount;
}
