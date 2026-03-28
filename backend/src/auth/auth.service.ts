import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { prisma } from '../config/database';
import {
  generateTokenPair,
  verifyRefreshToken,
  generateResetToken,
  TokenPair,
  JWTPayload,
} from '../utils/jwt';
import {
  validateEmail,
  validatePassword,
  validateUsername,
  validateResetToken,
} from '../utils/validators';
import {
  ConflictError,
  UnauthorizedError,
  NotFoundError,
  AccountLockedError,
  AppError,
} from '../utils/errors';
import { emailService } from '../email/email.service';
import { logger } from '../utils/logger';

// Configurações de segurança
const MAX_LOGIN_ATTEMPTS = 5;
const LOCK_DURATION_MINUTES = 15;
const RESET_TOKEN_HOURS = 1;
const SALT_ROUNDS = 12;

export interface RegisterDTO {
  email: string;
  username: string;
  password: string;
  displayName?: string;
}

export interface LoginDTO {
  emailOrUsername: string;
  password: string;
  userAgent?: string;
  ipAddress?: string;
  platform?: string;
}

export interface AuthResponse {
  user: PublicUser;
  tokens: TokenPair;
}

export interface PublicUser {
  id: string;
  email: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  emailVerified: boolean;
}

export class AuthService {
  // ─── Cadastro ───────────────────────────────────────────────────────────────

