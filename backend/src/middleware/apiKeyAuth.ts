import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/database';
import { UnauthorizedError } from '../utils/errors';

export async function apiKeyAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    const apiKey = req.headers['x-api-key'] as string | undefined;

    if (!apiKey) {
      throw new UnauthorizedError('API key é obrigatória');
    }

    const user = await prisma.user.findUnique({
      where: { apiKey },
      select: { id: true, email: true, username: true, isActive: true },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedError('API key inválida');
    }

    req.user = {
      userId: user.id,
      email: user.email,
      username: user.username,
      sessionId: '',
    };

    next();
  } catch (err) {
    next(err);
  }
}
