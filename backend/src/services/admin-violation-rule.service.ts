import mongoose from 'mongoose';
import { ViolationRule, type IViolationRule } from '../models/ViolationRule.model.js';
import { HttpError } from '../utils/http-error.js';

const PENALTY_BY_SEVERITY = {
  low: 'warning',
  medium: 'result_void',
  high: 'time_ban',
  critical: 'permanent_ban',
} as const;

function normalizePayload(payload: Partial<IViolationRule>): Partial<IViolationRule> {
  const next = { ...payload };
  if (next.severity) {
    next.penaltyApplied = PENALTY_BY_SEVERITY[next.severity];
  }
  if (next.penaltyApplied === 'time_ban') {
    next.requiresBanDuration = true;
    if (!next.banDurationDays || next.banDurationDays <= 0) {
      throw new HttpError(400, 'Luật mức cao/cấm có thời hạn phải có số ngày cấm lớn hơn 0.');
    }
  } else if (next.penaltyApplied) {
    next.requiresBanDuration = false;
    next.banDurationDays = 0;
  }
  return next;
}

function normalizeRuleForResponse<T extends { penaltyApplied?: string; requiresBanDuration?: boolean | null }>(rule: T) {
  return {
    ...rule,
    requiresBanDuration:
      rule.requiresBanDuration ?? rule.penaltyApplied === 'time_ban',
  };
}

export async function createRule(adminId: string, payload: Partial<IViolationRule>) {
  const existingRule = await ViolationRule.findOne({ code: payload.code?.toUpperCase() });
  if (existingRule) throw new HttpError(400, `Mã luật ${payload.code} đã tồn tại.`);
  return ViolationRule.create({ ...normalizePayload(payload), createdBy: new mongoose.Types.ObjectId(adminId) });
}

export async function listRules(filters: { category?: string; isActive?: string }) {
  const query: Record<string, unknown> = {};
  if (filters.category) query.category = filters.category;
  if (filters.isActive !== undefined) query.isActive = filters.isActive === 'true';

  const rules = await ViolationRule.find(query)
    .populate('createdBy', 'fullName email')
    .sort({ category: 1, code: 1 })
    .lean();

  return rules.map(normalizeRuleForResponse);
}

export async function updateRule(id: string, payload: Partial<IViolationRule>) {
  if (payload.code) delete payload.code;
  const rule = await ViolationRule.findByIdAndUpdate(id, normalizePayload(payload), { new: true, runValidators: true }).lean();
  if (!rule) throw new HttpError(404, 'Không tìm thấy luật vi phạm.');
  return rule;
}

export async function toggleRuleStatus(id: string) {
  const currentRule = await ViolationRule.findById(id).select('isActive').lean();
  if (!currentRule) throw new HttpError(404, 'Không tìm thấy luật vi phạm.');

  // Dùng cập nhật nguyên tử để việc bật/tắt không kích hoạt validation toàn bộ
  // tài liệu legacy (có thể còn penaltyApplied từ schema cũ).
  const rule = await ViolationRule.findByIdAndUpdate(
    id,
    { $set: { isActive: !currentRule.isActive } },
    { new: true },
  ).lean();
  if (!rule) throw new HttpError(404, 'Không tìm thấy luật vi phạm.');

  return normalizeRuleForResponse(rule);
}
