import type { Request, Response } from 'express';
import { asyncHandler } from '../middleware/error.middleware.js';
import * as adminViolationRuleService from '../services/admin-violation-rule.service.js';

export class AdminViolationRuleController {
  create = asyncHandler(async (req: Request, res: Response) => {
    // req.user!.id lấy từ middleware xác thực JWT của Admin
    const rule = await adminViolationRuleService.createRule(req.user!.id, req.body);
    res.status(201).json({ success: true, data: rule });
  });

  getAll = asyncHandler(async (req: Request, res: Response) => {
    const rules = await adminViolationRuleService.listRules(req.query);
    res.json({ success: true, data: rules });
  });

  update = asyncHandler(async (req: Request, res: Response) => {
    const rule = await adminViolationRuleService.updateRule(req.params.id as string, req.body);
    res.json({ success: true, data: rule });
  });

  toggleStatus = asyncHandler(async (req: Request, res: Response) => {
    const rule = await adminViolationRuleService.toggleRuleStatus(req.params.id as string);
    const message = rule.isActive 
      ? 'Đã kích hoạt lại luật vi phạm.' 
      : 'Đã vô hiệu hóa luật vi phạm thành công.';
      
    res.json({ success: true, message, data: rule });
  });
}