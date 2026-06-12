import type { Request, Response } from 'express';
import { asyncHandler } from '../middleware/error.middleware.js';
import { processDailyViewingReminders } from '../services/viewing-ticket-reminder.service.js';

export class AdminJobsController {
  /**
   * Gọi thủ công hoặc qua cron (ví dụ 00:05 hàng ngày):
   * POST /api/admin/jobs/viewing-ticket-reminders
   */
  viewingTicketReminders = asyncHandler(async (_req: Request, res: Response) => {
    const result = await processDailyViewingReminders();
    res.json({ ok: true, ...result });
  });
}
