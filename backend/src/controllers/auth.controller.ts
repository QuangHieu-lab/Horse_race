import type { Request, Response } from 'express';
import { asyncHandler } from '../middleware/error.middleware.js';
import {
  removeUploadedFile,
  runAccountApplicationPdfUpload,
} from '../middleware/upload.middleware.js';
import * as authService from '../services/auth.service.js';
import { HttpError } from '../utils/http-error.js';

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
    if (req.is('multipart/form-data')) {
      await runAccountApplicationPdfUpload(req, res);
    }

    const { email, password, fullName, phone, role = 'spectator' } = req.body as {
      email?: string;
      password?: string;
      fullName?: string;
      phone?: string;
      role?: 'spectator' | 'jockey' | 'horse_owner';
    };

    if (!email || !password || !fullName) {
      await removeUploadedFile(req.file?.path);
      res.status(400).json({
        message: 'Email, mật khẩu và họ tên là bắt buộc',
        statusCode: 400,
      });
      return;
    }

    if (!['spectator', 'jockey', 'horse_owner'].includes(role)) {
      await removeUploadedFile(req.file?.path);
      throw new HttpError(400, 'Chỉ hỗ trợ đăng ký tài khoản Khán giả, Jockey hoặc Chủ ngựa');
    }

    if (role === 'jockey') {
      if (!req.file) throw new HttpError(400, 'Hồ sơ PDF của Jockey là bắt buộc');
      const forwardedProtocol = req.get('x-forwarded-proto')?.split(',')[0]?.trim();
      const protocol = forwardedProtocol || req.protocol;
      const applicationPdfUrl = `${protocol}://${req.get('host')}/uploads/account-applications/${req.file.filename}`;

      try {
        const result = await authService.registerJockeyApplication({
          email,
          password,
          fullName,
          phone,
          applicationPdfUrl,
          applicationPdfName: req.file.originalname,
        });
        res.status(202).json(result);
      } catch (error) {
        await removeUploadedFile(req.file.path);
        throw error;
      }
      return;
    }

    if (role === 'horse_owner') {
      if (!req.file) throw new HttpError(400, 'Hồ sơ PDF của Chủ ngựa là bắt buộc');
      const forwardedProtocol = req.get('x-forwarded-proto')?.split(',')[0]?.trim();
      const protocol = forwardedProtocol || req.protocol;
      const applicationPdfUrl = `${protocol}://${req.get('host')}/uploads/account-applications/${req.file.filename}`;

      try {
        const result = await authService.registerOwnerApplication({
          email,
          password,
          fullName,
          phone,
          applicationPdfUrl,
          applicationPdfName: req.file.originalname,
        });
        res.status(202).json(result);
      } catch (error) {
        await removeUploadedFile(req.file.path);
        throw error;
      }
      return;
    }

    await removeUploadedFile(req.file?.path);
    const result = await authService.registerSpectator({ email, password, fullName, phone });
    res.status(201).json(result);
  });

  me = asyncHandler(async (req: Request, res: Response) => {
    const user = await authService.getMe(req.user!.id);
    res.json({ user });
  });

  updateProfile = asyncHandler(async (req: Request, res: Response) => {
    const { fullName, phone } = req.body as { fullName?: string; phone?: string };
    const user = await authService.updateProfile(req.user!.id, { fullName, phone });
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

  forgotPassword = asyncHandler(async (req: Request, res: Response) => {
    const { email } = req.body as { email?: string };
    if (!email) {
      res.status(400).json({ message: 'Email là bắt buộc', statusCode: 400 });
      return;
    }
    const result = await authService.requestPasswordReset(email);
    res.json(result);
  });

  resetPassword = asyncHandler(async (req: Request, res: Response) => {
    const { token, newPassword } = req.body as { token?: string; newPassword?: string };
    if (!token || !newPassword) {
      res.status(400).json({ message: 'Token và mật khẩu mới là bắt buộc', statusCode: 400 });
      return;
    }
    const result = await authService.resetPassword(token, newPassword);
    res.json(result);
  });
}
