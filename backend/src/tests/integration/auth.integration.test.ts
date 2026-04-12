/**
 * Testes de integração para /api/auth
 *
 * Usa banco SQLite em memória e supertest.
 * O Prisma é mockado via setup.ts (vi.mock), então esses testes testam
 * o pipeline HTTP completo: middlewares → controller → service → resposta.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import app from '../../app';
import { prisma } from '../../config/database';
import { emailService } from '../../email/email.service';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const makeUser = (overrides = {}) => ({
  id: 'user-1',
  email: 'test@example.com',
  username: 'testuser',
  passwordHash: bcrypt.hashSync('Password1', 10),
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
  id: 'session-1',
  userId: 'user-1',
  accessToken: 'access-token-abc',
  refreshToken: 'refresh-token-abc',
  userAgent: null,
  ipAddress: null,
  platform: 'web',
  expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  isRevoked: false,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

// ─── POST /api/auth/register ──────────────────────────────────────────────────

describe('POST /api/auth/register', () => {
  const validPayload = {
    email: 'new@example.com',
    username: 'newuser',
    password: 'Password1',
    displayName: 'New User',
  };

  it('201 — cria conta com dados válidos', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.user.create).mockResolvedValue(makeUser({
      email: validPayload.email,
      username: validPayload.username,
    }));
    vi.mocked(prisma.emailVerification.create).mockResolvedValue({} as any);
    vi.mocked(prisma.session.create).mockResolvedValue(makeSession());

    const res = await request(app)
      .post('/api/auth/register')
      .send(validPayload);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.tokens.accessToken).toBeDefined();
    expect(res.body.data.user.email).toBe(validPayload.email);
  });

  it('409 — conflito quando email já existe', async () => {
    vi.mocked(prisma.user.findUnique)
      .mockResolvedValueOnce(makeUser())  // email exists
      .mockResolvedValueOnce(null);

    const res = await request(app)
      .post('/api/auth/register')
      .send(validPayload);

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.error.message).toContain('email');
  });

  it('409 — conflito quando username já existe', async () => {
    vi.mocked(prisma.user.findUnique)
      .mockResolvedValueOnce(null)       // email free
      .mockResolvedValueOnce(makeUser()); // username taken

    const res = await request(app)
      .post('/api/auth/register')
      .send(validPayload);

    expect(res.status).toBe(409);
    expect(res.body.error.message).toContain('usuário');
  });

  it('400 — senha fraca (sem número) retorna VALIDATION_ERROR', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

    const res = await request(app)
      .post('/api/auth/register')
      .send({ ...validPayload, password: 'SemNumero' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.fields?.password).toBeDefined();
  });

  it('400 — email com formato inválido retorna VALIDATION_ERROR', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ ...validPayload, email: 'nao-e-email' });

    expect(res.status).toBe(400);
    expect(res.body.error.fields?.email).toBeDefined();
  });

  it('400 — username muito curto (menos de 3 chars)', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ ...validPayload, username: 'ab' });

    expect(res.status).toBe(400);
  });

  it('dispara email de verificação após cadastro', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.user.create).mockResolvedValue(makeUser());
    vi.mocked(prisma.emailVerification.create).mockResolvedValue({} as any);
    vi.mocked(prisma.session.create).mockResolvedValue(makeSession());

    await request(app).post('/api/auth/register').send(validPayload);

    await new Promise(r => setTimeout(r, 20));
    expect(emailService.sendEmailVerification).toHaveBeenCalled();
  });

  it('resposta não expõe passwordHash', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.user.create).mockResolvedValue(makeUser());
    vi.mocked(prisma.emailVerification.create).mockResolvedValue({} as any);
    vi.mocked(prisma.session.create).mockResolvedValue(makeSession());

    const res = await request(app).post('/api/auth/register').send(validPayload);

    expect(JSON.stringify(res.body)).not.toContain('passwordHash');
  });
});

// ─── POST /api/auth/login ─────────────────────────────────────────────────────

describe('POST /api/auth/login', () => {
  const validPayload = { emailOrUsername: 'test@example.com', password: 'Password1' };

  it('200 — login bem-sucedido retorna user e tokens', async () => {
    vi.mocked(prisma.user.findFirst).mockResolvedValue(makeUser());
    vi.mocked(prisma.user.update).mockResolvedValue(makeUser());
    vi.mocked(prisma.session.create).mockResolvedValue(makeSession());

    const res = await request(app)
      .post('/api/auth/login')
      .send(validPayload);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.tokens.accessToken).toBeDefined();
    expect(res.body.data.tokens.refreshToken).toBeDefined();
  });

  it('401 — credenciais inválidas quando usuário não existe', async () => {
    vi.mocked(prisma.user.findFirst).mockResolvedValue(null);

    const res = await request(app)
      .post('/api/auth/login')
      .send(validPayload);

    expect(res.status).toBe(401);
    expect(res.body.error.message).toBe('Credenciais inválidas');
  });

  it('401 — retorna "senha incorreta" (não vaza existência do usuário via código diferente)', async () => {
    // Nota: a mensagem interna é "senha incorreta" mas o status HTTP é sempre 401
    vi.mocked(prisma.user.findFirst).mockResolvedValue(makeUser());
    vi.mocked(prisma.user.update).mockResolvedValue(makeUser());

    const res = await request(app)
      .post('/api/auth/login')
      .send({ ...validPayload, password: 'WrongPass1' });

    expect(res.status).toBe(401);
    // Não deve expor "usuário não encontrado" vs "senha errada" no nível de status
    expect([401]).toContain(res.status);
  });

  it('423 — conta bloqueada retorna status 423 com tempo de desbloqueio', async () => {
    const lockedUntil = new Date(Date.now() + 10 * 60 * 1000);
    vi.mocked(prisma.user.findFirst).mockResolvedValue(makeUser({ lockedUntil }));

    const res = await request(app)
      .post('/api/auth/login')
      .send(validPayload);

    expect(res.status).toBe(423);
    expect(res.body.error.message).toMatch(/minuto/);
  });

  it('aceita login com username em vez de email', async () => {
    vi.mocked(prisma.user.findFirst).mockResolvedValue(makeUser());
    vi.mocked(prisma.user.update).mockResolvedValue(makeUser());
    vi.mocked(prisma.session.create).mockResolvedValue(makeSession());

    const res = await request(app)
      .post('/api/auth/login')
      .send({ emailOrUsername: 'testuser', password: 'Password1' });

    expect(res.status).toBe(200);
  });

  it('resposta não expõe passwordHash', async () => {
    vi.mocked(prisma.user.findFirst).mockResolvedValue(makeUser());
    vi.mocked(prisma.user.update).mockResolvedValue(makeUser());
    vi.mocked(prisma.session.create).mockResolvedValue(makeSession());

    const res = await request(app).post('/api/auth/login').send(validPayload);

    expect(JSON.stringify(res.body)).not.toContain('passwordHash');
  });
});

// ─── POST /api/auth/refresh ───────────────────────────────────────────────────

describe('POST /api/auth/refresh', () => {
  it('400 — sem refresh token', async () => {
    const res = await request(app).post('/api/auth/refresh').send({});
    expect(res.status).toBe(400);
  });

  it('401 — refresh token inválido', async () => {
    const res = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken: 'token-invalido' });

    expect(res.status).toBe(401);
  });
});

// ─── POST /api/auth/logout ────────────────────────────────────────────────────

describe('POST /api/auth/logout', () => {
  it('200 — logout bem-sucedido mesmo sem token', async () => {
    vi.mocked(prisma.session.updateMany).mockResolvedValue({ count: 1 });

    const res = await request(app)
      .post('/api/auth/logout')
      .send({ refreshToken: 'some-token' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('200 — retorna sucesso mesmo sem enviar refreshToken', async () => {
    const res = await request(app).post('/api/auth/logout').send({});
    expect(res.status).toBe(200);
  });
});

// ─── POST /api/auth/forgot-password ──────────────────────────────────────────

describe('POST /api/auth/forgot-password', () => {
  it('200 — resposta genérica para email não cadastrado (anti-enumeração)', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

    const res = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: 'nao@existe.com' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(emailService.sendPasswordReset).not.toHaveBeenCalled();
  });

  it('200 — envia email para endereço cadastrado', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(makeUser());
    vi.mocked(prisma.passwordReset.updateMany).mockResolvedValue({ count: 0 });
    vi.mocked(prisma.passwordReset.create).mockResolvedValue({} as any);

    const res = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: 'test@example.com' });

    expect(res.status).toBe(200);
    expect(emailService.sendPasswordReset).toHaveBeenCalled();
  });

  it('400 — email inválido retorna erro de validação', async () => {
    const res = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: 'nao-e-email' });

    expect(res.status).toBe(400);
  });
});

// ─── GET /health ──────────────────────────────────────────────────────────────

describe('GET /health', () => {
  it('200 — retorna status ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.service).toBe('aurabot-api');
  });
});

// ─── Rota inexistente ─────────────────────────────────────────────────────────

describe('Rota não encontrada', () => {
  it('404 — rota inexistente retorna erro estruturado', async () => {
    const res = await request(app).get('/api/rota-inexistente');
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });
});
