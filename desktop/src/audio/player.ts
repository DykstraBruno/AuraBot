import { spawn, ChildProcess } from 'child_process';
import { existsSync } from 'fs';
import { platform } from 'os';
import { getAudioStreamUrl, isYtDlpAvailable, getInstallInstructions } from './ytdlp';

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type Platform = 'windows' | 'macos' | 'linux';
export type PlayerState = 'idle' | 'playing' | 'paused' | 'stopped';

export interface AudioSource {
  youtubeId?: string | null;
  spotifyId?: string | null;
  title: string;
  artist: string;
}

export interface PlayerOptions {
  volume?: number; // 0–100
  onEnd?:   () => void;
  onError?: (err: Error) => void;
}

// ─── Detecção de plataforma ───────────────────────────────────────────────────

export function detectPlatform(): Platform {
  const p = platform();
  if (p === 'win32') return 'windows';
  if (p === 'darwin') return 'macos';
  return 'linux';
}

// ─── Estratégias por plataforma ───────────────────────────────────────────────

interface PlayerStrategy {
  name: string;
  canPlay: (url: string) => boolean;
  play: (url: string, volume: number, opts: PlayerOptions) => ChildProcess | null;
  setVolume?: (proc: ChildProcess, volume: number) => void;
}

// Windows: PowerShell com Windows Media Player
const windowsStrategy: PlayerStrategy = {
  name: 'Windows Media Player (PowerShell)',
  canPlay: () => true,
  play: (url, volume, opts) => {
    const script = `
      Add-Type -AssemblyName presentationCore;
      $player = New-Object system.windows.media.mediaplayer;
      $player.Open([System.Uri] '${url}');
      $player.Volume = ${volume / 100};
      $player.Play();
      do { Start-Sleep -Seconds 1 } while ($player.NaturalDuration.HasTimeSpan -eq $false -or $player.Position -lt $player.NaturalDuration.TimeSpan)
    `.trim();

    const proc = spawn('powershell', ['-NoProfile', '-NonInteractive', '-Command', script], {
      stdio: ['ignore', 'ignore', 'pipe'],
      detached: false,
    });

    proc.on('close', code => { if (code === 0) opts.onEnd?.(); });
    proc.on('error', err => opts.onError?.(err));
    proc.stderr?.on('data', d => {
      const msg = d.toString().trim();
      if (msg) opts.onError?.(new Error(`WMP: ${msg}`));
    });

    return proc;
  },
};

// macOS: afplay (built-in)
const macosStrategy: PlayerStrategy = {
  name: 'afplay (macOS)',
  canPlay: () => true,
  play: (url, volume, opts) => {
    // afplay: volume 0–1 via -v flag; para URL HTTP precisa baixar antes
    // Para streaming, usa curl | afplay via pipe
    const isUrl = url.startsWith('http');

    let proc: ChildProcess;

    if (isUrl) {
      // Curl → afplay via pipe
      const curl = spawn('curl', ['-sL', url], { stdio: ['ignore', 'pipe', 'ignore'] });
      const afplay = spawn('afplay', ['-v', String(volume / 100), '-'], {
        stdio: ['pipe', 'ignore', 'pipe'],
      });

      curl.stdout?.pipe(afplay.stdin!);
      afplay.on('close', code => { if (code === 0 || code === null) opts.onEnd?.(); });
      afplay.on('error', err => opts.onError?.(err));
      proc = afplay;
    } else {
      proc = spawn('afplay', ['-v', String(volume / 100), url], {
        stdio: ['ignore', 'ignore', 'pipe'],
      });
      proc.on('close', code => { if (code === 0) opts.onEnd?.(); });
      proc.on('error', err => opts.onError?.(err));
    }

    return proc;
  },
};

