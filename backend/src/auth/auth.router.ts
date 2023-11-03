import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { authController } from './auth.controller';
import { authenticate } from '../middleware/authenticate';

export const authRouter = Router();

// Rate limit para rotas de auth sensíveis: 10 tentativas por hora
const authRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: 'TOO_MANY_REQUESTS',
      message: 'Muitas tentativas. Tente novamente em 1 hora.',
    },
  },
  skipSuccessfulRequests: true, // só conta falhas
});

// Rate limit para reset de senha: 3 por hora
const resetRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  message: {
    success: false,
    error: {
      code: 'TOO_MANY_REQUESTS',
      message: 'Muitas solicitações de reset. Tente novamente em 1 hora.',
    },
  },
});

// Rotas públicas
authRouter.post('/register', authRateLimit, authController.register);
authRouter.post('/login', authRateLimit, authController.login);
authRouter.post('/refresh', authController.refresh);
authRouter.post('/logout', authController.logout);
authRouter.post('/forgot-password', resetRateLimit, authController.requestPasswordReset);
authRouter.post('/reset-password', resetRateLimit, authController.resetPassword);
authRouter.post('/verify-email', authController.verifyEmail);

// Rotas protegidas
authRouter.get('/me', authenticate, authController.me);
authRouter.post('/logout-all', authenticate, authController.logoutAll);
