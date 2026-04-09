import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SpotifyOAuthService } from '../../../spotify/spotify.service';
import { prisma } from '../../../config/database';
import { AppError, ExternalAPIError } from '../../../utils/errors';

const mockFetch = vi.fn();
global.fetch = mockFetch;

// ─── Factories ────────────────────────────────────────────────────────────────

const makeUser = (overrides = {}) => ({
  id: 'user-1',
  spotifyId: null,
  spotifyAccessToken: null,
  spotifyRefreshToken: null,
  spotifyTokenExpiry: null,
  ...overrides,
});

const makeTokenResponse = (overrides = {}) => ({
  ok: true,
  json: async () => ({
    access_token: 'spotify-access-token',
    refresh_token: 'spotify-refresh-token',
    expires_in: 3600,
    ...overrides,
  }),
});

const makeProfileResponse = (product = 'premium') => ({
  ok: true,
  json: async () => ({
    id: 'spotify-user-123',
    display_name: 'Test User',
    email: 'test@test.com',
    product,
    images: [{ url: 'https://example.com/avatar.jpg' }],
  }),
});

// ─── Suite ────────────────────────────────────────────────────────────────────

describe('SpotifyOAuthService', () => {
  let service: SpotifyOAuthService;

  beforeEach(() => {
    service = new SpotifyOAuthService();
    mockFetch.mockReset();
    process.env.SPOTIFY_CLIENT_ID = 'test-client-id';
    process.env.SPOTIFY_CLIENT_SECRET = 'test-client-secret';
    process.env.FRONTEND_URL = 'http://localhost:5173';
    process.env.BACKEND_URL = 'http://localhost:3001';
  });

  // ── getAuthUrl ─────────────────────────────────────────────────────────────

  describe('getAuthUrl', () => {
    it('gera URL de autorização do Spotify', () => {
      const url = service.getAuthUrl('user-1');
      expect(url).toContain('accounts.spotify.com/authorize');
      expect(url).toContain('response_type=code');
      expect(url).toContain('streaming');      // escopo de reprodução
      expect(url).toContain('state=');
    });

    it('codifica userId no state', () => {
      const url = service.getAuthUrl('user-abc');
      const params = new URLSearchParams(url.split('?')[1]);
      const state = params.get('state')!;
      const decoded = JSON.parse(Buffer.from(state, 'base64url').toString());
      expect(decoded.userId).toBe('user-abc');
      expect(decoded.ts).toBeTypeOf('number');
    });

    it('lança erro se SPOTIFY_CLIENT_ID não definido', () => {
      delete process.env.SPOTIFY_CLIENT_ID;
      expect(() => service.getAuthUrl('user-1')).toThrow(AppError);
    });
  });

  // ── exchangeCode ───────────────────────────────────────────────────────────

  describe('exchangeCode', () => {
    const makeState = (userId: string, tsOffset = 0) =>
      Buffer.from(JSON.stringify({ userId, ts: Date.now() + tsOffset })).toString('base64url');

    it('troca code por tokens e vincula usuário', async () => {
      mockFetch
        .mockResolvedValueOnce(makeTokenResponse())
        .mockResolvedValueOnce(makeProfileResponse());

      vi.mocked(prisma.user.update).mockResolvedValue(makeUser() as any);

      const state = makeState('user-1');
      const result = await service.exchangeCode('auth-code', state);

      expect(result.userId).toBe('user-1');
      expect(result.tokens.accessToken).toBe('spotify-access-token');
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'user-1' },
          data: expect.objectContaining({ spotifyId: 'spotify-user-123' }),
        })
      );
    });

    it('rejeita state expirado (>10 min)', async () => {
      const oldState = makeState('user-1', -(11 * 60 * 1000));
      await expect(service.exchangeCode('code', oldState))
        .rejects.toThrow('State expirado');
    });

    it('rejeita state inválido', async () => {
      await expect(service.exchangeCode('code', 'invalido'))
        .rejects.toThrow(AppError);
    });
  });

  // ── getValidToken ──────────────────────────────────────────────────────────

  describe('getValidToken', () => {
    it('retorna token em cache se ainda válido', async () => {
      const futureExpiry = new Date(Date.now() + 10 * 60 * 1000);
      vi.mocked(prisma.user.findUnique).mockResolvedValue(
        makeUser({
          spotifyAccessToken: 'cached-token',
          spotifyRefreshToken: 'refresh-token',
          spotifyTokenExpiry: futureExpiry,
        }) as any
      );

      const token = await service.getValidToken('user-1');
      expect(token).toBe('cached-token');
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('renova token quando expirado', async () => {
      const pastExpiry = new Date(Date.now() - 1000);
      vi.mocked(prisma.user.findUnique).mockResolvedValue(
        makeUser({
          spotifyAccessToken: 'old-token',
          spotifyRefreshToken: 'refresh-token',
          spotifyTokenExpiry: pastExpiry,
        }) as any
      );

      mockFetch.mockResolvedValue(makeTokenResponse({ access_token: 'new-token' }));
      vi.mocked(prisma.user.update).mockResolvedValue(makeUser() as any);

      const token = await service.getValidToken('user-1');
      expect(token).toBe('new-token');
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ spotifyAccessToken: 'new-token' }),
        })
      );
    });

    it('lança SPOTIFY_NOT_LINKED quando não vinculado', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(makeUser() as any);

      try {
        await service.getValidToken('user-1');
        expect.fail();
      } catch (e) {
        expect((e as AppError).code).toBe('SPOTIFY_NOT_LINKED');
        expect((e as AppError).message).toContain('não vinculada');
      }
    });
  });

  // ── getStatus ──────────────────────────────────────────────────────────────

  describe('getStatus', () => {
    it('retorna linked=false quando não vinculado', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(makeUser() as any);
      const status = await service.getStatus('user-1');
      expect(status.linked).toBe(false);
      expect(status.isPremium).toBeNull();
    });

    it('retorna isPremium=true para conta Premium', async () => {
      const futureExpiry = new Date(Date.now() + 60_000);
      vi.mocked(prisma.user.findUnique).mockResolvedValue(
        makeUser({
          spotifyId: 'sp-123',
          spotifyAccessToken: 'token',
          spotifyTokenExpiry: futureExpiry,
        }) as any
      );
      mockFetch.mockResolvedValue(makeProfileResponse('premium'));

      const status = await service.getStatus('user-1');
      expect(status.linked).toBe(true);
      expect(status.isPremium).toBe(true);
    });

    it('retorna isPremium=false para conta free', async () => {
      const futureExpiry = new Date(Date.now() + 60_000);
      vi.mocked(prisma.user.findUnique).mockResolvedValue(
        makeUser({
          spotifyId: 'sp-123',
          spotifyAccessToken: 'token',
          spotifyTokenExpiry: futureExpiry,
        }) as any
      );
      mockFetch.mockResolvedValue(makeProfileResponse('free'));

      const status = await service.getStatus('user-1');
      expect(status.isPremium).toBe(false);
    });
  });

  // ── play via Connect ───────────────────────────────────────────────────────

  describe('play', () => {
    it('lança SPOTIFY_PREMIUM_REQUIRED para erro 403', async () => {
      const futureExpiry = new Date(Date.now() + 60_000);
      vi.mocked(prisma.user.findUnique).mockResolvedValue(
        makeUser({ spotifyAccessToken: 'token', spotifyRefreshToken: 'ref', spotifyTokenExpiry: futureExpiry }) as any
      );
      mockFetch.mockResolvedValue({ ok: false, status: 403 });

      try {
        await service.play('user-1', 'spotify:track:abc');
        expect.fail();
      } catch (e) {
        expect((e as AppError).code).toBe('SPOTIFY_PREMIUM_REQUIRED');
        expect((e as AppError).message).toContain('Premium');
      }
    });

    it('lança SPOTIFY_NO_DEVICE para erro 404', async () => {
      const futureExpiry = new Date(Date.now() + 60_000);
      vi.mocked(prisma.user.findUnique).mockResolvedValue(
        makeUser({ spotifyAccessToken: 'token', spotifyRefreshToken: 'ref', spotifyTokenExpiry: futureExpiry }) as any
      );
      mockFetch.mockResolvedValue({ ok: false, status: 404 });

      try {
        await service.play('user-1', 'spotify:track:abc');
        expect.fail();
      } catch (e) {
        expect((e as AppError).code).toBe('SPOTIFY_NO_DEVICE');
        expect((e as AppError).message).toContain('dispositivo');
      }
    });
  });

  // ── disconnect ─────────────────────────────────────────────────────────────

  describe('disconnect', () => {
    it('limpa todos os campos Spotify do usuário', async () => {
      vi.mocked(prisma.user.update).mockResolvedValue(makeUser() as any);

      await service.disconnect('user-1');

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: {
          spotifyId:           null,
          spotifyAccessToken:  null,
          spotifyRefreshToken: null,
          spotifyTokenExpiry:  null,
        },
      });
    });
  });
});
