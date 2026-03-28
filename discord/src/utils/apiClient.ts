import axios, { AxiosInstance } from 'axios';

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface ApiQueueResult {
  action?: 'playing' | 'queued';
  message: string;
  track?: {
    queueId: string;
    position: number;
    track: {
      title: string;
      artist: string;
      album?: string | null;
      duration?: number | null;
      coverUrl?: string | null;
      youtubeId?: string | null;
      spotifyId?: string | null;
    };
    source: string;
  };
  volume?: number;
  queuePosition?: number;
}

export interface QueueState {
  current: ApiQueueResult['track'] | null;
  queue: ApiQueueResult['track'][];
  isPlaying: boolean;
  volume: number;
}

// ─── Cliente ──────────────────────────────────────────────────────────────────

export class AuraBotApiClient {
  private http: AxiosInstance;

  constructor(baseURL: string, botToken: string) {
    this.http = axios.create({
      baseURL,
      timeout: 10_000,
      headers: {
        'Authorization': `Bearer ${botToken}`,
        'Content-Type': 'application/json',
        'X-Platform': 'discord',
      },
    });

    this.http.interceptors.response.use(
      res => res,
      err => {
        const msg = err.response?.data?.error?.message ?? err.message;
        throw new Error(msg);
      }
    );
  }

  async play(userId: string, query: string): Promise<ApiQueueResult> {
    const { data } = await this.http.post('/music/play', { query }, {
      headers: { 'X-Discord-User': userId },
    });
    return data.data;
  }

  async stop(userId: string): Promise<ApiQueueResult> {
    const { data } = await this.http.post('/music/stop', {}, {
      headers: { 'X-Discord-User': userId },
    });
    return data.data;
  }

  async next(userId: string): Promise<ApiQueueResult> {
    const { data } = await this.http.post('/music/next', {}, {
      headers: { 'X-Discord-User': userId },
    });
    return data.data;
  }

  async turnUp(userId: string): Promise<ApiQueueResult> {
    const { data } = await this.http.post('/music/volume', { direction: 'up' }, {
      headers: { 'X-Discord-User': userId },
    });
    return data.data;
  }

  async turnDown(userId: string): Promise<ApiQueueResult> {
    const { data } = await this.http.post('/music/volume', { direction: 'down' }, {
      headers: { 'X-Discord-User': userId },
    });
    return data.data;
  }

  async getQueue(userId: string): Promise<QueueState> {
    const { data } = await this.http.get('/music/queue', {
      headers: { 'X-Discord-User': userId },
    });
    return data.data;
  }

  async search(userId: string, query: string, source = 'all') {
    const { data } = await this.http.get('/music/search', {
      params: { q: query, source, limit: 5 },
      headers: { 'X-Discord-User': userId },
    });
    return data.data.results;
  }
}
