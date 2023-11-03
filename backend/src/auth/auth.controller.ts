import { Request, Response, NextFunction } from 'express';
import { authService } from './auth.service';
import { AppError } from '../utils/errors';

export const authController = {
  async register(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await authService.register(req.body);
      res.status(201).json({ success: true, message: 'Conta criada com sucesso!', data: result });
    } catch (err) { next(err); }
  },

  async login(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await authService.login({
        ...req.body,
        userAgent: req.headers['user-agent'],
        ipAddress: req.ip,
        platform: req.body.platform || 'web',
      });
      res.json({ success: true, message: 'Login realizado com sucesso!', data: result });
    } catch (err) { next(err); }
  },

  async refresh(req: Request, res: Response, next: NextFunction) {
    try {
      const { refreshToken } = req.body;
      if (!refreshToken) throw new AppError('Refresh token é obrigatório', 400);
      const tokens = await authService.refreshToken(refreshToken);
      res.json({ success: true, data: { tokens } });
    } catch (err) { next(err); }
  },

  async logout(req: Request, res: Response, next: NextFunction) {
    try {
      const { refreshToken } = req.body;
      if (refreshToken) await authService.logout(refreshToken);
      res.json({ success: true, message: 'Logout realizado com sucesso' });
    } catch (err) { next(err); }
  },

  async logoutAll(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user?.userId) throw new AppError('Não autorizado', 401);
      await authService.logoutAll(req.user.userId);
      res.json({ success: true, message: 'Todas as sessões foram encerradas' });
    } catch (err) { next(err); }
  },

  async me(req: Request, res: Response, next: NextFunction) {
    try {
      res.json({ success: true, data: { user: req.user } });
    } catch (err) { next(err); }
  },

  async requestPasswordReset(req: Request, res: Response, next: NextFunction) {
    try {
      await authService.requestPasswordReset(req.body.email);
      // Sempre retorna OK para não revelar se email existe
      res.json({
        success: true,
        message: 'Se este email estiver cadastrado, você receberá as instruções em breve.',
      });
    } catch (err) { next(err); }
  },

  async resetPassword(req: Request, res: Response, next: NextFunction) {
    try {
      const { token, password } = req.body;
      if (!token) throw new AppError('Token é obrigatório', 400);
      if (!password) throw new AppError('Nova senha é obrigatória', 400);
      await authService.resetPassword(token, password);
      res.json({ success: true, message: 'Senha redefinida com sucesso! Faça login novamente.' });
    } catch (err) { next(err); }
  },

  async verifyEmail(req: Request, res: Response, next: NextFunction) {
    try {
      const { token } = req.body;
      if (!token) throw new AppError('Token é obrigatório', 400);
      await authService.verifyEmail(token);
      res.json({ success: true, message: 'Email verificado com sucesso!' });
    } catch (err) { next(err); }
  },
};
