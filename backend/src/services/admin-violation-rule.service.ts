import mongoose from 'mongoose';
import { ViolationRule, type IViolationRule } from '../models/ViolationRule.model.js';
import { HttpError } from '../utils/http-error.js';

export async function createRule(adminId: string, payload: Partial<IViolationRule>) {
  const existingRule = await ViolationRule.findOne({ code: payload.code?.toUpperCase() });
  if (existingRule) throw new HttpError(400, `Mã luật ${payload.code} đã tồn tại.`);
  return ViolationRule.create({ ...payload, createdBy: new mongoose.Types.ObjectId(adminId) });
}

export async function listRules(filters: { category?: string; isActive?: string }) {
  const query: Record<string, unknown> = {};
  if (filters.category) query.category = filters.category;
  if (filters.isActive !== undefined) query.isActive = filters.isActive === 'true';

  return ViolationRule.find(query).populate('createdBy', 'fullName email').sort({ category: 1, code: 1 }).lean();
}

export async function updateRule(id: string, payload: Partial<IViolationRule>) {
  if (payload.code) delete payload.code;
  const rule = await ViolationRule.findByIdAndUpdate(id, payload, { new: true, runValidators: true }).lean();
  if (!rule) throw new HttpError(404, 'Không tìm thấy luật vi phạm.');
  return rule;
}

export async function toggleRuleStatus(id: string) {
  const rule = await ViolationRule.findById(id);
  if (!rule) throw new HttpError(404, 'Không tìm thấy luật vi phạm.');
  rule.isActive = !rule.isActive;
  await rule.save();
  return rule.toObject();
}