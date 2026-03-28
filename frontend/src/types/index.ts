// ─── Auth ─────────────────────────────────────────────────────────────────────

export interface User {
  id: string;
  email: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  emailVerified: boolean;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface AuthResponse {
  user: User;
  tokens: TokenPair;
}

// ─── Music / Queue ────────────────────────────────────────────────────────────

export type MusicSource = 'spotify' | 'youtube' | 'all';

export interface Track {
  id: string;
  title: string;
  artist: string;
  album?: string | null;
  duration?: number | null;
  coverUrl?: string | null;
  spotifyId?: string | null;
  youtubeId?: string | null;
}

export interface SearchResult {
  id: string;
  title: string;
  artist: string;
  album?: string;
  duration?: number;
  coverUrl?: string;
  previewUrl?: string;
  source: 'spotify' | 'youtube';
  sourceId: string;
}

export interface QueueTrack {
  queueId: string;
  position: number;
  track: Track;
  source: string;
  addedAt: string;
}

export interface QueueState {
  userId: string;
  current: QueueTrack | null;
  queue: QueueTrack[];
  isPlaying: boolean;
  volume: number;
}

// ─── Voice ────────────────────────────────────────────────────────────────────

export interface TranscriptionResult {
  text: string;
  language: string;
  confidence: number;
  durationSeconds?: number;
}

export interface VoiceCommandResult {
  transcription: TranscriptionResult;
  command: string | null;
  query: string | null;
  response: string;
  queueResult?: unknown;
}

// ─── API Response ─────────────────────────────────────────────────────────────

export interface ApiResponse<T = unknown> {
  success: boolean;
  message?: string;
  data?: T;
  error?: {
    code: string;
    message: string;
    fields?: Record<string, string>;
  };
}
