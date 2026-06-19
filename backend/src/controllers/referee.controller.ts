import type { Request, Response } from 'express';
import { asyncHandler } from '../middleware/error.middleware.js';
import * as refereeService from '../services/referee.service.js';
import * as resultService from '../services/result.service.js';
import { HttpError } from '../utils/http-error.js';

export class RefereeController {
  getDashboard = asyncHandler(async (req: Request, res: Response) => {
    const dashboard = await refereeService.getRefereeDashboard(req.user!.id);
    res.json({ dashboard });
  });

  listRaces = asyncHandler(async (req: Request, res: Response) => {
    const races = await refereeService.listRefereeRaces(req.user!.id);
    res.json({ races });
  });

  listChecks = asyncHandler(async (req: Request, res: Response) => {
    const checks = await refereeService.listRefereeChecks(
      req.user!.id,
      req.params.id as string,
    );
    res.json({ checks });
  });

  toggleCheck = asyncHandler(async (req: Request, res: Response) => {
    const { horseId, field } = req.body as {
      horseId?: string;
      field?: 'vetApprovedAt' | 'confirmedAt';
    };
    if (!horseId || !field || !['vetApprovedAt', 'confirmedAt'].includes(field)) {
      throw new HttpError(400, 'horseId và field hợp lệ là bắt buộc');
    }
    await refereeService.toggleParticipantCheck(
      req.user!.id,
      req.params.id as string,
      horseId,
      field,
    );
    res.json({ ok: true });
  });

  upsertResult = asyncHandler(async (req: Request, res: Response) => {
    const rankings =
      (req.body as { rankings?: unknown }).rankings ??
      (await refereeService.buildResultFromRace(req.params.id as string, req.user!.id));
    const result = await resultService.upsertRaceResult(req.params.id as string, {
      rankings: rankings as Parameters<typeof resultService.upsertRaceResult>[1]['rankings'],
    });
    res.json({ result });
  });

  confirmResult = asyncHandler(async (req: Request, res: Response) => {
    await resultService.confirmRaceResult(req.params.id as string, req.user!.id);
    res.json({ ok: true });
  });

  getResult = asyncHandler(async (req: Request, res: Response) => {
    const result = await resultService.getResultByRaceId(req.params.id as string);
    res.json({ result });
  });
penalize = asyncHandler(async (req: Request, res: Response) => {
    // 🚀 Bổ sung thêm 'target' vào body
    const { ruleId, horseId, jockeyId, target, notes } = req.body as {
      ruleId?: string;
      horseId?: string;
      jockeyId?: string;
      target?: 'horse' | 'jockey' | 'both';
      notes?: string;
    };

    if (!ruleId) throw new HttpError(400, 'Vui lòng cung cấp mã luật vi phạm (ruleId)');
    if (!horseId && !jockeyId) throw new HttpError(400, 'Phải chỉ định ít nhất Ngựa hoặc Kỵ sĩ');
    if (!target || !['horse', 'jockey', 'both'].includes(target)) {
      throw new HttpError(400, 'Vui lòng chỉ định đối tượng chịu án phạt (target: horse, jockey, both)');
    }

    await refereeService.applyRacePenalty(
      req.user!.id,
      req.params.id as string,
      { ruleId, horseId, jockeyId, target, notes } // Truyền target xuống Service
    );

    res.json({ 
      success: true, 
      message: 'Đã áp dụng hình thức xử phạt và ghi nhận vào biên bản thành công.' 
    });
  });

  revokePenalty = asyncHandler(async (req: Request, res: Response) => {
    const { violationId } = req.params;
    if (!violationId) {
      throw new HttpError(400, 'Vui lòng cung cấp ID của biên bản vi phạm cần hủy');
    }

    await refereeService.revokeRacePenalty(
      req.user!.id,
      req.params.id as string,
      violationId as string
    );

    res.json({ 
      success: true, 
      message: 'Đã hoàn tác án phạt và khôi phục trạng thái thành công.' 
    });
  });
}