  async register(dto: RegisterDTO): Promise<AuthResponse> {
    const email = validateEmail(dto.email);
    const username = validateUsername(dto.username);
    const password = validatePassword(dto.password);

    // Verifica duplicatas em paralelo
    const [existingEmail, existingUsername] = await Promise.all([
      prisma.user.findUnique({ where: { email } }),
      prisma.user.findUnique({ where: { username } }),
    ]);

    if (existingEmail) {
      throw new ConflictError('Já existe uma conta com este email');
    }
    if (existingUsername) {
      throw new ConflictError('Este nome de usuário já está em uso');
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const sessionId = uuidv4();

    const user = await prisma.user.create({
      data: {
        email,
        username,
        passwordHash,
        displayName: dto.displayName?.trim() || username,
        preferences: { create: { language: 'pt-BR' } },
      },
    });

    // Enviar verificação de email (não bloqueia cadastro)
    const verifyToken = generateResetToken();
    await prisma.emailVerification.create({
      data: {
        userId: user.id,
        token: verifyToken,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });
    emailService.sendEmailVerification(user.email, verifyToken, user.username)
      .catch(err => logger.error('Erro ao enviar email de verificação:', err));

    const tokens = generateTokenPair({
      userId: user.id,
      email: user.email,
      username: user.username,
      sessionId,
    });

    await this.createSession(user.id, sessionId, tokens, undefined, undefined, 'web');

    logger.info(`Novo usuário cadastrado: ${user.email}`);

    return { user: this.toPublicUser(user), tokens };
  }

  // ─── Login ──────────────────────────────────────────────────────────────────

  async login(dto: LoginDTO): Promise<AuthResponse> {
    const { emailOrUsername, password, userAgent, ipAddress, platform = 'web' } = dto;

    if (!emailOrUsername?.trim()) {
      throw new UnauthorizedError('Credenciais inválidas');
    }

    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: emailOrUsername.trim().toLowerCase() },
          { username: emailOrUsername.trim().toLowerCase() },
        ],
        isActive: true,
      },
    });

    // Usuário não existe — mesma mensagem para evitar enumeração
    if (!user) {
      throw new UnauthorizedError('Credenciais inválidas');
    }

    // Verifica bloqueio por tentativas excessivas
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new AccountLockedError(user.lockedUntil);
    }

    const isValidPassword = await bcrypt.compare(password, user.passwordHash);

    if (!isValidPassword) {
      await this.handleFailedLogin(user.id, user.loginAttempts);
      throw new UnauthorizedError('senha incorreta');
    }

    // Reset tentativas após login bem-sucedido
    if (user.loginAttempts > 0) {
      await prisma.user.update({
        where: { id: user.id },
        data: { loginAttempts: 0, lockedUntil: null },
      });
    }

    const sessionId = uuidv4();
    const tokens = generateTokenPair({
      userId: user.id,
      email: user.email,
      username: user.username,
      sessionId,
    });

    await this.createSession(user.id, sessionId, tokens, userAgent, ipAddress, platform);

    logger.info(`Login: ${user.email} [${platform}]`);

    return { user: this.toPublicUser(user), tokens };
  }

  // ─── Refresh token ──────────────────────────────────────────────────────────

  async refreshToken(refreshToken: string): Promise<TokenPair> {
    const payload = verifyRefreshToken(refreshToken);

    const session = await prisma.session.findUnique({
      where: { refreshToken },
      include: { user: true },
    });

    if (!session || session.isRevoked || session.expiresAt < new Date()) {
      if (session && !session.isRevoked) {
        await prisma.session.update({
          where: { id: session.id },
          data: { isRevoked: true },
        });
      }
      throw new UnauthorizedError('Sessão expirada. Faça login novamente.');
    }

    if (!session.user.isActive) {
      throw new UnauthorizedError('Conta desativada');
    }

    // Rotação de tokens (token rotation para segurança)
    const newSessionId = uuidv4();
    const newTokens = generateTokenPair({
      userId: session.user.id,
      email: session.user.email,
      username: session.user.username,
      sessionId: newSessionId,
    });

    await prisma.$transaction([
      prisma.session.update({
        where: { id: session.id },
        data: { isRevoked: true },
      }),
      prisma.session.create({
        data: {
          userId: session.user.id,
          accessToken: newTokens.accessToken,
          refreshToken: newTokens.refreshToken,
          userAgent: session.userAgent,
          ipAddress: session.ipAddress,
          platform: session.platform,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      }),
    ]);

    return newTokens;
  }

  // ─── Logout ─────────────────────────────────────────────────────────────────

  async logout(refreshToken: string): Promise<void> {
    await prisma.session.updateMany({
      where: { refreshToken, isRevoked: false },
      data: { isRevoked: true },
    });
  }

  async logoutAll(userId: string): Promise<void> {
    const result = await prisma.session.updateMany({
      where: { userId, isRevoked: false },
      data: { isRevoked: true },
    });
    logger.info(`Todas as sessões encerradas para ${userId} (${result.count} sessões)`);
  }

  // ─── Esqueci a senha ────────────────────────────────────────────────────────

  async requestPasswordReset(email: string): Promise<void> {
    const validEmail = validateEmail(email);

    const user = await prisma.user.findUnique({ where: { email: validEmail } });

    // Sempre retorna sucesso para não revelar se o email existe
    if (!user || !user.isActive) {
      logger.info(`Reset solicitado para email não cadastrado: ${validEmail}`);
      return;
    }

    // Invalida tokens anteriores
    await prisma.passwordReset.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { expiresAt: new Date() },
    });

    const token = generateResetToken();
    await prisma.passwordReset.create({
      data: {
        userId: user.id,
        token,
        expiresAt: new Date(Date.now() + RESET_TOKEN_HOURS * 60 * 60 * 1000),
      },
    });

    await emailService.sendPasswordReset(user.email, token, user.username);
    logger.info(`Token de reset enviado para: ${user.email}`);
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    validateResetToken(token);
    const password = validatePassword(newPassword);

    const reset = await prisma.passwordReset.findUnique({
      where: { token },
      include: { user: true },
    });

    if (!reset) {
      throw new AppError('Token inválido ou expirado', 400, 'INVALID_TOKEN');
    }
    if (reset.usedAt) {
      throw new AppError('Este token já foi utilizado', 400, 'TOKEN_USED');
    }
    if (reset.expiresAt < new Date()) {
      throw new AppError('Token expirado. Solicite um novo.', 400, 'TOKEN_EXPIRED');
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    await prisma.$transaction([
      prisma.user.update({
        where: { id: reset.userId },
        data: { passwordHash, loginAttempts: 0, lockedUntil: null },
      }),
      prisma.passwordReset.update({
        where: { id: reset.id },
        data: { usedAt: new Date() },
      }),
      // Invalida todas as sessões existentes por segurança
      prisma.session.updateMany({
        where: { userId: reset.userId, isRevoked: false },
        data: { isRevoked: true },
      }),
    ]);

    logger.info(`Senha redefinida para: ${reset.user.email}`);
  }

  // ─── Verificação de email ───────────────────────────────────────────────────

  async verifyEmail(token: string): Promise<void> {
    const verification = await prisma.emailVerification.findUnique({
      where: { token },
    });

    if (!verification) {
      throw new AppError('Token de verificação inválido', 400, 'INVALID_TOKEN');
    }
    if (verification.usedAt) {
      throw new AppError('Email já verificado', 400, 'ALREADY_VERIFIED');
    }
    if (verification.expiresAt < new Date()) {
      throw new AppError('Token expirado. Solicite um novo.', 400, 'TOKEN_EXPIRED');
    }

    await prisma.$transaction([
      prisma.user.update({
        where: { id: verification.userId },
        data: { emailVerified: true },
      }),
      prisma.emailVerification.update({
        where: { id: verification.id },
        data: { usedAt: new Date() },
      }),
    ]);
  }

  // ─── Helpers privados ───────────────────────────────────────────────────────

  private async handleFailedLogin(userId: string, currentAttempts: number): Promise<void> {
    const newAttempts = currentAttempts + 1;

    if (newAttempts >= MAX_LOGIN_ATTEMPTS) {
      const lockedUntil = new Date(Date.now() + LOCK_DURATION_MINUTES * 60 * 1000);
      await prisma.user.update({
        where: { id: userId },
        data: { loginAttempts: newAttempts, lockedUntil },
      });
      logger.warn(`Conta bloqueada após ${newAttempts} tentativas: userId=${userId}`);
    } else {
      await prisma.user.update({
        where: { id: userId },
        data: { loginAttempts: newAttempts },
      });
    }
  }

  private async createSession(
    userId: string,
    _sessionId: string,
    tokens: TokenPair,
    userAgent?: string,
    ipAddress?: string,
    platform = 'web'
  ) {
    return prisma.session.create({
      data: {
        userId,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        userAgent,
        ipAddress,
        platform,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });
  }

  private toPublicUser(user: any): PublicUser {
    return {
      id: user.id,
      email: user.email,
      username: user.username,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      emailVerified: user.emailVerified,
    };
  }
}

export const authService = new AuthService();
