import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueueService } from '../../../queue/queue.service';
import { prisma } from '../../../config/database';
import { musicService } from '../../../music/music.service';
import { AppError, NotFoundError } from '../../../utils/errors';

// ─── Mock do MusicService ─────────────────────────────────────────────────────
vi.mock('../../../music/music.service', () => ({
  musicService: {
    search: vi.fn(),
  },
}));

// ─── Factories ────────────────────────────────────────────────────────────────

const makeSearchResult = (overrides = {}) => ({
  id: 'spotify-abc123',
  title: 'Bohemian Rhapsody',
  artist: 'Queen',
  album: 'A Night at the Opera',
  duration: 354,
  coverUrl: 'https://example.com/cover.jpg',
  source: 'spotify' as const,
  sourceId: 'abc123',
  ...overrides,
});

const makeTrack = (overrides = {}) => ({
  id: 'track-db-1',
  title: 'Bohemian Rhapsody',
  artist: 'Queen',
  album: 'A Night at the Opera',
  duration: 354,
  coverUrl: null,
  previewUrl: null,
  spotifyId: 'abc123',
  youtubeId: null,
  createdAt: new Date(),
  ...overrides,
});

const makeQueueItem = (overrides = {}) => ({
  id: 'qi-1',
  userId: 'user-1',
  trackId: 'track-db-1',
  position: 1,
  source: 'spotify',
  addedAt: new Date(),
  playedAt: null,
  track: makeTrack(),
  ...overrides,
});

const makePrefs = (overrides = {}) => ({
  id: 'prefs-1',
  userId: 'user-1',
  preferredSource: 'spotify',
  audioQuality: 'high',
  language: 'pt-BR',
  voiceEnabled: true,
  volume: 80,
  discordGuildId: null,
  discordChannelId: null,
  ...overrides,
});

// ─── Suite ────────────────────────────────────────────────────────────────────

