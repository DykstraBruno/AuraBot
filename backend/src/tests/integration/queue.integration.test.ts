/**
 * Testes de integração para /api/music (queue + search)
 *
 * Usa mocks do Prisma e musicService via setup.ts.
 * Gera um JWT válido para autenticar as requisições.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../../app';
import { prisma } from '../../config/database';
import { musicService } from '../../music/music.service';
import { generateTokenPair } from '../../utils/jwt';

// ─── Mock do musicService ─────────────────────────────────────────────────────
vi.mock('../../music/music.service', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../music/music.service')>();
  return {
    ...actual,
    musicService: {
      search:      vi.fn(),
      getHistory:  vi.fn(),
      saveToHistory: vi.fn(),
    },
  };
});

// ─── Helper: gera token JWT válido ────────────────────────────────────────────

function makeAuthToken(userId = 'user-1') {
  const { accessToken } = generateTokenPair({
    userId,
    email:     'user@example.com',
    username:  'testuser',
    sessionId: 'sess-1',
  });
  return `Bearer ${accessToken}`;
}

// ─── Factories ────────────────────────────────────────────────────────────────

const makeSearchResult = (overrides = {}) => ({
  id:        'spotify-abc',
  title:     'Bohemian Rhapsody',
  artist:    'Queen',
  album:     'A Night at the Opera',
  duration:  354,
  coverUrl:  'https://example.com/cover.jpg',
  source:    'spotify' as const,
  sourceId:  'abc123',
  ...overrides,
});

const makeTrack = (overrides = {}) => ({
  id:        'track-1',
  title:     'Bohemian Rhapsody',
  artist:    'Queen',
  album:     'A Night at the Opera',
  duration:  354,
  coverUrl:  null,
  previewUrl: null,
  spotifyId: 'abc123',
  youtubeId: null,
  createdAt: new Date(),
  ...overrides,
});

const makeQueueItem = (overrides = {}) => ({
  id:       'qi-1',
  userId:   'user-1',
  trackId:  'track-1',
  position: 1,
  source:   'spotify',
  addedAt:  new Date(),
  playedAt: null,
  track:    makeTrack(),
  ...overrides,
});

const makePrefs = (overrides = {}) => ({
  id:               'prefs-1',
  userId:           'user-1',
  preferredSource:  'spotify',
  audioQuality:     'high',
  language:         'pt-BR',
  voiceEnabled:     true,
  volume:           80,
  discordGuildId:   null,
  discordChannelId: null,
  ...overrides,
});

// ─── POST /api/music/play ─────────────────────────────────────────────────────

describe('POST /api/music/play', () => {
  it('200 — reproduz música encontrada', async () => {
    vi.mocked(musicService.search).mockResolvedValue([makeSearchResult()]);
    vi.mocked(prisma.track.upsert).mockResolvedValue(makeTrack());
    vi.mocked(prisma.queueItem.count).mockResolvedValue(0);
    vi.mocked(prisma.queueItem.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.queueItem.create).mockResolvedValue(makeQueueItem());

    const res = await request(app)
      .post('/api/music/play')
      .set('Authorization', makeAuthToken())
      .send({ query: 'Bohemian Rhapsody', source: 'spotify' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.action).toBe('playing');
    expect(res.body.data.track).toBeDefined();
  });

  it('404 — música não encontrada retorna erro amigável', async () => {
    vi.mocked(musicService.search).mockResolvedValue([]);

    const res = await request(app)
      .post('/api/music/play')
      .set('Authorization', makeAuthToken())
      .send({ query: 'xyzinexistente123' });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('TRACK_NOT_FOUND');
  });

  it('400 — query vazia retorna erro de validação', async () => {
    const res = await request(app)
      .post('/api/music/play')
      .set('Authorization', makeAuthToken())
      .send({ query: '' });

    expect(res.status).toBe(400);
  });

  it('401 — sem token retorna não autorizado', async () => {
    const res = await request(app)
      .post('/api/music/play')
      .send({ query: 'Bohemian Rhapsody' });

    expect(res.status).toBe(401);
  });

  it('200 — adiciona à fila quando já há música tocando', async () => {
    vi.mocked(musicService.search).mockResolvedValue([makeSearchResult()]);
    vi.mocked(prisma.track.upsert).mockResolvedValue(makeTrack());
    vi.mocked(prisma.queueItem.count).mockResolvedValue(1);
    vi.mocked(prisma.queueItem.findFirst).mockResolvedValue(makeQueueItem({ position: 1 }));
    vi.mocked(prisma.queueItem.create).mockResolvedValue(makeQueueItem({ position: 2 }));

    const res = await request(app)
      .post('/api/music/play')
      .set('Authorization', makeAuthToken())
      .send({ query: 'Hotel California' });

    expect(res.status).toBe(200);
    expect(res.body.data.action).toBe('queued');
  });

  it('400 — fila cheia (50 itens) retorna QUEUE_FULL', async () => {
    vi.mocked(musicService.search).mockResolvedValue([makeSearchResult()]);
    vi.mocked(prisma.track.upsert).mockResolvedValue(makeTrack());
    vi.mocked(prisma.queueItem.count).mockResolvedValue(50);

    const res = await request(app)
      .post('/api/music/play')
      .set('Authorization', makeAuthToken())
      .send({ query: 'alguma musica' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('QUEUE_FULL');
  });
});

// ─── POST /api/music/stop ─────────────────────────────────────────────────────

describe('POST /api/music/stop', () => {
  it('200 — para reprodução e retorna contagem', async () => {
    vi.mocked(prisma.queueItem.updateMany).mockResolvedValue({ count: 2 });

    const res = await request(app)
      .post('/api/music/stop')
      .set('Authorization', makeAuthToken());

    expect(res.status).toBe(200);
    expect(res.body.data.message).toContain('⏹');
  });

  it('200 — retorna mensagem quando nada está tocando', async () => {
    vi.mocked(prisma.queueItem.updateMany).mockResolvedValue({ count: 0 });

    const res = await request(app)
      .post('/api/music/stop')
      .set('Authorization', makeAuthToken());

    expect(res.status).toBe(200);
    expect(res.body.data.message).toContain('Nenhuma');
  });

  it('401 — sem token retorna não autorizado', async () => {
    const res = await request(app).post('/api/music/stop');
    expect(res.status).toBe(401);
  });
});

// ─── POST /api/music/next ─────────────────────────────────────────────────────

describe('POST /api/music/next', () => {
  it('200 — avança para próxima música', async () => {
    vi.mocked(prisma.queueItem.findFirst)
      .mockResolvedValueOnce(makeQueueItem({ id: 'qi-1' }))
      .mockResolvedValueOnce(makeQueueItem({ id: 'qi-2', track: makeTrack({ title: 'Hotel California' }) }));
    vi.mocked(prisma.queueItem.update).mockResolvedValue(makeQueueItem());

    const res = await request(app)
      .post('/api/music/next')
      .set('Authorization', makeAuthToken());

    expect(res.status).toBe(200);
    expect(res.body.data.action).toBe('playing');
  });

  it('200 — retorna mensagem de fila vazia', async () => {
    vi.mocked(prisma.queueItem.findFirst).mockResolvedValue(null);

    const res = await request(app)
      .post('/api/music/next')
      .set('Authorization', makeAuthToken());

    expect(res.status).toBe(200);
    expect(res.body.data.message).toContain('vazia');
  });
});

// ─── POST /api/music/volume ───────────────────────────────────────────────────

describe('POST /api/music/volume', () => {
  it('200 — aumenta volume (direction=up)', async () => {
    vi.mocked(prisma.userPreferences.findUnique).mockResolvedValue(makePrefs({ volume: 70 }));
    vi.mocked(prisma.userPreferences.update).mockResolvedValue(makePrefs({ volume: 80 }));

    const res = await request(app)
      .post('/api/music/volume')
      .set('Authorization', makeAuthToken())
      .send({ direction: 'up' });

    expect(res.status).toBe(200);
    expect(res.body.data.volume).toBe(80);
  });

  it('200 — diminui volume (direction=down)', async () => {
    vi.mocked(prisma.userPreferences.findUnique).mockResolvedValue(makePrefs({ volume: 70 }));
    vi.mocked(prisma.userPreferences.update).mockResolvedValue(makePrefs({ volume: 60 }));

    const res = await request(app)
      .post('/api/music/volume')
      .set('Authorization', makeAuthToken())
      .send({ direction: 'down' });

    expect(res.status).toBe(200);
    expect(res.body.data.volume).toBe(60);
  });

  it('400 — direction inválido', async () => {
    const res = await request(app)
      .post('/api/music/volume')
      .set('Authorization', makeAuthToken())
      .send({ direction: 'sideways' });

    expect(res.status).toBe(400);
  });
});

// ─── GET /api/music/queue ─────────────────────────────────────────────────────

describe('GET /api/music/queue', () => {
  it('200 — retorna estado atual da fila', async () => {
    vi.mocked(prisma.queueItem.findMany).mockResolvedValue([makeQueueItem()]);
    vi.mocked(prisma.userPreferences.findUnique).mockResolvedValue(makePrefs());

    const res = await request(app)
      .get('/api/music/queue')
      .set('Authorization', makeAuthToken());

    expect(res.status).toBe(200);
    expect(res.body.data.current).toBeDefined();
    expect(res.body.data.volume).toBe(80);
  });

  it('200 — fila vazia quando não há itens', async () => {
    vi.mocked(prisma.queueItem.findMany).mockResolvedValue([]);
    vi.mocked(prisma.userPreferences.findUnique).mockResolvedValue(makePrefs());

    const res = await request(app)
      .get('/api/music/queue')
      .set('Authorization', makeAuthToken());

    expect(res.status).toBe(200);
    expect(res.body.data.current).toBeNull();
    expect(res.body.data.queue).toHaveLength(0);
  });
});

// ─── GET /api/music/search ────────────────────────────────────────────────────

describe('GET /api/music/search', () => {
  it('200 — retorna resultados de busca', async () => {
    vi.mocked(musicService.search).mockResolvedValue([makeSearchResult()]);

    const res = await request(app)
      .get('/api/music/search?q=Bohemian')
      .set('Authorization', makeAuthToken());

    expect(res.status).toBe(200);
    expect(res.body.data.results).toHaveLength(1);
    expect(res.body.data.total).toBe(1);
  });

  it('400 — sem parâmetro q', async () => {
    const res = await request(app)
      .get('/api/music/search')
      .set('Authorization', makeAuthToken());

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('MISSING_QUERY');
  });

  it('401 — sem token', async () => {
    const res = await request(app).get('/api/music/search?q=test');
    expect(res.status).toBe(401);
  });
});
