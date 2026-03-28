import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuraBotApiClient } from '../src/utils/apiClient';
import { buildTrackEmbed, buildErrorEmbed, buildVolumeEmbed, buildQueueEmbed } from '../src/utils/embeds';

// ─── Mock axios ───────────────────────────────────────────────────────────────
vi.mock('axios', async () => {
  const actual = await vi.importActual<typeof import('axios')>('axios');
  return {
    ...actual,
    default: {
      create: vi.fn(() => ({
        post: vi.fn(),
        get: vi.fn(),
        interceptors: {
          response: { use: vi.fn() },
          request:  { use: vi.fn() },
        },
      })),
    },
  };
});

// ─── Factories ────────────────────────────────────────────────────────────────

const makeTrackResult = (overrides = {}) => ({
  action: 'playing' as const,
  message: '▶️ Reproduzindo: Bohemian Rhapsody — Queen',
  track: {
    queueId: 'qi-1',
    position: 1,
    track: {
      title: 'Bohemian Rhapsody',
      artist: 'Queen',
      album: 'A Night at the Opera',
      duration: 354,
      coverUrl: 'https://example.com/cover.jpg',
      spotifyId: 'abc123',
      youtubeId: null,
    },
    source: 'spotify',
    addedAt: new Date().toISOString(),
  },
  ...overrides,
});

const makeQueueState = () => ({
  current: {
    queueId: 'qi-1', position: 1, source: 'spotify',
    track: { title: 'Bohemian Rhapsody', artist: 'Queen', album: null, duration: 354, coverUrl: null, spotifyId: null, youtubeId: null },
    addedAt: new Date().toISOString(),
  },
  queue: [
    {
      queueId: 'qi-2', position: 2, source: 'youtube',
      track: { title: 'Hotel California', artist: 'Eagles', duration: 391, coverUrl: null, spotifyId: null, youtubeId: 'yt-abc' },
      addedAt: new Date().toISOString(),
    },
  ],
  isPlaying: true,
  volume: 80,
});

// ─── AuraBotApiClient ─────────────────────────────────────────────────────────

describe('AuraBotApiClient', () => {
  it('instancia sem erros', () => {
    expect(() => new AuraBotApiClient('http://localhost:3001/api', 'token')).not.toThrow();
  });
});

// ─── Embeds ───────────────────────────────────────────────────────────────────

describe('buildTrackEmbed', () => {
  it('constrói embed para música tocando', () => {
    const embed = buildTrackEmbed(makeTrackResult(), 'testuser');
    const data = embed.toJSON();

    expect(data.title).toContain('Reproduzindo agora');
    expect(data.description).toContain('Bohemian Rhapsody');
    expect(data.description).toContain('Queen');
    expect(data.thumbnail?.url).toBe('https://example.com/cover.jpg');
  });

  it('constrói embed para música adicionada à fila', () => {
    const embed = buildTrackEmbed(makeTrackResult({ action: 'queued', queuePosition: 3 }), 'testuser');
    const data = embed.toJSON();

    expect(data.title).toContain('#3');
    expect(data.title).toContain('fila');
  });

  it('mostra duração formatada nos fields', () => {
    const embed = buildTrackEmbed(makeTrackResult(), 'testuser');
    const data = embed.toJSON();
    const durationField = data.fields?.find(f => f.name === 'Duração');
    expect(durationField?.value).toContain('5:54');
  });

  it('inclui nome do usuário no footer', () => {
    const embed = buildTrackEmbed(makeTrackResult(), 'meu_usuario');
    expect(embed.toJSON().footer?.text).toContain('meu_usuario');
  });

  it('não quebra sem coverUrl', () => {
    const result = makeTrackResult();
    result.track.track.coverUrl = null;
    expect(() => buildTrackEmbed(result, 'user')).not.toThrow();
    expect(buildTrackEmbed(result, 'user').toJSON().thumbnail).toBeUndefined();
  });
});

describe('buildErrorEmbed', () => {
  it('constrói embed de erro com a mensagem', () => {
    const embed = buildErrorEmbed('Música não encontrada');
    const data = embed.toJSON();
    expect(data.title).toBe('❌ Erro');
    expect(data.description).toBe('Música não encontrada');
  });
});

describe('buildVolumeEmbed', () => {
  it('constrói embed de volume com barra visual', () => {
    const embed = buildVolumeEmbed({ message: '🔊 Volume: 80%', volume: 80 });
    const data = embed.toJSON();
    expect(data.description).toContain('80%');
    expect(data.description).toContain('█');
  });

  it('mostra "mudo" quando volume é 0', () => {
    const embed = buildVolumeEmbed({ message: '🔉 Volume: (mudo)', volume: 0 });
    const data = embed.toJSON();
    expect(data.description).toContain('0%');
    // 10 blocos de ░ quando volume=0
    expect(data.description).toContain('░░░░░░░░░░');
  });

  it('mostra barra cheia quando volume é 100%', () => {
    const embed = buildVolumeEmbed({ message: '🔊 Volume: 100%', volume: 100 });
    const data = embed.toJSON();
    expect(data.description).toContain('100%');
    expect(data.description).toContain('██████████');
  });
});

describe('buildQueueEmbed', () => {
  it('constrói embed de fila com músicas', () => {
    const embed = buildQueueEmbed(makeQueueState());
    const data = embed.toJSON();

    expect(data.title).toContain('Fila');
    const nowField = data.fields?.find(f => f.name.includes('Tocando agora'));
    expect(nowField).toBeDefined();
    expect(nowField?.value).toContain('Bohemian Rhapsody');
  });

  it('mostra "Nenhuma música" quando fila está vazia', () => {
    const embed = buildQueueEmbed({ current: null, queue: [], volume: 80 });
    expect(embed.toJSON().description).toContain('Nenhuma música');
  });

  it('mostra contagem correta da fila', () => {
    const embed = buildQueueEmbed(makeQueueState());
    const queueField = embed.toJSON().fields?.find(f => f.name.includes('Na fila'));
    expect(queueField?.name).toContain('1');
  });

  it('inclui volume no footer', () => {
    const embed = buildQueueEmbed(makeQueueState());
    expect(embed.toJSON().footer?.text).toContain('80%');
  });

  it('limita exibição a 10 músicas na fila', () => {
    const manyQueue = Array.from({ length: 15 }, (_, i) => ({
      queueId: `qi-${i}`, position: i + 2, source: 'spotify',
      track: { title: `Música ${i}`, artist: 'Artista', duration: 200, coverUrl: null, spotifyId: null, youtubeId: null },
      addedAt: new Date().toISOString(),
    }));

    const embed = buildQueueEmbed({ ...makeQueueState(), queue: manyQueue });
    const queueField = embed.toJSON().fields?.find(f => f.name.includes('Na fila'));
    expect(queueField?.value).toContain('mais 5');
  });
});
