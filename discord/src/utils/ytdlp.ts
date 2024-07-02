import { spawn } from 'child_process';

// ─── Resolução de binários (cross-platform) ───────────────────────────────────
//
// Prioridade:
//   1. Variável de ambiente YTDLP_EXE / FFMPEG_EXE (configurável em qualquer SO)
//   2. Caminho WinGet padrão do Windows (retrocompatibilidade)
//   3. Nome do binário puro — depende do PATH do sistema

function resolveWinGetPath(pkg: string, subPath: string): string {
  const base = process.env.LOCALAPPDATA ?? 'C:/Users/dykst/AppData/Local';
  return `${base}/Microsoft/WinGet/Packages/${pkg}/${subPath}`;
}

export const YTDLP_EXE: string =
  process.env.YTDLP_EXE ??
  resolveWinGetPath(
    'yt-dlp.yt-dlp_Microsoft.Winget.Source_8wekyb3d8bbwe',
    'yt-dlp.exe'
  );

export const FFMPEG_BIN: string =
  process.env.FFMPEG_BIN ??
  resolveWinGetPath(
    'Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe',
    'ffmpeg-8.1-full_build/bin'
  );

export const FFMPEG_EXE: string =
  process.env.FFMPEG_EXE ??
  `${FFMPEG_BIN}/ffmpeg.exe`;

// Garante ffmpeg no PATH (Windows — sem efeito em sistemas sem separador ';')
if (FFMPEG_BIN && !process.env.PATH?.includes(FFMPEG_BIN)) {
  process.env.PATH = `${FFMPEG_BIN};${process.env.PATH ?? ''}`;
}

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface TrackInfo {
  title: string;
  artist: string;
  youtubeId: string;
  thumbnail?: string;
  duration?: number;
}

// ─── Busca no YouTube via yt-dlp ──────────────────────────────────────────────

export async function searchYouTube(query: string, limit = 5): Promise<TrackInfo[]> {
  return new Promise((resolve) => {
    const proc = spawn(YTDLP_EXE, [
      `ytsearch${limit}:${query}`,
      '--dump-json',
      '--flat-playlist',
      '--no-download',
      '--no-warnings',
      '--quiet',
    ]);

    let output = '';
    proc.stdout.on('data', (d: Buffer) => { output += d.toString(); });
    proc.stderr.on('data', () => {});

    const timer = setTimeout(() => { proc.kill(); resolve([]); }, 10_000);

    proc.on('close', () => {
      clearTimeout(timer);
      const results = output.trim().split('\n')
        .filter(Boolean)
        .map(line => {
          try {
            const item = JSON.parse(line);
            return {
              title:     item.title    ?? 'Desconhecido',
              artist:    item.uploader ?? item.channel ?? 'YouTube',
              youtubeId: item.id,
              thumbnail: item.thumbnail,
              duration:  item.duration,
            } as TrackInfo;
          } catch { return null; }
        })
        .filter((r): r is TrackInfo => r !== null && Boolean(r.youtubeId));
      resolve(results);
    });

    proc.on('error', () => { clearTimeout(timer); resolve([]); });
  });
}

// ─── Obtém URL de stream direta ───────────────────────────────────────────────

export async function getStreamUrl(youtubeId: string): Promise<string> {
  const ytUrl = `https://www.youtube.com/watch?v=${youtubeId}`;

  return new Promise((resolve, reject) => {
    const proc = spawn(YTDLP_EXE, [
      '-f', 'bestaudio',
      '-g', '--no-playlist', '--no-warnings',
      ytUrl,
    ]);

    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (d: Buffer) => { stdout += d.toString(); });
    proc.stderr.on('data', (d: Buffer) => { stderr += d.toString(); });

    const timer = setTimeout(() => {
      proc.kill('SIGKILL');
      reject(new Error('yt-dlp timeout após 20s'));
    }, 20_000);

    proc.on('close', (code) => {
      clearTimeout(timer);
      const url = stdout.trim().split('\n')[0];
      if (url) resolve(url);
      else reject(new Error(`yt-dlp falhou (code=${code}): ${stderr.slice(0, 200)}`));
    });

    proc.on('error', (err) => { clearTimeout(timer); reject(err); });
  });
}
