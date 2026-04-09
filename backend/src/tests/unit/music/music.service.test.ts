import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MusicService } from '../../../music/music.service';
import { prisma } from '../../../config/database';
import { ExternalAPIError } from '../../../utils/errors';

const mockFetch = vi.fn();
global.fetch = mockFetch;

// ─── Factories ────────────────────────────────────────────────────────────────

const makeSpotifyResponse = (tracks: any[] = []) => ({
  ok: true,
  status: 200,
  json: async () => ({
    tracks: {
      items: tracks.length > 0 ? tracks : [
        {
          id: 'sp-1',
          name: 'Bohemian Rhapsody',
          artists: [{ name: 'Queen' }],
          album: { name: 'A Night at the Opera', images: [{ url: 'https://img.example.com/cover.jpg' }] },
          duration_ms: 354000,
          preview_url: 'https://preview.example.com/1.mp3',
        },
      ],
    },
  }),
});

const makeYouTubeResponse = (items: any[] = []) => ({
  ok: true,
  status: 200,
  json: async () => ({
    items: items.length > 0 ? items : [
      {
        id: { videoId: 'yt-abc' },
        snippet: {
          title: 'Bohemian Rhapsody (Official Video)',
          channelTitle: 'Queen Official',
          thumbnails: { high: { url: 'https://img.youtube.com/vi/yt-abc/hqdefault.jpg' } },
        },
      },
    ],
  }),
});

const makeSpotifyTokenResponse = () => ({
  ok: true,
  json: async () => ({ access_token: 'mock-token-123', expires_in: 3600 }),
});

// ─── Suite ────────────────────────────────────────────────────────────────────

