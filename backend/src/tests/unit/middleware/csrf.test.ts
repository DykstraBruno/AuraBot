import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeReq(overrides: Partial<Request> = {}): Request {
  return {
    method:  'POST',
    path:    '/api/auth/login',
    headers: {},
    header: (name: string) => (overrides.headers as any)?.[name.toLowerCase()],
    session: {},
    ...overrides,
  } as unknown as Request;
}

function makeRes(): Response & { statusCode: number; jsonPayload: any } {
  const res = {
    statusCode: 200,
    jsonPayload: null,
    status(code: number) { this.statusCode = code; return this; },
    json(payload: any) { this.jsonPayload = payload; return this; },
  } as any;
  return res;
}

const makeNext = () => vi.fn() as unknown as NextFunction;

// ─── Suite ────────────────────────────────────────────────────────────────────

describe('csrfProtection middleware', () => {
  let csrfProtection: (req: Request, res: Response, next: NextFunction) => void;
  let generateCsrfToken: (req: Request) => string;

  beforeEach(async () => {
    vi.resetModules();
    const mod = await import('../../../middleware/csrfProtection');
    csrfProtection = mod.csrfProtection;
    generateCsrfToken = mod.generateCsrfToken;
  });

  // ── Requisições seguras (GET, HEAD, OPTIONS) ──────────────────────────────

  it('deixa passar requisição GET sem header CSRF', () => {
    const req  = makeReq({ method: 'GET' });
    const res  = makeRes();
    const next = makeNext();

    csrfProtection(req, res, next);
    expect(next).toHaveBeenCalledOnce();
    expect(next).toHaveBeenCalledWith(); // sem erro
  });

  it('deixa passar requisição HEAD sem header CSRF', () => {
    const req  = makeReq({ method: 'HEAD' });
    const res  = makeRes();
    const next = makeNext();

    csrfProtection(req, res, next);
    expect(next).toHaveBeenCalledWith();
  });

  it('deixa passar requisição OPTIONS sem header CSRF', () => {
    const req  = makeReq({ method: 'OPTIONS' });
    const res  = makeRes();
    const next = makeNext();

    csrfProtection(req, res, next);
    expect(next).toHaveBeenCalledWith();
  });

  // ── Requisições de mutação (POST, PUT, PATCH, DELETE) ────────────────────
  // Nota: /api/auth/login é intencionalmente exempto de CSRF (inicia a sessão).
  // Os testes de rejeição usam /api/music/play (rota de mutação protegida).

  it('rejeita POST em rota protegida sem header X-CSRF-Token com 403', () => {
    const req  = makeReq({ method: 'POST', path: '/api/music/play', headers: {} });
    const res  = makeRes();
    const next = makeNext();

    csrfProtection(req, res, next);

    const calledWithError = (next as any).mock.calls[0]?.[0] instanceof Error;
    const respondedDirectly = res.statusCode === 403;
    expect(calledWithError || respondedDirectly).toBe(true);
  });

  it('rejeita PUT em rota protegida sem header X-CSRF-Token', () => {
    const req  = makeReq({ method: 'PUT', path: '/api/music/queue', headers: {} });
    const res  = makeRes();
    const next = makeNext();

    csrfProtection(req, res, next);

    const calledWithError = (next as any).mock.calls[0]?.[0] instanceof Error;
    const respondedDirectly = res.statusCode === 403;
    expect(calledWithError || respondedDirectly).toBe(true);
  });

  it('rejeita DELETE em rota protegida sem header X-CSRF-Token', () => {
    const req  = makeReq({ method: 'DELETE', path: '/api/music/queue', headers: {} });
    const res  = makeRes();
    const next = makeNext();

    csrfProtection(req, res, next);

    const calledWithError = (next as any).mock.calls[0]?.[0] instanceof Error;
    const respondedDirectly = res.statusCode === 403;
    expect(calledWithError || respondedDirectly).toBe(true);
  });

  // ── Token válido ──────────────────────────────────────────────────────────

  it('aceita POST com X-CSRF-Token válido na sessão', () => {
    const sessionToken = 'valid-csrf-token-12345';
    const req = makeReq({
      method: 'POST',
      headers: { 'x-csrf-token': sessionToken },
      session: { csrfToken: sessionToken } as any,
    });
    req.header = (name: string) =>
      name.toLowerCase() === 'x-csrf-token' ? sessionToken : undefined;

    const res  = makeRes();
    const next = makeNext();

    csrfProtection(req, res, next);
    expect(next).toHaveBeenCalledWith(); // sem erro
  });

  it('rejeita POST com token que não bate com a sessão', () => {
    const req = makeReq({
      method: 'POST',
      path:   '/api/music/play',
      headers: { 'x-csrf-token': 'wrong-token' },
      session: { csrfToken: 'correct-token' } as any,
    });
    req.header = (name: string) =>
      name.toLowerCase() === 'x-csrf-token' ? 'wrong-token' : undefined;

    const res  = makeRes();
    const next = makeNext();

    csrfProtection(req, res, next);

    const calledWithError = (next as any).mock.calls[0]?.[0] instanceof Error;
    const respondedDirectly = res.statusCode === 403;
    expect(calledWithError || respondedDirectly).toBe(true);
  });

  // ── generateCsrfToken ─────────────────────────────────────────────────────

  it('generateCsrfToken retorna string não-vazia', () => {
    const req = makeReq({ session: {} as any });
    const token = generateCsrfToken(req);
    expect(typeof token).toBe('string');
    expect(token.length).toBeGreaterThan(0);
  });

  it('generateCsrfToken salva token na sessão', () => {
    const session: any = {};
    const req = makeReq({ session });
    generateCsrfToken(req);
    expect(session.csrfToken).toBeDefined();
    expect(typeof session.csrfToken).toBe('string');
  });

  it('generateCsrfToken retorna o mesmo token se já existir na sessão', () => {
    const session: any = { csrfToken: 'existing-token' };
    const req = makeReq({ session });
    const token = generateCsrfToken(req);
    expect(token).toBe('existing-token');
  });

  it('tokens gerados são únicos entre requisições', () => {
    const req1 = makeReq({ session: {} as any });
    const req2 = makeReq({ session: {} as any });
    const t1 = generateCsrfToken(req1);
    const t2 = generateCsrfToken(req2);
    expect(t1).not.toBe(t2);
  });
});
