import { Router } from 'express';
import { signup, login, me } from '../controllers/auth.controller.js';
import { authMiddleware } from '../middleware/auth.js';

export const authRouter = Router();

authRouter.post('/signup', signup);
authRouter.post('/login', login);
authRouter.get('/me', authMiddleware, me);
