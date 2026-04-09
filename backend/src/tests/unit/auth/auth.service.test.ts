import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthService } from '../../../auth/auth.service';
import { prisma } from '../../../config/database';
import { emailService } from '../../../email/email.service';
import {
  ConflictError,
  UnauthorizedError,
  AccountLockedError,
  ValidationError,
  AppError,
} from '../../../utils/errors';
import bcrypt from 'bcryptjs';

// ─── Factories ────────────────────────────────────────────────────────────────

const makeUser = (overrides = {}) => ({
  id: 'user-123',
  email: 'test@example.com',
  username: 'testuser',
  passwordHash: '$2a$12$hashedpassword',
  displayName: 'Test User',
  avatarUrl: null,
  isActive: true,
  emailVerified: false,
  loginAttempts: 0,
  lockedUntil: null,
  spotifyId: null,
  spotifyAccessToken: null,
  spotifyRefreshToken: null,
  spotifyTokenExpiry: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

const makeSession = (overrides = {}) => ({
  id: 'session-123',
  userId: 'user-123',
  accessToken: 'access-token',
  refreshToken: 'refresh-token',
  userAgent: 'Mozilla/5.0',
  ipAddress: '127.0.0.1',
  platform: 'web',
  expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  isRevoked: false,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

// ─── Suite ────────────────────────────────────────────────────────────────────

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(() => {
    service = new AuthService();
  });

  // ──────────────────────────────────────────────────────────────────────────
  // register
  // ──────────────────────────────────────────────────────────────────────────

  describe('register', () => {
    const validDto = {
      email: 'new@example.com',
      username: 'newuser',
      password: 'Password1',
      displayName: 'New User',
    };

    it('cria conta com dados válidos', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.user.create).mockResolvedValue(makeUser({ email: validDto.email, username: validDto.username }));
      vi.mocked(prisma.emailVerification.create).mockResolvedValue({} as any);
      vi.mocked(prisma.session.create).mockResolvedValue(makeSession());

      const result = await service.register(validDto);

      expect(result.user.email).toBe(validDto.email);
      expect(result.tokens.accessToken).toBeDefined();
      expect(result.tokens.refreshToken).toBeDefined();
      expect(prisma.user.create).toHaveBeenCalledOnce();
    });

    it('rejeita email duplicado com ConflictError', async () => {
      vi.mocked(prisma.user.findUnique)
        .mockResolvedValueOnce(makeUser()) // email existe
        .mockResolvedValueOnce(null);

      await expect(service.register(validDto)).rejects.toThrow(ConflictError);
      await expect(service.register(validDto)).rejects.toThrow('Já existe uma conta com este email');
    });

    it('rejeita username duplicado com ConflictError', async () => {
      vi.mocked(prisma.user.findUnique)
        .mockResolvedValueOnce(null)         // email livre
        .mockResolvedValueOnce(makeUser());  // username existe

      await expect(service.register(validDto)).rejects.toThrow(ConflictError);
      await expect(service.register(validDto)).rejects.toThrow('nome de usuário já está em uso');
    });

    it('rejeita email inválido com ValidationError', async () => {
      await expect(service.register({ ...validDto, email: 'nao-e-email' }))
        .rejects.toThrow(ValidationError);

      await expect(service.register({ ...validDto, email: 'sem@dominio' }))
        .rejects.toThrow(ValidationError);

      await expect(service.register({ ...validDto, email: '' }))
        .rejects.toThrow(ValidationError);
    });

    it('mensagem de erro de email é "email inválido"', async () => {
      try {
        await service.register({ ...validDto, email: 'invalido' });
        expect.fail('Deveria ter lançado erro');
      } catch (e) {
        expect(e).toBeInstanceOf(ValidationError);
        expect((e as ValidationError).fields.email).toBe('email inválido');
      }
    });

    it('rejeita senha sem número', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

      await expect(service.register({ ...validDto, password: 'SemNumero' }))
        .rejects.toThrow(ValidationError);
    });

    it('rejeita senha sem letra', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

      await expect(service.register({ ...validDto, password: '12345678' }))
        .rejects.toThrow(ValidationError);
    });

    it('rejeita senha com menos de 8 caracteres', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

      await expect(service.register({ ...validDto, password: 'Ab1' }))
        .rejects.toThrow(ValidationError);
    });

    it('mensagem de senha inválida contém regras', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

      try {
        await service.register({ ...validDto, password: 'fraca' });
        expect.fail('Deveria ter lançado erro');
      } catch (e) {
        expect(e).toBeInstanceOf(ValidationError);
        const msg = (e as ValidationError).fields.password;
        expect(msg).toContain('8 caracteres');
        expect(msg).toContain('1 número');
        expect(msg).toContain('1 letra');
      }
    });

    it('envia email de verificação após cadastro', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.user.create).mockResolvedValue(makeUser());
      vi.mocked(prisma.emailVerification.create).mockResolvedValue({} as any);
      vi.mocked(prisma.session.create).mockResolvedValue(makeSession());

      await service.register(validDto);

      // Dá tempo do promise não-aguardado disparar
      await new Promise(r => setTimeout(r, 10));

      expect(emailService.sendEmailVerification).toHaveBeenCalledOnce();
    });

    it('rejeita username com caracteres especiais', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

      await expect(service.register({ ...validDto, username: 'user@name!' }))
        .rejects.toThrow(ValidationError);
    });

    it('rejeita username muito curto', async () => {
      await expect(service.register({ ...validDto, username: 'ab' }))
        .rejects.toThrow(ValidationError);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // login
  // ──────────────────────────────────────────────────────────────────────────

  describe('login', () => {
    const validDto = { emailOrUsername: 'test@example.com', password: 'Password1' };

    it('faz login com email e senha corretos', async () => {
      const hash = await bcrypt.hash('Password1', 10);
      vi.mocked(prisma.user.findFirst).mockResolvedValue(makeUser({ passwordHash: hash }));
      vi.mocked(prisma.user.update).mockResolvedValue(makeUser());
      vi.mocked(prisma.session.create).mockResolvedValue(makeSession());

      const result = await service.login(validDto);

      expect(result.user.email).toBe('test@example.com');
      expect(result.tokens.accessToken).toBeDefined();
    });

    it('faz login com username', async () => {
      const hash = await bcrypt.hash('Password1', 10);
      vi.mocked(prisma.user.findFirst).mockResolvedValue(makeUser({ passwordHash: hash }));
      vi.mocked(prisma.user.update).mockResolvedValue(makeUser());
      vi.mocked(prisma.session.create).mockResolvedValue(makeSession());

      const result = await service.login({ emailOrUsername: 'testuser', password: 'Password1' });
      expect(result.user.username).toBe('testuser');
    });

    it('retorna "senha incorreta" quando senha está errada', async () => {
      const hash = await bcrypt.hash('Password1', 10);
      vi.mocked(prisma.user.findFirst).mockResolvedValue(makeUser({ passwordHash: hash }));
      vi.mocked(prisma.user.update).mockResolvedValue(makeUser());

      try {
        await service.login({ ...validDto, password: 'WrongPass1' });
        expect.fail('Deveria ter lançado erro');
      } catch (e) {
        expect(e).toBeInstanceOf(UnauthorizedError);
        expect((e as UnauthorizedError).message).toBe('senha incorreta');
      }
    });

    it('retorna mensagem genérica quando usuário não existe (anti-enumeração)', async () => {
      vi.mocked(prisma.user.findFirst).mockResolvedValue(null);

      await expect(service.login(validDto)).rejects.toThrow('Credenciais inválidas');
    });

    it('incrementa loginAttempts após senha errada', async () => {
      const hash = await bcrypt.hash('correct', 10);
      vi.mocked(prisma.user.findFirst).mockResolvedValue(makeUser({ passwordHash: hash, loginAttempts: 2 }));
      vi.mocked(prisma.user.update).mockResolvedValue(makeUser());

      try {
        await service.login({ ...validDto, password: 'Wrong1234' });
      } catch {}

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ loginAttempts: 3 }),
        })
      );
    });

    it('bloqueia conta após 5 tentativas erradas', async () => {
      const hash = await bcrypt.hash('correct', 10);
      vi.mocked(prisma.user.findFirst).mockResolvedValue(
        makeUser({ passwordHash: hash, loginAttempts: 4 })
      );
      vi.mocked(prisma.user.update).mockResolvedValue(makeUser());

      try {
        await service.login({ ...validDto, password: 'Wrong1234' });
      } catch {}

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            loginAttempts: 5,
            lockedUntil: expect.any(Date),
          }),
        })
      );
    });

    it('lança AccountLockedError se conta estiver bloqueada', async () => {
      const lockedUntil = new Date(Date.now() + 10 * 60 * 1000);
      vi.mocked(prisma.user.findFirst).mockResolvedValue(
        makeUser({ lockedUntil })
      );

      await expect(service.login(validDto)).rejects.toThrow(AccountLockedError);
    });

    it('mensagem de conta bloqueada menciona o tempo', async () => {
      const lockedUntil = new Date(Date.now() + 10 * 60 * 1000);
      vi.mocked(prisma.user.findFirst).mockResolvedValue(makeUser({ lockedUntil }));

      try {
        await service.login(validDto);
      } catch (e) {
        expect((e as AccountLockedError).message).toMatch(/minuto/);
      }
    });

    it('reseta loginAttempts após login bem-sucedido', async () => {
      const hash = await bcrypt.hash('Password1', 10);
      vi.mocked(prisma.user.findFirst).mockResolvedValue(
        makeUser({ passwordHash: hash, loginAttempts: 3 })
      );
      vi.mocked(prisma.user.update).mockResolvedValue(makeUser());
      vi.mocked(prisma.session.create).mockResolvedValue(makeSession());

      await service.login(validDto);

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { loginAttempts: 0, lockedUntil: null },
        })
      );
    });

    it('rejeita usuário inativo', async () => {
      vi.mocked(prisma.user.findFirst).mockResolvedValue(null); // isActive:false exclui do findFirst

      await expect(service.login(validDto)).rejects.toThrow(UnauthorizedError);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // refreshToken
  // ──────────────────────────────────────────────────────────────────────────

  describe('refreshToken', () => {
    it('lança erro para refresh token inválido', async () => {
      await expect(service.refreshToken('token-invalido')).rejects.toThrow(AppError);
    });

    it('lança erro para sessão revogada', async () => {
      // Gera um token válido primeiro
      const { generateTokenPair } = await import('../../utils/jwt');
      const tokens = generateTokenPair({
        userId: 'u1', email: 'a@b.com', username: 'u', sessionId: 's1',
      });

      vi.mocked(prisma.session.findUnique).mockResolvedValue(
        makeSession({ refreshToken: tokens.refreshToken, isRevoked: true }) as any
      );

      await expect(service.refreshToken(tokens.refreshToken)).rejects.toThrow(UnauthorizedError);
    });

    it('lança erro para sessão expirada', async () => {
      const { generateTokenPair } = await import('../../utils/jwt');
      const tokens = generateTokenPair({
        userId: 'u1', email: 'a@b.com', username: 'u', sessionId: 's1',
      });

      vi.mocked(prisma.session.findUnique).mockResolvedValue(
        makeSession({
          refreshToken: tokens.refreshToken,
          expiresAt: new Date(Date.now() - 1000),
          user: makeUser(),
        }) as any
      );

      await expect(service.refreshToken(tokens.refreshToken)).rejects.toThrow(UnauthorizedError);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // requestPasswordReset
  // ──────────────────────────────────────────────────────────────────────────

  describe('requestPasswordReset', () => {
    it('retorna sucesso silencioso para email não cadastrado', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

      // Não deve lançar erro
      await expect(service.requestPasswordReset('nao@existe.com')).resolves.toBeUndefined();
      expect(emailService.sendPasswordReset).not.toHaveBeenCalled();
    });

    it('envia email de reset para email cadastrado', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(makeUser());
      vi.mocked(prisma.passwordReset.updateMany).mockResolvedValue({ count: 0 });
      vi.mocked(prisma.passwordReset.create).mockResolvedValue({} as any);

      await service.requestPasswordReset('test@example.com');

      expect(emailService.sendPasswordReset).toHaveBeenCalledWith(
        'test@example.com',
        expect.any(String),
        'testuser'
      );
    });

    it('rejeita email inválido', async () => {
      await expect(service.requestPasswordReset('invalido')).rejects.toThrow(ValidationError);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // resetPassword
  // ──────────────────────────────────────────────────────────────────────────

  describe('resetPassword', () => {
    const validToken = 'a'.repeat(64);

    it('rejeita token inexistente', async () => {
      vi.mocked(prisma.passwordReset.findUnique).mockResolvedValue(null);

      await expect(service.resetPassword(validToken, 'NewPass1')).rejects.toThrow(AppError);
    });

    it('rejeita token já utilizado', async () => {
      vi.mocked(prisma.passwordReset.findUnique).mockResolvedValue({
        id: 'r1', userId: 'u1', token: validToken,
        usedAt: new Date(), expiresAt: new Date(Date.now() + 60000),
        createdAt: new Date(), user: makeUser(),
      } as any);

      await expect(service.resetPassword(validToken, 'NewPass1'))
        .rejects.toThrow('já foi utilizado');
    });

    it('rejeita token expirado', async () => {
      vi.mocked(prisma.passwordReset.findUnique).mockResolvedValue({
        id: 'r1', userId: 'u1', token: validToken,
        usedAt: null, expiresAt: new Date(Date.now() - 1000),
        createdAt: new Date(), user: makeUser(),
      } as any);

      await expect(service.resetPassword(validToken, 'NewPass1'))
        .rejects.toThrow('expirado');
    });

    it('rejeita nova senha inválida', async () => {
      vi.mocked(prisma.passwordReset.findUnique).mockResolvedValue({
        id: 'r1', userId: 'u1', token: validToken,
        usedAt: null, expiresAt: new Date(Date.now() + 60000),
        createdAt: new Date(), user: makeUser(),
      } as any);

      await expect(service.resetPassword(validToken, '123'))
        .rejects.toThrow(ValidationError);
    });

    it('token muito curto lança ValidationError', async () => {
      await expect(service.resetPassword('curto', 'NewPass1'))
        .rejects.toThrow(ValidationError);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // logout
  // ──────────────────────────────────────────────────────────────────────────

  describe('logout', () => {
    it('revoga sessão pelo refresh token', async () => {
      vi.mocked(prisma.session.updateMany).mockResolvedValue({ count: 1 });

      await service.logout('some-refresh-token');

      expect(prisma.session.updateMany).toHaveBeenCalledWith({
        where: { refreshToken: 'some-refresh-token', isRevoked: false },
        data: { isRevoked: true },
      });
    });

    it('logoutAll revoga todas as sessões do usuário', async () => {
      vi.mocked(prisma.session.updateMany).mockResolvedValue({ count: 3 });

      await service.logoutAll('user-123');

      expect(prisma.session.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user-123', isRevoked: false },
        data: { isRevoked: true },
      });
    });
  });
});
