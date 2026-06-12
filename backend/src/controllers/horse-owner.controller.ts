import type { Request, Response } from 'express';
import { asyncHandler } from '../middleware/error.middleware.js';
import { HorseOwnerService } from '../services/horse-owner.service.js';
import { HttpError } from '../utils/http-error.js';
import type { 
  CreateHorseInput, 
  RegisterRaceInput, 
  InviteJockeyInput 
} from '../services/horse-owner.service.js';

const horseOwnerService = new HorseOwnerService();

export class HorseOwnerController {
  
  // ==========================================================
  // 1. QUẢN LÝ NGỰA
  // ==========================================================

  createHorse = asyncHandler(async (req: Request, res: Response) => {
    // Ép kiểu body về CreateHorseInput để đảm bảo an toàn dữ liệu
    const input = req.body as CreateHorseInput;
    
    if (!input.name || !input.breed || !input.age) {
      throw new HttpError(400, 'Thiếu các thông tin bắt buộc của ngựa (name, breed, age)');
    }

    const newHorse = await horseOwnerService.createHorse(req.user!.id, input);
    res.status(201).json({ 
      success: true, 
      message: 'Đăng ký ngựa thành công!', 
      data: newHorse 
    });
  });

  listMyHorses = asyncHandler(async (req: Request, res: Response) => {
    const healthStatus = req.query.healthStatus as string | undefined;
    const horses = await horseOwnerService.getMyHorses(req.user!.id, healthStatus);
    
    res.json({ success: true, data: horses });
  });

  updateHorseInfo = asyncHandler(async (req: Request, res: Response) => {
    const input = req.body as Partial<CreateHorseInput>;
    const updatedHorse = await horseOwnerService.updateHorse(req.user!.id, req.params.id as string, input);
    
    res.json({ 
      success: true, 
      message: 'Cập nhật hồ sơ ngựa thành công!', 
      data: updatedHorse 
    });
  });

  // ==========================================================
  // 2. ĐĂNG KÝ GIẢI ĐẤU
  // ==========================================================

  registerForRace = asyncHandler(async (req: Request, res: Response) => {
    const input = req.body as RegisterRaceInput;

    if (!input.raceId || !input.horseId) {
      throw new HttpError(400, 'Thiếu thông tin raceId hoặc horseId');
    }

    const registration = await horseOwnerService.registerForRace(req.user!.id, input);
    res.status(201).json({ 
      success: true, 
      message: 'Nộp đơn đăng ký thành công! Vui lòng chờ phê duyệt.', 
      data: registration 
    });
  });

  listMyRegistrations = asyncHandler(async (req: Request, res: Response) => {
    const status = req.query.status as string | undefined;
    const registrations = await horseOwnerService.getMyRegistrations(req.user!.id, status);
    
    res.json({ success: true, data: registrations });
  });

  cancelRegistration = asyncHandler(async (req: Request, res: Response) => {
    await horseOwnerService.cancelRegistration(req.user!.id, req.params.id as string);
    res.json({ success: true, message: 'Đã rút đơn đăng ký thành công.' });
  });

  // ==========================================================
  // 3. THUÊ JOCKEY (NÀI NGỰA)
  // ==========================================================

  inviteJockey = asyncHandler(async (req: Request, res: Response) => {
    const input = req.body as InviteJockeyInput;

    if (!input.raceId || !input.horseId || !input.jockeyId) {
      throw new HttpError(400, 'Thiếu thông tin bắt buộc để mời Nài ngựa');
    }

    const invitation = await horseOwnerService.inviteJockey(req.user!.id, input);
    res.status(201).json({ 
      success: true, 
      message: 'Đã gửi lời mời tới kỵ sĩ.', 
      data: invitation 
    });
  });
  deleteHorse = asyncHandler(async (req: Request, res: Response) => {
    // Gọi xuống service để xóa ngựa, truyền vào ID chủ ngựa (để bảo mật) và ID của ngựa
    await horseOwnerService.deleteHorse(req.user!.id, req.params.id as string);
    
    res.json({ 
      success: true, 
      message: 'Đã xóa hồ sơ ngựa thành công!' 
    });
  });
}   