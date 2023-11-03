import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/database';
import { verifyAccessToken } from '../utils/jwt';
import { UnauthorizedError } from '../utils/errors';
import { logger } from '../utils/logger';

/**
 * Middleware para requisições vindas do bot Discord ou cliente Desktop.
 *
 * Dois modos de autenticação:
 *
 * 1. BOT (Discord/Desktop service):
 *    - Header Authorization: Bearer <AURABOT_BOT_TOKEN>  (string fixa do .env)
 *    - Header X-Discord-User: <discord_user_id>
 *    - O backend cria/recupera o usuário vinculado ao Discord ID
 *
 * 2. USUÁRIO NORMAL com JWT:
 *    - Header Authorization: Bearer <JWT_ACCESS_TOKEN>
 *    - Autenticação padrão — mesmo fluxo do authenticate.ts
 */
export async function botAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    const discordUserId = req.headers['x-discord-user'] as string | undefined;

    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedError('Token de autorização ausente');
    }

    const token = authHeader.slice(7).trim();
    if (!token) throw new UnauthorizedError('Token vazio');

    const botToken = process.env.AURABOT_BOT_TOKEN;

    // ── Modo 1: requisição do bot (token de serviço fixo) ─────────────────────
    if (botToken && token === botToken) {
      if (!discordUserId) {
        throw new UnauthorizedError('Header X-Discord-User é obrigatório para requisições do bot');
      }

      // Chave única para usuário Discord
      const externalKey = `discord:${discordUserId}`;

      let user = await prisma.user.findFirst({
        where: { spotifyId: externalKey, isActive: true },
      });

      // Cria usuário Discord na primeira vez que usar o bot
      if (!user) {
        user = await prisma.user.create({
          data: {
            email: `discord_${discordUserId}@aurabot.internal`,
            username: `dc_${discordUserId.slice(0, 14)}`,
            passwordHash: 'DISCORD_NO_PASSWORD',
            displayName: 'Discord User',
            emailVerified: true,
            isActive: true,
            spotifyId: externalKey,
            preferences: { create: { language: 'pt-BR' } },
          },
        });
        logger.info(`Usuário Discord criado automaticamente: ${discordUserId}`);
      }

      req.user = {
        userId:    user.id,
        email:     user.email,
        username:  user.username,
        sessionId: `discord-${discordUserId}`,
      };
      return next();
    }

    // ── Modo 2: JWT de usuário normal ─────────────────────────────────────────
    req.user = verifyAccessToken(token);
    next();
  } catch (err) {
    next(err);
  }
}
