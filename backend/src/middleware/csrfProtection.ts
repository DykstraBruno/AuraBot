import { createHmac, randomBytes, timingSafeEqual } from 'crypto';
import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/errors';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hora

function secret(): string {
  const s = process.env.CSRF_SECRET;
  if (!s) throw new AppError('CSRF_SECRET não configurado', 500, 'CONFIG_ERROR');
  return s;
}

function sign(payload: string): string {
  return createHmac('sha256', secret()).update(payload).digest('hex');
}

// ─── Gera token stateless: "<timestamp>.<hmac>" ───────────────────────────────

export function generateCsrfToken(_req: Request): string {
  const ts    = Date.now().toString(36);
  const nonce = randomBytes(8).toString('hex');
  const payload = `${ts}.${nonce}`;
  const sig = sign(payload);
  return `${payload}.${sig}`;
}

// ─── Valida token ─────────────────────────────────────────────────────────────

function verifyToken(token: string): boolean {
  // formato: "<ts>.<nonce>.<sig>"
  const parts = token.split('.');
  if (parts.length !== 3) return false;
  const [ts, nonce, sig] = parts;

  const payload  = `${ts}.${nonce}`;
  const expected = sign(payload);
  try {
    if (!timingSafeEqual(Buffer.from(sig, 'hex'), Buffer.from(expected, 'hex'))) return false;
  } catch {
    return false;
  }

  const age = Date.now() - parseInt(ts, 36);
  return age >= 0 && age <= TOKEN_TTL_MS;
}

// ─── Middleware ───────────────────────────────────────────────────────────────

export function csrfProtection(req: Request, res: Response, next: NextFunction): void {
  if (SAFE_METHODS.has(req.method.toUpperCase())) return next();

  const platform = req.headers['x-platform'];
  if (platform === 'discord' || platform === 'desktop') return next();

  const isAuthInitRoute =
    req.path.includes('/auth/register') ||
    req.path.includes('/auth/login') ||
    req.path.includes('/auth/refresh');
  if (isAuthInitRoute) return next();

  const token = req.header('x-csrf-token');
  if (!token || !verifyToken(token)) {
    return next(new AppError('Token CSRF inválido ou ausente', 403, 'CSRF_INVALID'));
  }

  next();
}
