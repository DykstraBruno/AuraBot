import jwt from 'jsonwebtoken';
import { AppError } from './errors';

export interface JWTPayload {
  userId: string;
  email: string;
  username: string;
  sessionId: string;
  iat?: number;
  exp?: number;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number; // segundos
}

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) throw new AppError(`Variável de ambiente ${key} não definida`, 500);
  return value;
}

export function generateTokenPair(
  payload: Omit<JWTPayload, 'iat' | 'exp'>
): TokenPair {
  const expiresIn = 15 * 60; // 15 minutos em segundos

  const accessToken = jwt.sign(payload, requireEnv('JWT_SECRET'), {
    expiresIn,
    issuer: 'aurabot',
    audience: 'aurabot-client',
  });

  const refreshToken = jwt.sign(
    { userId: payload.userId, sessionId: payload.sessionId },
    requireEnv('JWT_REFRESH_SECRET'),
    {
      expiresIn: '7d',
      issuer: 'aurabot',
      audience: 'aurabot-refresh',
    }
  );

  return { accessToken, refreshToken, expiresIn };
}

export function verifyAccessToken(token: string): JWTPayload {
  try {
    return jwt.verify(token, requireEnv('JWT_SECRET'), {
      issuer: 'aurabot',
      audience: 'aurabot-client',
    }) as JWTPayload;
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      throw new AppError('Token de acesso expirado', 401, 'TOKEN_EXPIRED');
    }
    if (err instanceof jwt.JsonWebTokenError) {
      throw new AppError('Token inválido', 401, 'TOKEN_INVALID');
    }
    throw new AppError('Erro na verificação do token', 401, 'TOKEN_ERROR');
  }
}

export function verifyRefreshToken(token: string): { userId: string; sessionId: string } {
  try {
    return jwt.verify(token, requireEnv('JWT_REFRESH_SECRET'), {
      issuer: 'aurabot',
      audience: 'aurabot-refresh',
    }) as { userId: string; sessionId: string };
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      throw new AppError('Sessão expirada. Faça login novamente.', 401, 'REFRESH_EXPIRED');
    }
    throw new AppError('Token de refresh inválido', 401, 'REFRESH_INVALID');
  }
}

export function generateResetToken(): string {
  const { randomBytes } = require('crypto');
  return randomBytes(32).toString('hex'); // 64 chars hex
}
