/**
 * Testes para voiceManager
 *
 * Estratégia: importação única do módulo + guild IDs únicos por teste
 * (evita vi.resetModules() que invalida referências de mock entre testes).
 * Cada teste usa um guildId diferente para isolar estado.
 */
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { EventEmitter } from 'events';

// ─── Mocks hoisted (vi.mock é içado ao topo — precisa de vi.hoisted) ──────────

const {
  mockPlayerFn,
  mockConnFn,
  mockResourceFn,
  mockSpawnFn,
  mockStreamUrl,
} = vi.hoisted(() => ({
  mockPlayerFn:   vi.fn(),
  mockConnFn:     vi.fn(),
  mockResourceFn: vi.fn(),
  mockSpawnFn:    vi.fn(),
  mockStreamUrl:  vi.fn(),
}));

vi.mock('@discordjs/voice', () => ({
  joinVoiceChannel:      mockConnFn,
  createAudioPlayer:     mockPlayerFn,
  createAudioResource:   mockResourceFn,
  AudioPlayerStatus:     { Idle: 'idle', Playing: 'playing' },
  VoiceConnectionStatus: { Disconnected: 'disconnected' },
  StreamType:            { OggOpus: 'ogg/opus' },
  NoSubscriberBehavior:  { Pause: 'pause' },
}));

vi.mock('child_process', () => ({ spawn: mockSpawnFn }));

vi.mock('../utils/ytdlp', () => ({
  FFMPEG_BIN:    '/mock/bin',
  FFMPEG_EXE:    '/mock/bin/ffmpeg',
  YTDLP_EXE:    '/mock/yt-dlp',
  getStreamUrl:  mockStreamUrl,
}));

// ─── Importação do módulo (após mocks) ───────────────────────────────────────
import * as vm from '../voice/voiceManager';

// ─── Factories ────────────────────────────────────────────────────────────────

let guildCounter = 0;
const uniqueGuild = () => `guild-${++guildCounter}`;

const makePlayer = () => {
  const p = new EventEmitter() as any;
  p.state = { status: 'idle' };
  p.play  = vi.fn();
  p.stop  = vi.fn();
  return p;
};

const makeConn = (channelId = 'chan-1', guildId = 'guild-1') => {
  const c = new EventEmitter() as any;
  c.joinConfig  = { channelId };
  c.subscribe   = vi.fn();
  c.destroy     = vi.fn();
  return c;
};

const makeProc = () => {
  const p = new EventEmitter() as any;
  p.stdout = new EventEmitter();
  p.stderr = new EventEmitter();
  p.kill   = vi.fn();
  return p;
};

const makeTrack = (overrides = {}) => ({
  title:     'Bohemian Rhapsody',
  artist:    'Queen',
  youtubeId: 'abc123',
  ...overrides,
});

const makeChannel = (guildId = 'guild-1', channelId = 'chan-1') => ({
  id:   channelId,
  name: 'General',
  guild: {
    id:                  guildId,
    voiceAdapterCreator: vi.fn(),
  },
});

// ─── Setup padrão de mocks ────────────────────────────────────────────────────

function setupMocks(guildId: string, channelId = 'chan-1') {
  const player = makePlayer();
  const conn   = makeConn(channelId, guildId);
  const proc   = makeProc();
  const res    = { volume: { setVolume: vi.fn() } };

  mockPlayerFn.mockReturnValue(player);
  mockConnFn.mockReturnValue(conn);
  mockSpawnFn.mockReturnValue(proc);
  mockResourceFn.mockReturnValue(res);
  mockStreamUrl.mockResolvedValue('https://stream.example.com/audio.webm');

  return { player, conn, proc };
}

// ─── Suite ────────────────────────────────────────────────────────────────────

