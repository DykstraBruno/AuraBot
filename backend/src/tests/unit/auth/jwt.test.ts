import { describe, it, expect, vi } from 'vitest';
import {
  generateTokenPair,
  verifyAccessToken,
  verifyRefreshToken,
  generateResetToken,
} from '../../../utils/jwt';
import { AppError } from '../../../utils/errors';

const VALID_PAYLOAD = {
  userId: 'user-123',
  email: 'test@example.com',
  username: 'testuser',
  sessionId: 'session-abc',
};

describe('generateTokenPair', () => {
  it('gera accessToken e refreshToken', () => {
    const tokens = generateTokenPair(VALID_PAYLOAD);
    expect(tokens.accessToken).toBeTypeOf('string');
    expect(tokens.refreshToken).toBeTypeOf('string');
    expect(tokens.expiresIn).toBeTypeOf('number');
    expect(tokens.expiresIn).toBeGreaterThan(0);
  });

  it('tokens são strings JWT (3 partes separadas por .)', () => {
    const { accessToken, refreshToken } = generateTokenPair(VALID_PAYLOAD);
    expect(accessToken.split('.')).toHaveLength(3);
    expect(refreshToken.split('.')).toHaveLength(3);
  });

  it('accessToken e refreshToken são diferentes', () => {
    const { accessToken, refreshToken } = generateTokenPair(VALID_PAYLOAD);
    expect(accessToken).not.toBe(refreshToken);
  });

  it('lança erro se JWT_SECRET não estiver definido', () => {
    const original = process.env.JWT_SECRET;
    delete process.env.JWT_SECRET;

    expect(() => generateTokenPair(VALID_PAYLOAD)).toThrow(AppError);

    process.env.JWT_SECRET = original;
  });
});

describe('verifyAccessToken', () => {
  it('verifica e retorna payload do accessToken', () => {
    const { accessToken } = generateTokenPair(VALID_PAYLOAD);
    const decoded = verifyAccessToken(accessToken);

    expect(decoded.userId).toBe(VALID_PAYLOAD.userId);
    expect(decoded.email).toBe(VALID_PAYLOAD.email);
    expect(decoded.username).toBe(VALID_PAYLOAD.username);
  });

  it('lança TOKEN_INVALID para token malformado', () => {
    try {
      verifyAccessToken('token.invalido.aqui');
      expect.fail();
    } catch (e) {
      expect(e).toBeInstanceOf(AppError);
      expect((e as AppError).code).toBe('TOKEN_INVALID');
    }
  });

  it('lança TOKEN_INVALID para string aleatória', () => {
    try {
      verifyAccessToken('nao-e-um-jwt');
      expect.fail();
    } catch (e) {
      expect((e as AppError).statusCode).toBe(401);
    }
  });

  it('lança TOKEN_EXPIRED para token expirado', async () => {
    // Gera token com expiração imediata usando secret temporário
    const jwt = await import('jsonwebtoken');
    const expiredToken = jwt.sign(
      VALID_PAYLOAD,
      process.env.JWT_SECRET!,
      { expiresIn: 1, issuer: 'aurabot', audience: 'aurabot-client' }
    );

    // Aguarda expirar
    await new Promise(r => setTimeout(r, 1100));

    try {
      verifyAccessToken(expiredToken);
      expect.fail();
    } catch (e) {
      expect((e as AppError).code).toBe('TOKEN_EXPIRED');
    }
  });

  it('rejeita token com audience incorreto', () => {
    const jwt = require('jsonwebtoken');
    const wrongAudToken = jwt.sign(
      VALID_PAYLOAD,
      process.env.JWT_SECRET!,
      { expiresIn: '15m', issuer: 'aurabot', audience: 'wrong-audience' }
    );

    expect(() => verifyAccessToken(wrongAudToken)).toThrow(AppError);
  });
});

describe('verifyRefreshToken', () => {
  it('verifica e retorna userId e sessionId', () => {
    const { refreshToken } = generateTokenPair(VALID_PAYLOAD);
    const decoded = verifyRefreshToken(refreshToken);

    expect(decoded.userId).toBe(VALID_PAYLOAD.userId);
    expect(decoded.sessionId).toBe(VALID_PAYLOAD.sessionId);
  });

  it('lança REFRESH_INVALID para token malformado', () => {
    try {
      verifyRefreshToken('nao-e-refresh');
      expect.fail();
    } catch (e) {
      expect((e as AppError).code).toBe('REFRESH_INVALID');
    }
  });

  it('rejeita accessToken como refreshToken', () => {
    const { accessToken } = generateTokenPair(VALID_PAYLOAD);
    // Access token tem audience diferente — deve falhar
    expect(() => verifyRefreshToken(accessToken)).toThrow(AppError);
  });
});

describe('generateResetToken', () => {
  it('gera token de 64 caracteres hexadecimais', () => {
    const token = generateResetToken();
    expect(token).toHaveLength(64);
    expect(token).toMatch(/^[0-9a-f]{64}$/);
  });

  it('gera tokens únicos', () => {
    const t1 = generateResetToken();
    const t2 = generateResetToken();
    expect(t1).not.toBe(t2);
  });
});
