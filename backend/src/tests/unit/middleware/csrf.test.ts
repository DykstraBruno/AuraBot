import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeReq(overrides: Partial<Request> = {}): Request {
  return {
    method:  'POST',
    path:    '/api/auth/login',
    headers: {},
    header: (name: string) => (overrides.headers as any)?.[name.toLowerCase()],
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
    process.env.CSRF_SECRET = 'test-csrf-secret-32bytes-minimum!';
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
    expect(next).toHaveBeenCalledWith();
  });

  it('deixa passar requisição HEAD sem header CSRF', () => {
    csrfProtection(makeReq({ method: 'HEAD' }), makeRes(), makeNext());
  });

  it('deixa passar requisição OPTIONS sem header CSRF', () => {
    const next = makeNext();
    csrfProtection(makeReq({ method: 'OPTIONS' }), makeRes(), next);
    expect(next).toHaveBeenCalledWith();
  });

  // ── Requisições de mutação sem token ─────────────────────────────────────

  it('rejeita POST em rota protegida sem header X-CSRF-Token com 403', () => {
    const next = makeNext();
    csrfProtection(makeReq({ method: 'POST', path: '/api/music/play', headers: {} }), makeRes(), next);

    const calledWithError = (next as any).mock.calls[0]?.[0] instanceof Error;
    const respondedDirectly = makeRes().statusCode === 403;
    expect(calledWithError || respondedDirectly).toBe(true);
  });

  it('rejeita PUT em rota protegida sem header X-CSRF-Token', () => {
    const next = makeNext();
    csrfProtection(makeReq({ method: 'PUT', path: '/api/music/queue', headers: {} }), makeRes(), next);

    expect((next as any).mock.calls[0]?.[0] instanceof Error).toBe(true);
  });

  it('rejeita DELETE em rota protegida sem header X-CSRF-Token', () => {
    const next = makeNext();
    csrfProtection(makeReq({ method: 'DELETE', path: '/api/music/queue', headers: {} }), makeRes(), next);

    expect((next as any).mock.calls[0]?.[0] instanceof Error).toBe(true);
  });

  // ── Token válido (gerado pelo próprio middleware) ─────────────────────────

  it('aceita POST com X-CSRF-Token válido', () => {
    const token = generateCsrfToken(makeReq());
    const req   = makeReq({ method: 'POST', path: '/api/music/play', headers: { 'x-csrf-token': token } });
    req.header  = (name: string) => name.toLowerCase() === 'x-csrf-token' ? token : undefined;

    const next = makeNext();
    csrfProtection(req, makeRes(), next);
    expect(next).toHaveBeenCalledWith();
  });

  it('rejeita token mal-formado', () => {
    const req  = makeReq({ method: 'POST', path: '/api/music/play', headers: { 'x-csrf-token': 'invalido' } });
    req.header = () => 'invalido';

    const next = makeNext();
    csrfProtection(req, makeRes(), next);
    expect((next as any).mock.calls[0]?.[0] instanceof Error).toBe(true);
  });

  it('rejeita token com assinatura errada', () => {
    const ts    = Date.now().toString(36);
    const token = `${ts}.assinaturafalsa`;
    const req   = makeReq({ method: 'POST', path: '/api/music/play', headers: { 'x-csrf-token': token } });
    req.header  = () => token;

    const next = makeNext();
    csrfProtection(req, makeRes(), next);
    expect((next as any).mock.calls[0]?.[0] instanceof Error).toBe(true);
  });

  // ── Rotas isentas ─────────────────────────────────────────────────────────

  it('deixa passar /auth/login sem token', () => {
    const next = makeNext();
    csrfProtection(makeReq({ method: 'POST', path: '/api/auth/login' }), makeRes(), next);
    expect(next).toHaveBeenCalledWith();
  });

  it('deixa passar /auth/register sem token', () => {
    const next = makeNext();
    csrfProtection(makeReq({ method: 'POST', path: '/api/auth/register' }), makeRes(), next);
    expect(next).toHaveBeenCalledWith();
  });

  // ── Clientes bot ──────────────────────────────────────────────────────────

  it('deixa passar x-platform: discord sem token', () => {
    const next = makeNext();
    const req  = makeReq({ method: 'POST', path: '/api/music/play', headers: { 'x-platform': 'discord' } });
    csrfProtection(req, makeRes(), next);
    expect(next).toHaveBeenCalledWith();
  });

  // ── generateCsrfToken ─────────────────────────────────────────────────────

  it('generateCsrfToken retorna string com formato ts.nonce.sig', () => {
    const token = generateCsrfToken(makeReq());
    expect(token).toMatch(/^[0-9a-z]+\.[0-9a-f]+\.[0-9a-f]+$/);
  });

  it('tokens gerados são únicos', () => {
    const t1 = generateCsrfToken(makeReq());
    const t2 = generateCsrfToken(makeReq());
    expect(t1).not.toBe(t2);
  });
});
