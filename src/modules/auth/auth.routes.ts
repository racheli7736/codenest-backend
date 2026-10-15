import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { authRateLimit } from '../../middleware/rateLimit';
import * as authController from './auth.controller';

export const authRouter = Router();

authRouter.post('/register', authRateLimit, authController.register);
authRouter.post('/login', authRateLimit, authController.login);
authRouter.get('/me', authenticate, authController.me);
