// @ts-ignore: express types may be unavailable in this environment
import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware.js';
import { asyncHandler } from '../middleware/error.middleware.js';
import * as authService from '../services/auth.service.js';

export const authRouter = Router();

authRouter.post(
  '/login',
  asyncHandler(async (req, res) => {
    const { email, password } = req.body as { email?: string; password?: string };
    if (!email || !password) {
      res.status(400).json({ message: 'Email và mật khẩu là bắt buộc', statusCode: 400 });
      return;
    }
    const result = await authService.login(email, password);
    res.json(result);
  }),
);

authRouter.post(
  '/register',
  asyncHandler(async (req, res) => {
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
  }),
);

authRouter.get(
  '/me',
  authenticate,
  asyncHandler(async (req, res) => {
    const user = await authService.getMe(req.user!.id);
    res.json({ user });
  }),
);
