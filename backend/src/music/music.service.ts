import { prisma } from '../config/database';
import { ExternalAPIError, AppError } from '../utils/errors';
import { logger } from '../utils/logger';

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type MusicSource = 'spotify' | 'youtube';

export interface SearchResult {
  id: string;           // 'spotify-xxx' | 'youtube-xxx'
  title: string;
  artist: string;
  album?: string;
  duration?: number;    // segundos
  coverUrl?: string;
  previewUrl?: string;
  source: MusicSource;
  sourceId: string;
}

export interface SpotifyTrack {
  id: string;
  name: string;
  artists: Array<{ name: string }>;
  album: { name: string; images: Array<{ url: string }> };
  duration_ms: number;
  preview_url?: string | null;
}

export interface YouTubeSearchItem {
  id: { videoId: string };
  snippet: {
    title: string;
    channelTitle: string;
    thumbnails: { high?: { url: string }; default?: { url: string } };
  };
}

// ─── Serviço ──────────────────────────────────────────────────────────────────

export class MusicService {
  private spotifyToken: string | null = null;
  private spotifyTokenExpiry: Date | null = null;

  // ─── Busca ─────────────────────────────────────────────────────────────────

  async search(
    query: string,
    source: MusicSource | 'all' = 'all',
    limit = 10
  ): Promise<SearchResult[]> {
    if (!query?.trim()) return [];

    const clampedLimit = Math.max(1, Math.min(limit, 50));
    const results: SearchResult[] = [];
    const errors: string[] = [];

    const tasks: Array<Promise<SearchResult[]>> = [];

    if (source === 'spotify' || source === 'all') {
      tasks.push(
        this.searchSpotify(query, clampedLimit).catch(err => {
          errors.push(`Spotify: ${err.message}`);
          return [] as SearchResult[];
        })
      );
    }

    if (source === 'youtube' || source === 'all') {
      tasks.push(
        this.searchYouTube(query, clampedLimit).catch(err => {
          errors.push(`YouTube: ${err.message}`);
          return [] as SearchResult[];
        })
      );
    }

    const settled = await Promise.all(tasks);
    settled.forEach(r => results.push(...r));

    if (results.length === 0 && errors.length > 0) {
      throw new ExternalAPIError('Music', errors.join(' | '));
    }

    return results;
  }

  // ─── Spotify ──────────────────────────────────────────────────────────────

  import { spawn } from 'child_process';

  async searchSpotify(query: string, limit = 10): Promise<SearchResult[]> {
    return new Promise((resolve, reject) => {
      const args = [
        'search', query,
        '--limit', String(Math.min(limit, 50)),
        '--output', 'json',
      ];
      const proc = spawn('spotdl', args);
      let output = '';
      proc.stdout.on('data', (d) => { output += d.toString(); });
      proc.stderr.on('data', () => {});
      const timer = setTimeout(() => { proc.kill(); reject(new Error('spotDL timeout')); }, 15000);
      proc.on('close', () => {
        clearTimeout(timer);
        try {
          const data = JSON.parse(output);
          const tracks = Array.isArray(data) ? data : (data.tracks ?? []);
          const results = tracks.map((t: any) => ({
            id: `spotify-${t.song_id || t.id}`,
            title: t.name || t.title,
            artist: t.artists ? t.artists.join(', ') : t.artist,
            album: t.album,
            duration: t.duration,
            coverUrl: t.cover_url || t.coverArt,
            previewUrl: undefined,
            source: 'spotify' as const,
            sourceId: t.song_id || t.id,
          })).filter((r: any) => r.id && r.title);
          resolve(results);
        } catch (err) {
          reject(new Error('Falha ao processar resposta do spotDL'));
        }
      });
      proc.on('error', (err) => { clearTimeout(timer); reject(err); });
    });
  }

  // ─── YouTube ──────────────────────────────────────────────────────────────

  import { spawn } from 'child_process';

  async searchYouTube(query: string, limit = 10): Promise<SearchResult[]> {
    return new Promise((resolve, reject) => {
      const args = [
        `ytsearch${limit}:${query}`,
        '--dump-json',
        '--flat-playlist',
        '--no-download',
        '--no-warnings',
        '--quiet',
      ];
      const proc = spawn('yt-dlp', args);
      let output = '';
      proc.stdout.on('data', (d) => { output += d.toString(); });
      proc.stderr.on('data', () => {});
      const timer = setTimeout(() => { proc.kill(); reject(new Error('yt-dlp timeout')); }, 15000);
      proc.on('close', () => {
        clearTimeout(timer);
        const results = output.trim().split('\n')
          .filter(Boolean)
          .map(line => {
            try {
              const item = JSON.parse(line);
              return {
                id: `youtube-${item.id}`,
                title: item.title ?? 'Desconhecido',
                artist: item.uploader ?? item.channel ?? 'YouTube',
                coverUrl: item.thumbnail,
                source: 'youtube' as const,
                sourceId: item.id,
              };
            } catch { return null; }
          })
          .filter((r): r is SearchResult => r !== null && Boolean(r.sourceId));
        resolve(results);
      });
      proc.on('error', (err) => { clearTimeout(timer); reject(err); });
    });
  }

  // ─── Salva no histórico ────────────────────────────────────────────────────

  async saveToHistory(
    userId: string,
    track: Omit<SearchResult, 'id'>,
    platform: string
  ) {
    const dbTrack = await prisma.track.upsert({
      where: track.source === 'spotify'
        ? { spotifyId: track.sourceId }
        : { youtubeId: track.sourceId },
      update: {
        title: track.title,
        artist: track.artist,
        coverUrl: track.coverUrl,
      },
      create: {
        title: track.title,
        artist: track.artist,
        album: track.album,
        duration: track.duration,
        coverUrl: track.coverUrl,
        previewUrl: track.previewUrl,
        spotifyId: track.source === 'spotify' ? track.sourceId : undefined,
        youtubeId: track.source === 'youtube' ? track.sourceId : undefined,
      },
    });

    await prisma.playHistory.create({
      data: { userId, trackId: dbTrack.id, source: track.source, platform },
    });

    return dbTrack;
  }

  async getHistory(userId: string, limit = 20) {
    return prisma.playHistory.findMany({
      where: { userId },
      include: { track: true },
      orderBy: { playedAt: 'desc' },
      take: Math.min(limit, 100),
    });
  }

  // ─── Spotify token (Client Credentials) ───────────────────────────────────

  // getSpotifyClientToken e invalidateSpotifyToken removidos (não necessários)
}

export const musicService = new MusicService();