// Linux: tenta paplay → mpg123 → mpv → ffplay
const linuxStrategies: PlayerStrategy[] = [
  {
    name: 'mpv',
    canPlay: () => Boolean(findExecutable(['mpv'])),
    play: (url, volume, opts) => {
      const proc = spawn(
        'mpv',
        ['--no-video', `--volume=${volume}`, '--really-quiet', url],
        { stdio: ['ignore', 'ignore', 'pipe'] }
      );
      proc.on('close', code => { if (code === 0) opts.onEnd?.(); });
      proc.on('error', err => opts.onError?.(err));
      return proc;
    },
    setVolume: (proc, vol) => proc.stdin?.write(`set volume ${vol}\n`),
  },
  {
    name: 'mpg123',
    canPlay: (url) => Boolean(findExecutable(['mpg123'])) && url.includes('.mp3'),
    play: (url, _volume, opts) => {
      const proc = spawn('mpg123', ['-q', url], { stdio: ['ignore', 'ignore', 'pipe'] });
      proc.on('close', code => { if (code === 0) opts.onEnd?.(); });
      proc.on('error', err => opts.onError?.(err));
      return proc;
    },
  },
  {
    name: 'ffplay',
    canPlay: () => Boolean(findExecutable(['ffplay'])),
    play: (url, volume, opts) => {
      const proc = spawn(
        'ffplay',
        ['-nodisp', '-autoexit', '-volume', String(volume), url],
        { stdio: ['ignore', 'ignore', 'pipe'] }
      );
      proc.on('close', code => { if (code === 0) opts.onEnd?.(); });
      proc.on('error', err => opts.onError?.(err));
      return proc;
    },
  },
  {
    name: 'paplay (PulseAudio)',
    canPlay: (url) => Boolean(findExecutable(['paplay'])) && !url.startsWith('http'),
    play: (url, _volume, opts) => {
      const proc = spawn('paplay', [url], { stdio: ['ignore', 'ignore', 'pipe'] });
      proc.on('close', code => { if (code === 0) opts.onEnd?.(); });
      proc.on('error', err => opts.onError?.(err));
      return proc;
    },
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function findExecutable(names: string[]): string | null {
  const paths = (process.env.PATH ?? '').split(':');
  for (const name of names) {
    for (const dir of paths) {
      const full = `${dir}/${name}`;
      if (existsSync(full)) return full;
    }
  }
  return null;
}

// ─── CrossPlatformPlayer ──────────────────────────────────────────────────────

export class CrossPlatformPlayer {
  private platform: Platform;
  private process: ChildProcess | null = null;
  private _state: PlayerState = 'idle';
  private _volume: number = 80;
  private strategy: PlayerStrategy;

  constructor(platform?: Platform) {
    this.platform = platform ?? detectPlatform();
    this.strategy = this.resolveStrategy();
  }

  get state(): PlayerState { return this._state; }
  get volume(): number { return this._volume; }
  get playerName(): string { return this.strategy.name; }

  // ─── play ─────────────────────────────────────────────────────────────────

  play(url: string, opts: PlayerOptions = {}): void {
    if (!url?.trim()) throw new Error('URL de áudio é obrigatória');

    this.stop(); // Para qualquer reprodução atual

    const proc = this.strategy.play(url, this._volume, {
      onEnd: () => {
        this._state = 'idle';
        this.process = null;
        opts.onEnd?.();
      },
      onError: (err) => {
        this._state = 'idle';
        this.process = null;
        opts.onError?.(err);
      },
    });

    if (proc) {
      this.process = proc;
      this._state = 'playing';
    }
  }

  // ─── stop ─────────────────────────────────────────────────────────────────

  stop(): void {
    if (this.process && !this.process.killed) {
      this.process.kill('SIGTERM');
      setTimeout(() => {
        if (this.process && !this.process.killed) {
          this.process.kill('SIGKILL');
        }
      }, 1000);
    }
    this.process = null;
    this._state = 'stopped';
  }

  // ─── volume ───────────────────────────────────────────────────────────────

  setVolume(vol: number): number {
    this._volume = Math.max(0, Math.min(100, Math.round(vol)));

    if (this.process && this.strategy.setVolume) {
      this.strategy.setVolume(this.process, this._volume);
    }

    return this._volume;
  }

  turnUp(step = 10): number {
    return this.setVolume(this._volume + step);
  }

  turnDown(step = 10): number {
    return this.setVolume(this._volume - step);
  }

  isPlaying(): boolean { return this._state === 'playing'; }

  /**
   * Reproduz um vídeo do YouTube extraindo a URL de stream via yt-dlp.
   * Diferente de play() que recebe URL direta, este método recebe o ID ou URL do YouTube.
   */
  async playYouTube(
    youtubeIdOrUrl: string,
    opts: PlayerOptions = {}
  ): Promise<void> {
    if (!isYtDlpAvailable()) {
      const msg = getInstallInstructions();
      opts.onError?.(new Error(msg));
      return;
    }

    const url = youtubeIdOrUrl.startsWith('http')
      ? youtubeIdOrUrl
      : `https://www.youtube.com/watch?v=${youtubeIdOrUrl}`;

    try {
      const streamUrl = await getAudioStreamUrl(url);
      this.play(streamUrl, opts);
    } catch (err: any) {
      opts.onError?.(err);
    }
  }

  ytDlpAvailable(): boolean {
    return isYtDlpAvailable();
  }

  // ─── Resolve estratégia por plataforma ────────────────────────────────────

  private resolveStrategy(): PlayerStrategy {
    if (this.platform === 'windows') return windowsStrategy;
    if (this.platform === 'macos')   return macosStrategy;

    // Linux: primeira disponível
    for (const s of linuxStrategies) {
      if (s.canPlay('test')) return s;
    }

    // Fallback genérico
    return {
      name: 'fallback (nenhum player encontrado)',
      canPlay: () => false,
      play: (_url, _vol, opts) => {
        opts.onError?.(new Error(
          'Nenhum player de áudio encontrado. Instale: mpv, mpg123, ou ffmpeg'
        ));
        return null;
      },
    };
  }

  // ─── Info de diagnóstico ──────────────────────────────────────────────────

  diagnose(): { platform: Platform; player: string; available: string[] } {
    const available: string[] = [];

    if (this.platform === 'linux') {
      for (const s of linuxStrategies) {
        if (findExecutable([s.name.split(' ')[0]])) available.push(s.name);
      }
    }

    return {
      platform: this.platform,
      player: this.strategy.name,
      available,
    };
  }
}
