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

  async searchSpotify(query: string, limit = 10): Promise<SearchResult[]> {
    const token = await this.getSpotifyClientToken();

    const params = new URLSearchParams({
      q: query,
      type: 'track',
      limit: String(Math.min(limit, 50)),
      market: 'BR',
    });

    const res = await fetch(`https://api.spotify.com/v1/search?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      if (res.status === 401) {
        this.invalidateSpotifyToken();
        throw new ExternalAPIError('Spotify', 'Token inválido — renovando...');
      }
      if (res.status === 429) {
        throw new ExternalAPIError('Spotify', 'Limite de requisições atingido');
      }
      throw new ExternalAPIError('Spotify', `Busca falhou: ${res.status} ${res.statusText}`);
    }

    const data = await res.json();
    const tracks: SpotifyTrack[] = data.tracks?.items ?? [];

    return tracks
      .filter(t => t.id && t.name)
      .map(t => ({
        id: `spotify-${t.id}`,
        title: t.name,
        artist: t.artists.map(a => a.name).join(', '),
        album: t.album?.name,
        duration: t.duration_ms ? Math.floor(t.duration_ms / 1000) : undefined,
        coverUrl: t.album?.images?.[0]?.url,
        previewUrl: t.preview_url ?? undefined,
        source: 'spotify' as const,
        sourceId: t.id,
      }));
  }

  // ─── YouTube ──────────────────────────────────────────────────────────────

  async searchYouTube(query: string, limit = 10): Promise<SearchResult[]> {
    const apiKey = process.env.YOUTUBE_API_KEY;
    if (!apiKey) throw new ExternalAPIError('YouTube', 'Chave de API não configurada');

    const params = new URLSearchParams({
      part: 'snippet',
      q: `${query} official audio`,
      type: 'video',
      videoCategoryId: '10', // Música
      maxResults: String(Math.min(limit, 50)),
      key: apiKey,
      regionCode: 'BR',
    });

    const res = await fetch(`https://www.googleapis.com/youtube/v3/search?${params}`);

    if (!res.ok) {
      if (res.status === 403) {
        const body = await res.json().catch(() => ({}));
        const reason = body.error?.errors?.[0]?.reason;
        if (reason === 'quotaExceeded') {
          throw new ExternalAPIError('YouTube', 'Cota diária da API atingida');
        }
        throw new ExternalAPIError('YouTube', 'Chave de API inválida ou sem permissão');
      }
      throw new ExternalAPIError('YouTube', `Busca falhou: ${res.status}`);
    }

    const data = await res.json();
    const items: YouTubeSearchItem[] = data.items ?? [];

    return items
      .filter(v => v.id?.videoId)
      .map(v => ({
        id: `youtube-${v.id.videoId}`,
        title: v.snippet.title,
        artist: v.snippet.channelTitle,
        coverUrl:
          v.snippet.thumbnails?.high?.url ??
          v.snippet.thumbnails?.default?.url,
        source: 'youtube' as const,
        sourceId: v.id.videoId,
      }));
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

  async getSpotifyClientToken(): Promise<string> {
    if (this.spotifyToken && this.spotifyTokenExpiry && this.spotifyTokenExpiry > new Date()) {
      return this.spotifyToken;
    }

    const clientId = process.env.SPOTIFY_CLIENT_ID;
    const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      throw new ExternalAPIError('Spotify', 'Credenciais não configuradas');
    }

    const creds = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

    const res = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${creds}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    });

    if (!res.ok) {
      throw new ExternalAPIError('Spotify', 'Falha ao obter token de acesso');
    }

    const data = await res.json();
    this.spotifyToken = data.access_token;
    // Expira 60s antes para evitar race condition
    this.spotifyTokenExpiry = new Date(Date.now() + (data.expires_in - 60) * 1000);

    logger.debug('Token Spotify renovado');
    return this.spotifyToken!;
  }

  invalidateSpotifyToken() {
    this.spotifyToken = null;
    this.spotifyTokenExpiry = null;
  }
}

export const musicService = new MusicService();
