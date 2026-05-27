import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';

export const authRouter = Router();
const authController = new AuthController();

authRouter.post('/login', authController.login);

authRouter.post('/register', authController.register);

authRouter.get('/me', authenticate, authController.me);
