import type { Request, Response } from 'express';
import { asyncHandler } from '../middleware/error.middleware.js';
import * as authService from '../services/auth.service.js';

export class AuthController {
  login = asyncHandler(async (req: Request, res: Response) => {
    const { email, password } = req.body as { email?: string; password?: string };
    if (!email || !password) {
      res.status(400).json({ message: 'Email và mật khẩu là bắt buộc', statusCode: 400 });
      return;
    }
    const result = await authService.login(email, password);
    res.json(result);
  });

  register = asyncHandler(async (req: Request, res: Response) => {
    const { email, password, fullName, phone } = req.body as {
      email?: string;
      password?: string;
      fullName?: string;
      phone?: string;
    };
    if (!email || !password || !fullName) {
      res.status(400).json({
        message: 'Email, mật khẩu và họ tên là bắt buộc',
        statusCode: 400,
      });
      return;
    }
    const result = await authService.registerSpectator({ email, password, fullName, phone });
    res.status(201).json(result);
  });

  me = asyncHandler(async (req: Request, res: Response) => {
    const user = await authService.getMe(req.user!.id);
    res.json({ user });
  });

  changePassword = asyncHandler(async (req: Request, res: Response) => {
    const { oldPassword, newPassword } = req.body as { oldPassword?: string; newPassword?: string };
    if (!oldPassword || !newPassword) {
      res.status(400).json({ message: 'Mật khẩu cũ và mật khẩu mới là bắt buộc', statusCode: 400 });
      return;
    }
    const result = await authService.changePassword(req.user!.id, oldPassword, newPassword);
    res.json(result);
  });
}
