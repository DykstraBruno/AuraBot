import { describe, it, expect, beforeEach } from 'vitest';
import { act } from 'react';
import { usePlayerStore } from '../../store/playerStore';
import type { QueueTrack, QueueState } from '../../types';

// ─── Factories ────────────────────────────────────────────────────────────────

const makeQueueTrack = (overrides: Partial<QueueTrack> = {}): QueueTrack => ({
  queueId:  'qi-1',
  position: 1,
  source:   'spotify',
  addedAt:  new Date().toISOString(),
  track: {
    id:       'track-1',
    title:    'Bohemian Rhapsody',
    artist:   'Queen',
    album:    'A Night at the Opera',
    duration: 354,
    coverUrl: null,
    spotifyId: 'sp-1',
    youtubeId: null,
  },
  ...overrides,
});

const makeQueueState = (overrides: Partial<QueueState> = {}): QueueState => ({
  userId:    'user-1',
  current:   makeQueueTrack(),
  queue:     [],
  isPlaying: true,
  volume:    80,
  ...overrides,
});

// ─── Suite ────────────────────────────────────────────────────────────────────

describe('playerStore', () => {
  beforeEach(() => {
    act(() => {
      usePlayerStore.setState({
        userId:      '',
        current:     null,
        queue:       [],
        isPlaying:   false,
        volume:      80,
        isLoading:   false,
        lastMessage: null,
      });
    });
  });

  describe('estado inicial', () => {
    it('começa sem música tocando', () => {
      const { current, isPlaying } = usePlayerStore.getState();
      expect(current).toBeNull();
      expect(isPlaying).toBe(false);
    });

    it('começa com volume padrão de 80', () => {
      expect(usePlayerStore.getState().volume).toBe(80);
    });

    it('começa com fila vazia', () => {
      expect(usePlayerStore.getState().queue).toHaveLength(0);
    });
  });

  describe('setQueueState', () => {
    it('substitui o estado completo da fila', () => {
      const state = makeQueueState({ volume: 60, isPlaying: true });

      act(() => usePlayerStore.getState().setQueueState(state));

      const s = usePlayerStore.getState();
      expect(s.current).toEqual(state.current);
      expect(s.isPlaying).toBe(true);
      expect(s.volume).toBe(60);
    });

    it('atualiza a fila corretamente', () => {
      const queue = [
        makeQueueTrack({ queueId: 'qi-2', position: 2 }),
        makeQueueTrack({ queueId: 'qi-3', position: 3 }),
      ];
      act(() => usePlayerStore.getState().setQueueState(makeQueueState({ queue })));

      expect(usePlayerStore.getState().queue).toHaveLength(2);
    });
  });

  describe('setCurrent', () => {
    it('define track atual e isPlaying=true quando track não é null', () => {
      const track = makeQueueTrack();
      act(() => usePlayerStore.getState().setCurrent(track));

      const s = usePlayerStore.getState();
      expect(s.current).toEqual(track);
      expect(s.isPlaying).toBe(true);
    });

    it('define isPlaying=false quando track é null', () => {
      act(() => usePlayerStore.getState().setCurrent(makeQueueTrack()));
      act(() => usePlayerStore.getState().setCurrent(null));

      const s = usePlayerStore.getState();
      expect(s.current).toBeNull();
      expect(s.isPlaying).toBe(false);
    });
  });

  describe('setVolume', () => {
    it('atualiza o volume', () => {
      act(() => usePlayerStore.getState().setVolume(50));
      expect(usePlayerStore.getState().volume).toBe(50);
    });

    it('aceita volume 0 (mudo)', () => {
      act(() => usePlayerStore.getState().setVolume(0));
      expect(usePlayerStore.getState().volume).toBe(0);
    });

    it('aceita volume 100 (máximo)', () => {
      act(() => usePlayerStore.getState().setVolume(100));
      expect(usePlayerStore.getState().volume).toBe(100);
    });
  });

  describe('setLoading', () => {
    it('atualiza isLoading', () => {
      act(() => usePlayerStore.getState().setLoading(true));
      expect(usePlayerStore.getState().isLoading).toBe(true);

      act(() => usePlayerStore.getState().setLoading(false));
      expect(usePlayerStore.getState().isLoading).toBe(false);
    });
  });

  describe('setMessage', () => {
    it('atualiza lastMessage', () => {
      act(() => usePlayerStore.getState().setMessage('▶️ Tocando Bohemian Rhapsody'));
      expect(usePlayerStore.getState().lastMessage).toBe('▶️ Tocando Bohemian Rhapsody');
    });

    it('aceita null para limpar mensagem', () => {
      act(() => usePlayerStore.getState().setMessage('mensagem'));
      act(() => usePlayerStore.getState().setMessage(null));
      expect(usePlayerStore.getState().lastMessage).toBeNull();
    });
  });

  describe('setPlaying', () => {
    it('atualiza isPlaying independentemente de current', () => {
      act(() => usePlayerStore.getState().setPlaying(true));
      expect(usePlayerStore.getState().isPlaying).toBe(true);

      act(() => usePlayerStore.getState().setPlaying(false));
      expect(usePlayerStore.getState().isPlaying).toBe(false);
    });
  });
});
