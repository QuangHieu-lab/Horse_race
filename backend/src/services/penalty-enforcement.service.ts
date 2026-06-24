import mongoose from 'mongoose';
import { User } from '../models/User.model.js';
import { Result } from '../models/Result.model.js';

export interface IPenaltyStatus {
  isBanned: boolean;
  bannedUntil: Date | null;
  reason: string | null;
}

/**
 * Kiểm tra trạng thái hình phạt hiện tại của Ngựa
 */
export async function getHorsePenaltyStatus(horseId: string): Promise<IPenaltyStatus> {
  const now = new Date();

  // Tìm trong biên bản kết quả xem có án phạt "time_ban" nào đối với ngựa này chưa hết hạn không
  const activeViolation = await Result.findOne({
    'violations.horseId': new mongoose.Types.ObjectId(horseId),
    'violations.bannedUntil': { $gt: now }
  }, { 'violations.$': 1 }).lean();

  if (activeViolation && activeViolation.violations?.[0]) {
    const v = activeViolation.violations[0];
    return {
      isBanned: true,
      bannedUntil: v.bannedUntil || null,
      reason: v.description
    };
  }

  return { isBanned: false, bannedUntil: null, reason: null };
}

/**
 * Kiểm tra trạng thái hình phạt hiện tại của Kỵ sĩ (Jockey)
 */
export async function getJockeyPenaltyStatus(jockeyId: string): Promise<IPenaltyStatus> {
  const now = new Date();

  // 1. Kiểm tra trạng thái khóa trực tiếp trong hồ sơ Jockey (Admin khóa thủ công)
  const jockey = await User.findById(jockeyId).select('jockeyProfile').lean();
  if (jockey?.jockeyProfile?.isSuspended) {
    return {
      isBanned: true,
      bannedUntil: null, // Cấm vô thời hạn cho đến khi có quyết định mới
      reason: 'Tài khoản kỵ sĩ đang bị đình chỉ thi đấu (Suspended) bởi Ban tổ chức.'
    };
  }

  // 2. Kiểm tra các án phạt có thời hạn (time_ban) từ các trận đua trước
  const activeViolation = await Result.findOne({
    'violations.jockeyId': new mongoose.Types.ObjectId(jockeyId),
    'violations.bannedUntil': { $gt: now }
  }, { 'violations.$': 1 }).lean();

  if (activeViolation && activeViolation.violations?.[0]) {
    const v = activeViolation.violations[0];
    return {
      isBanned: true,
      bannedUntil: v.bannedUntil || null,
      reason: v.description
    };
  }

  return { isBanned: false, bannedUntil: null, reason: null };
}