describe('QueueService', () => {
  let service: QueueService;
  const userId = 'user-1';

  beforeEach(() => {
    service = new QueueService();
  });

  // ──────────────────────────────────────────────────────────────────────────
  // play
  // ──────────────────────────────────────────────────────────────────────────

  describe('play', () => {
    it('reproduz imediatamente quando fila está vazia', async () => {
      vi.mocked(musicService.search).mockResolvedValue([makeSearchResult()]);
      vi.mocked(prisma.track.upsert).mockResolvedValue(makeTrack());
      vi.mocked(prisma.queueItem.count).mockResolvedValue(0);
      vi.mocked(prisma.queueItem.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.queueItem.create).mockResolvedValue(makeQueueItem());

      const result = await service.play(userId, 'Bohemian Rhapsody');

      expect(result.action).toBe('playing');
      expect(result.message).toContain('▶️ Reproduzindo');
      expect(result.message).toContain('Bohemian Rhapsody');
    });

    it('adiciona à fila quando já existe música tocando', async () => {
      vi.mocked(musicService.search).mockResolvedValue([makeSearchResult()]);
      vi.mocked(prisma.track.upsert).mockResolvedValue(makeTrack());
      vi.mocked(prisma.queueItem.count).mockResolvedValue(1); // já há 1 na fila
      vi.mocked(prisma.queueItem.findFirst).mockResolvedValue(makeQueueItem({ position: 1 }));
      vi.mocked(prisma.queueItem.create).mockResolvedValue(makeQueueItem({ position: 2 }));

      const result = await service.play(userId, 'Hotel California');

      expect(result.action).toBe('queued');
      expect(result.message).toContain('fila');
    });

    it('lança erro para query vazia', async () => {
      await expect(service.play(userId, '')).rejects.toThrow(AppError);
      await expect(service.play(userId, '   ')).rejects.toThrow(AppError);
    });

    it('lança erro com mensagem amigável quando música não encontrada', async () => {
      vi.mocked(musicService.search).mockResolvedValue([]);

      try {
        await service.play(userId, 'xyzmusica123inexistente');
        expect.fail();
      } catch (e) {
        expect(e).toBeInstanceOf(AppError);
        expect((e as AppError).message).toContain('Nenhuma música encontrada');
        expect((e as AppError).message).toContain('xyzmusica123inexistente');
        expect((e as AppError).code).toBe('TRACK_NOT_FOUND');
      }
    });

    it('lança erro quando fila está cheia (50 itens)', async () => {
      vi.mocked(musicService.search).mockResolvedValue([makeSearchResult()]);
      vi.mocked(prisma.track.upsert).mockResolvedValue(makeTrack());
      vi.mocked(prisma.queueItem.count).mockResolvedValue(50);

      await expect(service.play(userId, 'alguma musica')).rejects.toThrow('fila está cheia');
    });

    it('usa a primeira música dos resultados de busca', async () => {
      const first = makeSearchResult({ title: 'Primeira Música' });
      const second = makeSearchResult({ title: 'Segunda Música', sourceId: 'xyz' });

      vi.mocked(musicService.search).mockResolvedValue([first, second]);
      vi.mocked(prisma.track.upsert).mockResolvedValue(makeTrack({ title: 'Primeira Música' }));
      vi.mocked(prisma.queueItem.count).mockResolvedValue(0);
      vi.mocked(prisma.queueItem.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.queueItem.create).mockResolvedValue(
        makeQueueItem({ track: makeTrack({ title: 'Primeira Música' }) })
      );

      const result = await service.play(userId, 'query');
      expect(result.message).toContain('Primeira Música');
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // stop
  // ──────────────────────────────────────────────────────────────────────────

  describe('stop', () => {
    it('para a reprodução e limpa a fila', async () => {
      vi.mocked(prisma.queueItem.updateMany).mockResolvedValue({ count: 3 });

      const result = await service.stop(userId);

      expect(result.message).toContain('⏹');
      expect(result.message).toContain('3');
      expect(prisma.queueItem.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId, playedAt: null },
          data: { playedAt: expect.any(Date) },
        })
      );
    });

    it('retorna mensagem quando nada está tocando', async () => {
      vi.mocked(prisma.queueItem.updateMany).mockResolvedValue({ count: 0 });

      const result = await service.stop(userId);
      expect(result.message).toContain('Nenhuma música em reprodução');
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // next
  // ──────────────────────────────────────────────────────────────────────────

  describe('next', () => {
    it('avança para a próxima música', async () => {
      const currentItem = makeQueueItem({ id: 'qi-1', position: 1 });
      const nextItem = makeQueueItem({ id: 'qi-2', position: 2, track: makeTrack({ title: 'Hotel California' }) });

      vi.mocked(prisma.queueItem.findFirst)
        .mockResolvedValueOnce(currentItem)  // busca current
        .mockResolvedValueOnce(nextItem);    // busca next

      vi.mocked(prisma.queueItem.update).mockResolvedValue(currentItem);

      const result = await service.next(userId) as any;

      expect(result.action).toBe('playing');
      expect(result.message).toContain('⏭');
      expect(result.track.track.title).toBe('Hotel California');
    });

    it('retorna mensagem quando fila está vazia', async () => {
      vi.mocked(prisma.queueItem.findFirst).mockResolvedValue(null);

      const result = await service.next(userId) as any;
      expect(result.message).toContain('fila está vazia');
    });

    it('retorna mensagem de conclusão quando era a última música', async () => {
      vi.mocked(prisma.queueItem.findFirst)
        .mockResolvedValueOnce(makeQueueItem())  // current existe
        .mockResolvedValueOnce(null);            // próxima não existe

      vi.mocked(prisma.queueItem.update).mockResolvedValue(makeQueueItem());

      const result = await service.next(userId) as any;
      expect(result.message).toContain('Fila concluída');
    });

    it('marca item atual como tocado antes de avançar', async () => {
      const current = makeQueueItem({ id: 'qi-1' });

      vi.mocked(prisma.queueItem.findFirst)
        .mockResolvedValueOnce(current)
        .mockResolvedValueOnce(null);

      vi.mocked(prisma.queueItem.update).mockResolvedValue(current);

      await service.next(userId);

      expect(prisma.queueItem.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'qi-1' },
          data: { playedAt: expect.any(Date) },
        })
      );
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // volume
  // ──────────────────────────────────────────────────────────────────────────

  describe('turnUp / turnDown', () => {
    it('aumenta o volume em 10%', async () => {
      vi.mocked(prisma.userPreferences.findUnique).mockResolvedValue(makePrefs({ volume: 70 }));
      vi.mocked(prisma.userPreferences.update).mockResolvedValue(makePrefs({ volume: 80 }));

      const result = await service.turnUp(userId);

      expect(result.volume).toBe(80);
      expect(result.message).toContain('🔊');
      expect(result.message).toContain('80%');
    });

    it('diminui o volume em 10%', async () => {
      vi.mocked(prisma.userPreferences.findUnique).mockResolvedValue(makePrefs({ volume: 70 }));
      vi.mocked(prisma.userPreferences.update).mockResolvedValue(makePrefs({ volume: 60 }));

      const result = await service.turnDown(userId);

      expect(result.volume).toBe(60);
      expect(result.message).toContain('🔉');
    });

    it('não passa de 100% no turnUp', async () => {
      vi.mocked(prisma.userPreferences.findUnique).mockResolvedValue(makePrefs({ volume: 100 }));
      vi.mocked(prisma.userPreferences.update).mockResolvedValue(makePrefs({ volume: 100 }));

      const result = await service.turnUp(userId);
      expect(result.volume).toBe(100);
    });

    it('não passa de 0% no turnDown', async () => {
      vi.mocked(prisma.userPreferences.findUnique).mockResolvedValue(makePrefs({ volume: 5 }));
      vi.mocked(prisma.userPreferences.update).mockResolvedValue(makePrefs({ volume: 0 }));

      const result = await service.turnDown(userId);
      expect(result.volume).toBe(0);
      expect(result.message).toContain('mudo');
    });

    it('lança NotFoundError se preferências não existirem', async () => {
      vi.mocked(prisma.userPreferences.findUnique).mockResolvedValue(null);

      await expect(service.turnUp(userId)).rejects.toThrow(NotFoundError);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // dispatch
  // ──────────────────────────────────────────────────────────────────────────

  describe('dispatch', () => {
    it('despacha comando "play" corretamente', async () => {
      const spy = vi.spyOn(service, 'play').mockResolvedValue({
        action: 'playing',
        track: makeQueueItem() as any,
        message: '▶️ Reproduzindo',
      });

      await service.dispatch(userId, 'play', { query: 'Bohemian Rhapsody' });
      expect(spy).toHaveBeenCalledWith(userId, 'Bohemian Rhapsody', undefined);
    });

    it('lança erro para "play" sem query', async () => {
      await expect(service.dispatch(userId, 'play', {})).rejects.toThrow('Informe o nome');
    });

    it('despacha "stop" corretamente', async () => {
      const spy = vi.spyOn(service, 'stop').mockResolvedValue({ message: '⏹' });
      await service.dispatch(userId, 'stop');
      expect(spy).toHaveBeenCalledWith(userId);
    });

    it('despacha "next" corretamente', async () => {
      const spy = vi.spyOn(service, 'next').mockResolvedValue({ message: '⏭' });
      await service.dispatch(userId, 'next');
      expect(spy).toHaveBeenCalledWith(userId);
    });

    it('despacha "turnup" corretamente', async () => {
      const spy = vi.spyOn(service, 'turnUp').mockResolvedValue({ volume: 90, message: '🔊 90%' });
      await service.dispatch(userId, 'turnup');
      expect(spy).toHaveBeenCalledWith(userId);
    });

    it('lança erro para comando desconhecido', async () => {
      await expect(
        service.dispatch(userId, 'unknowncmd' as any)
      ).rejects.toThrow('Comando desconhecido');
    });
  });
});
