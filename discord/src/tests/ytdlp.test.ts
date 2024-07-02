import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'events';

// ─── Mock child_process ────────────────────────────────────────────────────────

const mockProc = () => {
  const proc = new EventEmitter() as any;
  proc.stdout = new EventEmitter();
  proc.stderr = new EventEmitter();
  proc.kill  = vi.fn();
  return proc;
};

vi.mock('child_process', () => ({
  spawn: vi.fn(),
}));

import { spawn } from 'child_process';
const mockSpawn = vi.mocked(spawn);

// ─── Helpers ───────────────────────────────────────────────────────────────────

function emitLines(proc: any, lines: string[], onDone?: () => void) {
  setImmediate(() => {
    lines.forEach(l => proc.stdout.emit('data', Buffer.from(l + '\n')));
    if (onDone) onDone();
    proc.emit('close', 0);
  });
}

// ─── Tests ─────────────────────────────────────────────────────────────────────

describe('ytdlp utils', () => {
  // ── Resolução de binários ─────────────────────────────────────────────────

  describe('resolveBinaryPath', () => {
    const originalEnv = { ...process.env };

    afterEach(() => {
      Object.keys(process.env).forEach(k => {
        if (!(k in originalEnv)) delete process.env[k];
        else process.env[k] = originalEnv[k];
      });
      vi.resetModules();
    });

    it('usa YTDLP_EXE do ambiente quando definida', async () => {
      process.env.YTDLP_EXE = '/custom/path/yt-dlp';
      const { YTDLP_EXE } = await import('../utils/ytdlp');
      expect(YTDLP_EXE).toBe('/custom/path/yt-dlp');
    });

    it('usa FFMPEG_EXE do ambiente quando definida', async () => {
      process.env.FFMPEG_EXE = '/custom/path/ffmpeg';
      const { FFMPEG_EXE } = await import('../utils/ytdlp');
      expect(FFMPEG_EXE).toBe('/custom/path/ffmpeg');
    });

    it('usa fallback "yt-dlp" quando YTDLP_EXE não está definida', async () => {
      delete process.env.YTDLP_EXE;
      const { YTDLP_EXE } = await import('../utils/ytdlp');
      // fallback é o nome do binário (PATH lookup) ou caminho padrão do SO
      expect(typeof YTDLP_EXE).toBe('string');
      expect(YTDLP_EXE.length).toBeGreaterThan(0);
    });

    it('usa fallback "ffmpeg" quando FFMPEG_EXE não está definida', async () => {
      delete process.env.FFMPEG_EXE;
      const { FFMPEG_EXE } = await import('../utils/ytdlp');
      expect(typeof FFMPEG_EXE).toBe('string');
      expect(FFMPEG_EXE.length).toBeGreaterThan(0);
    });
  });

  // ── searchYouTube ────────────────────────────────────────────────────────

  describe('searchYouTube', () => {
    beforeEach(() => {
      vi.resetModules();
    });

    it('retorna resultados parseados de saída JSON', async () => {
      const proc = mockProc();
      mockSpawn.mockReturnValue(proc as any);

      const { searchYouTube } = await import('../utils/ytdlp');

      const resultPromise = searchYouTube('Bohemian Rhapsody', 3);

      setImmediate(() => {
        const track = JSON.stringify({
          id: 'abc123',
          title: 'Bohemian Rhapsody',
          uploader: 'Queen Official',
          thumbnail: 'https://img.youtube.com/vi/abc123/hqdefault.jpg',
          duration: 354,
        });
        proc.stdout.emit('data', Buffer.from(track + '\n'));
        proc.emit('close', 0);
      });

      const results = await resultPromise;
      expect(results).toHaveLength(1);
      expect(results[0].title).toBe('Bohemian Rhapsody');
      expect(results[0].artist).toBe('Queen Official');
      expect(results[0].youtubeId).toBe('abc123');
      expect(results[0].duration).toBe(354);
    });

    it('retorna array vazio quando saída é JSON inválido', async () => {
      const proc = mockProc();
      mockSpawn.mockReturnValue(proc as any);

      const { searchYouTube } = await import('../utils/ytdlp');
      const resultPromise = searchYouTube('query');

      setImmediate(() => {
        proc.stdout.emit('data', Buffer.from('not-json\n'));
        proc.emit('close', 0);
      });

      const results = await resultPromise;
      expect(results).toEqual([]);
    });

    it('retorna array vazio quando o processo falha (erro de spawn)', async () => {
      const proc = mockProc();
      mockSpawn.mockReturnValue(proc as any);

      const { searchYouTube } = await import('../utils/ytdlp');
      const resultPromise = searchYouTube('query');

      setImmediate(() => {
        proc.emit('error', new Error('spawn ENOENT'));
      });

      const results = await resultPromise;
      expect(results).toEqual([]);
    });

    it('retorna array vazio no timeout (10s)', async () => {
      vi.useFakeTimers();
      const proc = mockProc();
      mockSpawn.mockReturnValue(proc as any);

      const { searchYouTube } = await import('../utils/ytdlp');
      const resultPromise = searchYouTube('query');

      // Avança 10s sem o processo fechar
      vi.advanceTimersByTime(10_001);

      const results = await resultPromise;
      expect(proc.kill).toHaveBeenCalled();
      expect(results).toEqual([]);
      vi.useRealTimers();
    });

    it('filtra resultados sem youtubeId', async () => {
      const proc = mockProc();
      mockSpawn.mockReturnValue(proc as any);

      const { searchYouTube } = await import('../utils/ytdlp');
      const resultPromise = searchYouTube('query');

      setImmediate(() => {
        // Objeto sem 'id'
        proc.stdout.emit('data', Buffer.from(JSON.stringify({ title: 'sem id' }) + '\n'));
        proc.emit('close', 0);
      });

      const results = await resultPromise;
      expect(results).toEqual([]);
    });

    it('passa --no-download e --flat-playlist ao yt-dlp', async () => {
      const proc = mockProc();
      mockSpawn.mockReturnValue(proc as any);

      const { searchYouTube } = await import('../utils/ytdlp');
      const resultPromise = searchYouTube('test');

      setImmediate(() => proc.emit('close', 0));
      await resultPromise;

      const args: string[] = (mockSpawn.mock.calls[0] as any)[1];
      expect(args).toContain('--no-download');
      expect(args).toContain('--flat-playlist');
      expect(args.some(a => a.startsWith('ytsearch'))).toBe(true);
    });
  });

  // ── getStreamUrl ─────────────────────────────────────────────────────────

  describe('getStreamUrl', () => {
    beforeEach(() => {
      vi.resetModules();
    });

    it('retorna URL da primeira linha do stdout', async () => {
      const proc = mockProc();
      mockSpawn.mockReturnValue(proc as any);

      const { getStreamUrl } = await import('../utils/ytdlp');
      const urlPromise = getStreamUrl('abc123');

      setImmediate(() => {
        proc.stdout.emit('data', Buffer.from('https://stream.example.com/audio.webm\n'));
        proc.emit('close', 0);
      });

      const url = await urlPromise;
      expect(url).toBe('https://stream.example.com/audio.webm');
    });

    it('rejeita com mensagem de erro quando yt-dlp falha (code != 0)', async () => {
      const proc = mockProc();
      mockSpawn.mockReturnValue(proc as any);

      const { getStreamUrl } = await import('../utils/ytdlp');
      const urlPromise = getStreamUrl('badid');

      setImmediate(() => {
        proc.stderr.emit('data', Buffer.from('ERROR: Video unavailable\n'));
        proc.emit('close', 1);
      });

      await expect(urlPromise).rejects.toThrow(/yt-dlp falhou/);
    });

    it('rejeita com mensagem de erro quando stdout está vazio', async () => {
      const proc = mockProc();
      mockSpawn.mockReturnValue(proc as any);

      const { getStreamUrl } = await import('../utils/ytdlp');
      const urlPromise = getStreamUrl('emptyid');

      setImmediate(() => proc.emit('close', 0));

      await expect(urlPromise).rejects.toThrow(/yt-dlp falhou/);
    });

    it('rejeita após timeout de 20s com mensagem clara', async () => {
      vi.useFakeTimers();
      const proc = mockProc();
      mockSpawn.mockReturnValue(proc as any);

      const { getStreamUrl } = await import('../utils/ytdlp');
      const urlPromise = getStreamUrl('slowid');

      vi.advanceTimersByTime(20_001);

      await expect(urlPromise).rejects.toThrow(/timeout/i);
      expect(proc.kill).toHaveBeenCalledWith('SIGKILL');
      vi.useRealTimers();
    });

    it('rejeita quando o processo emite erro (spawn ENOENT)', async () => {
      const proc = mockProc();
      mockSpawn.mockReturnValue(proc as any);

      const { getStreamUrl } = await import('../utils/ytdlp');
      const urlPromise = getStreamUrl('id');

      setImmediate(() => proc.emit('error', new Error('spawn ENOENT')));

      await expect(urlPromise).rejects.toThrow('spawn ENOENT');
    });

    it('passa -f bestaudio ao yt-dlp', async () => {
      const proc = mockProc();
      mockSpawn.mockReturnValue(proc as any);

      const { getStreamUrl } = await import('../utils/ytdlp');
      const urlPromise = getStreamUrl('xyz');

      setImmediate(() => {
        proc.stdout.emit('data', Buffer.from('https://url.com/audio\n'));
        proc.emit('close', 0);
      });

      await urlPromise;

      const args: string[] = (mockSpawn.mock.calls[0] as any)[1];
      expect(args).toContain('-f');
      expect(args).toContain('bestaudio');
    });
  });
});