describe('MusicService', () => {
  let service: MusicService;

  beforeEach(() => {
    service = new MusicService();
    mockFetch.mockReset();
  });

  // ──────────────────────────────────────────────────────────────────────────
  // search
  // ──────────────────────────────────────────────────────────────────────────

  describe('search', () => {
    it('retorna array vazio para query vazia', async () => {
      expect(await service.search('')).toEqual([]);
      expect(await service.search('  ')).toEqual([]);
    });

    it('busca no Spotify e retorna resultados mapeados', async () => {
      mockFetch
        .mockResolvedValueOnce(makeSpotifyTokenResponse())
        .mockResolvedValueOnce(makeSpotifyResponse());

      const results = await service.searchSpotify('Bohemian Rhapsody');

      expect(results).toHaveLength(1);
      expect(results[0]).toMatchObject({
        title: 'Bohemian Rhapsody',
        artist: 'Queen',
        source: 'spotify',
        sourceId: 'sp-1',
      });
      expect(results[0].id).toBe('spotify-sp-1');
    });

    it('busca no YouTube e retorna resultados mapeados', async () => {
      mockFetch.mockResolvedValueOnce(makeYouTubeResponse());

      const results = await service.searchYouTube('Bohemian Rhapsody');

      expect(results).toHaveLength(1);
      expect(results[0]).toMatchObject({
        artist: 'Queen Official',
        source: 'youtube',
        sourceId: 'yt-abc',
      });
      expect(results[0].id).toBe('youtube-yt-abc');
    });

    it('combina resultados de ambas as APIs quando source="all"', async () => {
      mockFetch
        .mockResolvedValueOnce(makeSpotifyTokenResponse())
        .mockResolvedValueOnce(makeSpotifyResponse())
        .mockResolvedValueOnce(makeYouTubeResponse());

      const results = await service.search('Bohemian Rhapsody', 'all');
      expect(results.length).toBeGreaterThanOrEqual(2);
      const sources = results.map(r => r.source);
      expect(sources).toContain('spotify');
      expect(sources).toContain('youtube');
    });

    it('busca apenas Spotify quando source="spotify"', async () => {
      mockFetch
        .mockResolvedValueOnce(makeSpotifyTokenResponse())
        .mockResolvedValueOnce(makeSpotifyResponse());

      const results = await service.search('teste', 'spotify');
      expect(results.every(r => r.source === 'spotify')).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(2); // token + search
    });

    it('retorna resultados parciais se uma API falhar', async () => {
      mockFetch
        .mockResolvedValueOnce(makeSpotifyTokenResponse())
        .mockResolvedValueOnce(makeSpotifyResponse())
        .mockRejectedValueOnce(new Error('YouTube offline')); // YouTube falha

      const results = await service.search('Bohemian Rhapsody', 'all');
      expect(results.length).toBeGreaterThan(0);
      expect(results.every(r => r.source === 'spotify')).toBe(true);
    });

    it('lança ExternalAPIError quando ambas as APIs falham', async () => {
      mockFetch
        .mockRejectedValue(new Error('Network error'));

      await expect(service.search('teste', 'all')).rejects.toThrow(ExternalAPIError);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Spotify token cache
  // ──────────────────────────────────────────────────────────────────────────

  describe('Spotify token cache', () => {
    it('reutiliza token Spotify em cache', async () => {
      mockFetch
        .mockResolvedValueOnce(makeSpotifyTokenResponse()) // token
        .mockResolvedValueOnce(makeSpotifyResponse())      // busca 1
        .mockResolvedValueOnce(makeSpotifyResponse());     // busca 2

      await service.searchSpotify('Queen');
      await service.searchSpotify('Beatles'); // deve reusar token

      // Token foi buscado apenas 1 vez
      const tokenCalls = mockFetch.mock.calls.filter(c =>
        String(c[0]).includes('api/token')
      );
      expect(tokenCalls).toHaveLength(1);
    });

    it('renova token após invalidação', async () => {
      mockFetch
        .mockResolvedValueOnce(makeSpotifyTokenResponse())
        .mockResolvedValueOnce(makeSpotifyResponse())
        .mockResolvedValueOnce(makeSpotifyTokenResponse()) // renova
        .mockResolvedValueOnce(makeSpotifyResponse());

      await service.searchSpotify('Queen');
      service.invalidateSpotifyToken();
      await service.searchSpotify('Beatles');

      const tokenCalls = mockFetch.mock.calls.filter(c =>
        String(c[0]).includes('api/token')
      );
      expect(tokenCalls).toHaveLength(2);
    });

    it('lança erro se credenciais Spotify não configuradas', async () => {
      const id = process.env.SPOTIFY_CLIENT_ID;
      const secret = process.env.SPOTIFY_CLIENT_SECRET;
      delete process.env.SPOTIFY_CLIENT_ID;
      delete process.env.SPOTIFY_CLIENT_SECRET;

      try {
        await service.searchSpotify('teste');
        expect.fail();
      } catch (e) {
        expect(e).toBeInstanceOf(ExternalAPIError);
        expect((e as ExternalAPIError).service).toBe('Spotify');
      } finally {
        process.env.SPOTIFY_CLIENT_ID = id;
        process.env.SPOTIFY_CLIENT_SECRET = secret;
      }
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Tratamento de erros de API
  // ──────────────────────────────────────────────────────────────────────────

  describe('tratamento de erros HTTP', () => {
    it('lança erro de autenticação para Spotify 401', async () => {
      mockFetch
        .mockResolvedValueOnce(makeSpotifyTokenResponse())
        .mockResolvedValueOnce({ ok: false, status: 401, statusText: 'Unauthorized' });

      await expect(service.searchSpotify('teste')).rejects.toThrow('Token inválido');
    });

    it('lança erro de rate limit para Spotify 429', async () => {
      mockFetch
        .mockResolvedValueOnce(makeSpotifyTokenResponse())
        .mockResolvedValueOnce({ ok: false, status: 429, statusText: 'Too Many Requests' });

      await expect(service.searchSpotify('teste')).rejects.toThrow('Limite de requisições');
    });

    it('lança erro de cota para YouTube 403 quotaExceeded', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: async () => ({
          error: { errors: [{ reason: 'quotaExceeded' }] },
        }),
      });

      await expect(service.searchYouTube('teste')).rejects.toThrow('Cota diária');
    });

    it('lança erro se YOUTUBE_API_KEY não configurada', async () => {
      const key = process.env.YOUTUBE_API_KEY;
      delete process.env.YOUTUBE_API_KEY;

      try {
        await service.searchYouTube('teste');
        expect.fail();
      } catch (e) {
        expect(e).toBeInstanceOf(ExternalAPIError);
      } finally {
        process.env.YOUTUBE_API_KEY = key;
      }
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // saveToHistory
  // ──────────────────────────────────────────────────────────────────────────

  describe('saveToHistory', () => {
    it('faz upsert da track e cria entrada no histórico', async () => {
      const track = {
        title: 'Bohemian Rhapsody', artist: 'Queen',
        album: 'A Night at the Opera', duration: 354,
        coverUrl: null, previewUrl: null,
        source: 'spotify' as const, sourceId: 'sp-1',
      };

      vi.mocked(prisma.track.upsert).mockResolvedValue({ id: 'track-db-1', ...track } as any);
      vi.mocked(prisma.playHistory.create).mockResolvedValue({} as any);

      await service.saveToHistory('user-1', track, 'web');

      expect(prisma.track.upsert).toHaveBeenCalledOnce();
      expect(prisma.playHistory.create).toHaveBeenCalledOnce();
    });
  });
});