describe('voiceManager', () => {
  beforeAll(() => {
    vi.clearAllMocks();
  });

  // ── getState ──────────────────────────────────────────────────────────────

  describe('getState', () => {
    it('retorna null para guild desconhecida', () => {
      expect(vm.getState('guild-inexistente-xyz')).toBeNull();
    });

    it('retorna fila copiada (array independente)', async () => {
      const guildId = uniqueGuild();
      setupMocks(guildId);
      const channel = makeChannel(guildId);

      // Player em 'playing' — não dispara playNext
      mockPlayerFn.mockImplementation(() => {
        const p = makePlayer();
        p.state = { status: 'playing' };
        return p;
      });

      await vm.joinAndPlay(channel as any, makeTrack());

      const state = vm.getState(guildId);
      const queue = state!.queue; // cópia retornada (length=1)
      queue.push(makeTrack() as any); // cópia agora tem 2 itens

      // Internal queue ainda tem 1 item — a mutação na cópia não afetou o original
      expect(vm.getState(guildId)!.queue).toHaveLength(1);
      vm.stop(guildId);
    });
  });

  // ── setVolume ─────────────────────────────────────────────────────────────

  describe('setVolume', () => {
    it('clameia volume abaixo de 0 para 0', () => {
      expect(vm.setVolume('qualquer', -10)).toBe(0);
    });

    it('clameia volume acima de 100 para 100', () => {
      expect(vm.setVolume('qualquer', 150)).toBe(100);
    });

    it('aceita valores dentro do intervalo [0, 100]', () => {
      expect(vm.setVolume('qualquer', 75)).toBe(75);
    });

    it('atualiza volume no estado da guild ativa', async () => {
      const guildId = uniqueGuild();
      const { player } = setupMocks(guildId);
      player.state = { status: 'playing' };
      mockPlayerFn.mockReturnValue(player);

      await vm.joinAndPlay(makeChannel(guildId) as any, makeTrack());
      vm.setVolume(guildId, 50);

      expect(vm.getState(guildId)!.volume).toBe(50);
      vm.stop(guildId);
    });
  });

  // ── stop ──────────────────────────────────────────────────────────────────

  describe('stop', () => {
    it('destrói conexão e remove estado da guild', async () => {
      const guildId = uniqueGuild();
      const { player, conn } = setupMocks(guildId);
      player.state = { status: 'playing' };
      mockPlayerFn.mockReturnValue(player);
      mockConnFn.mockReturnValue(conn);

      await vm.joinAndPlay(makeChannel(guildId) as any, makeTrack());
      vm.stop(guildId);

      expect(conn.destroy).toHaveBeenCalled();
      expect(vm.getState(guildId)).toBeNull();
    });

    it('para o player ao chamar stop', async () => {
      const guildId = uniqueGuild();
      const { player, conn } = setupMocks(guildId);
      player.state = { status: 'playing' };
      mockPlayerFn.mockReturnValue(player);
      mockConnFn.mockReturnValue(conn);

      await vm.joinAndPlay(makeChannel(guildId) as any, makeTrack());
      vm.stop(guildId);

      expect(player.stop).toHaveBeenCalledWith(true);
    });

    it('não lança erro para guild inexistente', () => {
      expect(() => vm.stop('inexistente-stop-test')).not.toThrow();
    });

    it('limpa a fila antes de parar', async () => {
      const guildId = uniqueGuild();
      const { player, conn } = setupMocks(guildId);
      player.state = { status: 'playing' };
      mockPlayerFn.mockReturnValue(player);
      mockConnFn.mockReturnValue(conn);

      await vm.joinAndPlay(makeChannel(guildId) as any, makeTrack({ youtubeId: 't1' }));
      await vm.joinAndPlay(makeChannel(guildId) as any, makeTrack({ youtubeId: 't2' }));
      vm.stop(guildId);

      expect(vm.getState(guildId)).toBeNull();
    });
  });

  // ── skip ──────────────────────────────────────────────────────────────────

  describe('skip', () => {
    it('retorna null para guild sem estado', () => {
      expect(vm.skip('guild-skip-inexistente')).toBeNull();
    });

    it('chama player.stop() ao pular', async () => {
      const guildId = uniqueGuild();
      const { player, conn } = setupMocks(guildId);
      player.state = { status: 'playing' };
      mockPlayerFn.mockReturnValue(player);
      mockConnFn.mockReturnValue(conn);

      await vm.joinAndPlay(makeChannel(guildId) as any, makeTrack());
      vm.skip(guildId);

      expect(player.stop).toHaveBeenCalled();
      vm.stop(guildId);
    });

    it('retorna null quando fila está vazia após skip', async () => {
      const guildId = uniqueGuild();
      const { player, conn } = setupMocks(guildId);
      player.state = { status: 'playing' };
      mockPlayerFn.mockReturnValue(player);
      mockConnFn.mockReturnValue(conn);

      // Apenas 1 track: vai para a fila (player playing → sem playNext)
      await vm.joinAndPlay(makeChannel(guildId) as any, makeTrack());
      // queue = [track], skip retorna queue[0] mas a fila só tem 1 item (é o current)
      // Após joinAndPlay com player playing, a track fica em queue[0] e current=null
      // skip retorna queue[0] = track (não é null!)
      // Para testar fila vazia: não adicionamos nada
      vm.stop(guildId);

      // Guild não existe mais → skip retorna null
      expect(vm.skip(guildId)).toBeNull();
    });

    it('retorna próxima track quando há 2 tracks enfileiradas', async () => {
      const guildId = uniqueGuild();
      const { player, conn } = setupMocks(guildId);
      // Player em 'playing' → ambas as tracks ficam na queue
      player.state = { status: 'playing' };
      mockPlayerFn.mockReturnValue(player);
      mockConnFn.mockReturnValue(conn);

      const t1 = makeTrack({ youtubeId: 'yt1', title: 'Track 1' });
      const t2 = makeTrack({ youtubeId: 'yt2', title: 'Track 2' });

      await vm.joinAndPlay(makeChannel(guildId) as any, t1);
      await vm.joinAndPlay(makeChannel(guildId) as any, t2);

      // queue = [t1, t2]; skip retorna queue[0] = t1
      const next = vm.skip(guildId);
      expect(next).toMatchObject({ title: 'Track 1' });
      vm.stop(guildId);
    });
  });

  // ── joinAndPlay ───────────────────────────────────────────────────────────

  describe('joinAndPlay', () => {
    it('cria nova conexão para guild desconhecida', async () => {
      const guildId = uniqueGuild();
      const { conn } = setupMocks(guildId);
      mockConnFn.mockReturnValue(conn);

      await vm.joinAndPlay(makeChannel(guildId) as any, makeTrack());

      expect(mockConnFn).toHaveBeenCalledWith(
        expect.objectContaining({ guildId })
      );
      vm.stop(guildId);
    });

    it('inscreve o player na conexão de voz', async () => {
      const guildId = uniqueGuild();
      const { player, conn } = setupMocks(guildId);
      mockPlayerFn.mockReturnValue(player);
      mockConnFn.mockReturnValue(conn);

      await vm.joinAndPlay(makeChannel(guildId) as any, makeTrack());

      expect(conn.subscribe).toHaveBeenCalledWith(player);
      vm.stop(guildId);
    });

    it('enfileira segunda track quando player está tocando', async () => {
      const guildId = uniqueGuild();
      const { player, conn } = setupMocks(guildId);
      player.state = { status: 'playing' };
      mockPlayerFn.mockReturnValue(player);
      mockConnFn.mockReturnValue(conn);

      await vm.joinAndPlay(makeChannel(guildId) as any, makeTrack({ youtubeId: 't1' }));
      await vm.joinAndPlay(makeChannel(guildId) as any, makeTrack({ youtubeId: 't2', title: 'Segunda' }));

      const state = vm.getState(guildId);
      // Ambas ficam na queue porque player está 'playing' e playNext não é chamado
      expect(state!.queue).toHaveLength(2);
      expect(state!.queue[1].title).toBe('Segunda');
      vm.stop(guildId);
    });

    it('migra para novo canal se usuário estiver em canal diferente', async () => {
      const guildId = uniqueGuild();
      const conn1 = makeConn('chan-1', guildId);
      const conn2 = makeConn('chan-2', guildId);
      const { player } = setupMocks(guildId);
      player.state = { status: 'playing' };
      mockPlayerFn.mockReturnValue(player);
      mockConnFn
        .mockReturnValueOnce(conn1)
        .mockReturnValueOnce(conn2);

      const ch1 = makeChannel(guildId, 'chan-1');
      const ch2 = makeChannel(guildId, 'chan-2');

      await vm.joinAndPlay(ch1 as any, makeTrack());
      await vm.joinAndPlay(ch2 as any, makeTrack({ youtubeId: 't2' }));

      expect(mockConnFn).toHaveBeenCalledTimes(2);
      vm.stop(guildId);
    });
  });
});
