import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CrossPlatformPlayer, detectPlatform } from '../src/audio/player';

// ─── Mock child_process ───────────────────────────────────────────────────────

const mockKill  = vi.fn();
const mockWrite = vi.fn();

vi.mock('child_process', () => ({
  spawn: vi.fn(() => ({
    killed: false,
    kill:   mockKill,
    stdin:  { write: mockWrite },
    stdout: null,
    stderr: { on: vi.fn() },
    on: vi.fn((event: string, cb: Function) => {
      if (event === 'close') setTimeout(() => cb(0), 50);
    }),
  })),
}));

vi.mock('fs', () => ({
  existsSync: vi.fn(() => true),
}));

// ─── Suite ────────────────────────────────────────────────────────────────────

describe('CrossPlatformPlayer', () => {
  let player: CrossPlatformPlayer;

  beforeEach(() => {
    player = new CrossPlatformPlayer('linux');
    vi.clearAllMocks();
    mockKill.mockReset();
  });

  it('inicia no estado idle', () => {
    expect(player.state).toBe('idle');
    expect(player.volume).toBe(80);
    expect(player.isPlaying()).toBe(false);
  });

  it('inicia reprodução e muda estado para playing', () => {
    player.play('https://example.com/audio.mp3');
    expect(player.state).toBe('playing');
    expect(player.isPlaying()).toBe(true);
  });

  it('stop muda estado para stopped', () => {
    player.play('https://example.com/audio.mp3');
    player.stop();
    expect(player.state).toBe('stopped');
    expect(player.isPlaying()).toBe(false);
  });

  it('stop chama kill no processo', () => {
    player.play('https://example.com/audio.mp3');
    player.stop();
    expect(mockKill).toHaveBeenCalledWith('SIGTERM');
  });

  it('stop sem processo em execução não lança erro', () => {
    expect(() => player.stop()).not.toThrow();
  });

  it('play lança erro para URL vazia', () => {
    expect(() => player.play('')).toThrow('URL de áudio é obrigatória');
    expect(() => player.play('   ')).toThrow('URL de áudio é obrigatória');
  });

  it('setVolume clamp entre 0 e 100', () => {
    expect(player.setVolume(150)).toBe(100);
    expect(player.setVolume(-10)).toBe(0);
    expect(player.setVolume(50)).toBe(50);
  });

  it('turnUp incrementa volume em 10', () => {
    player.setVolume(60);
    expect(player.turnUp()).toBe(70);
  });

  it('turnDown decrementa volume em 10', () => {
    player.setVolume(60);
    expect(player.turnDown()).toBe(50);
  });

  it('turnUp não ultrapassa 100', () => {
    player.setVolume(95);
    expect(player.turnUp()).toBe(100); // 95+10=105 → clampa em 100
  });

  it('turnDown não vai abaixo de 0', () => {
    player.setVolume(5);
    expect(player.turnDown()).toBe(0);
  });

  it('novo play() para o anterior', () => {
    player.play('https://example.com/1.mp3');
    player.play('https://example.com/2.mp3');
    // SIGTERM chamado pelo stop() interno
    expect(mockKill).toHaveBeenCalled();
  });

  it('chama onEnd quando processo termina', async () => {
    const onEnd = vi.fn();
    player.play('https://example.com/audio.mp3', { onEnd });
    await new Promise(r => setTimeout(r, 100));
    expect(onEnd).toHaveBeenCalled();
  });

  it('diagnose retorna info da plataforma', () => {
    const info = player.diagnose();
    expect(info.platform).toBe('linux');
    expect(info.player).toBeTypeOf('string');
  });

  it('detecta plataforma Windows corretamente', () => {
    const player = new CrossPlatformPlayer('windows');
    expect(player.playerName).toContain('Windows');
  });

  it('detecta plataforma macOS corretamente', () => {
    const player = new CrossPlatformPlayer('macos');
    expect(player.playerName).toContain('afplay');
  });
});

describe('detectPlatform', () => {
  it('retorna um valor válido', () => {
    const p = detectPlatform();
    expect(['windows', 'macos', 'linux']).toContain(p);
  });
});
