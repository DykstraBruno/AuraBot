import { randomBytes } from 'crypto';
import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/errors';

// ─── Métodos que NÃO precisam de token CSRF ───────────────────────────────────
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

// ─── Gera (ou reutiliza) token CSRF na sessão ─────────────────────────────────

export function generateCsrfToken(req: Request): string {
  const session = (req as any).session;
  if (!session.csrfToken) {
    session.csrfToken = randomBytes(32).toString('hex');
  }
  return session.csrfToken as string;
}

// ─── Middleware de proteção CSRF ──────────────────────────────────────────────
//
// Estratégia: Synchronizer Token Pattern
//   1. Cliente obtém o token via GET /api/auth/csrf-token
//   2. Servidor armazena o token na sessão (gerado por generateCsrfToken)
//   3. Em cada requisição de mutação, o cliente envia o token no header X-CSRF-Token
//   4. O middleware compara o header com o token da sessão
//
// Não se aplica a chamadas do Discord Bot (x-platform: discord)
// nem ao endpoint de saúde.

export function csrfProtection(req: Request, res: Response, next: NextFunction): void {
  // Métodos seguros passam direto
  if (SAFE_METHODS.has(req.method.toUpperCase())) {
    return next();
  }

  // Clientes bot (Discord, Desktop) usam botAuth com token de serviço
  // CSRF não se aplica a eles
  const platform = req.headers['x-platform'];
  if (platform === 'discord' || platform === 'desktop') {
    return next();
  }

  const session = (req as any).session as { csrfToken?: string } | undefined;

  // Se não há sessão ou não há token na sessão, a requisição é de um cliente
  // sem sessão — nesse caso o CSRF não pode ser validado, rejeita.
  // Exceção: endpoints de autenticação (register/login) que criam a sessão.
  const isAuthInitRoute =
    req.path.includes('/auth/register') ||
    req.path.includes('/auth/login') ||
    req.path.includes('/auth/refresh');

  if (isAuthInitRoute) {
    return next();
  }

  const tokenFromHeader = req.header('x-csrf-token');
  const tokenFromSession = session?.csrfToken;

  if (!tokenFromHeader || !tokenFromSession || tokenFromHeader !== tokenFromSession) {
    return next(
      new AppError('Token CSRF inválido ou ausente', 403, 'CSRF_INVALID')
    );
  }

  next();
}
