import '@testing-library/jest-dom';
import { vi, afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// Cleanup após cada teste
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  localStorage.clear();
});

// ─── Mock do react-router-dom ─────────────────────────────────────────────────
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return {
    ...actual,
    useNavigate: () => vi.fn(),
    useLocation: () => ({ pathname: '/login', state: null, search: '', hash: '' }),
    useSearchParams: () => [new URLSearchParams(), vi.fn()],
  };
});

// ─── Mock do axios/api ────────────────────────────────────────────────────────
vi.mock('../services/api', () => ({
  api: {
    post: vi.fn(),
    get: vi.fn(),
    interceptors: {
      request: { use: vi.fn() },
      response: { use: vi.fn() },
    },
  },
  getApiError: vi.fn((err: any) => {
    if (err?.response?.data?.error) return err.response.data.error;
    return { message: 'Erro inesperado', code: 'UNKNOWN' };
  }),
  getFieldError: vi.fn(),
}));

// ─── Mock do zustand stores ───────────────────────────────────────────────────
vi.mock('../store/authStore', () => ({
  useAuthStore: vi.fn((selector) => {
    const state = {
      user: { id: 'u1', email: 'test@test.com', username: 'testuser', displayName: 'Test', avatarUrl: null, emailVerified: false },
      tokens: { accessToken: 'access-token', refreshToken: 'refresh-token', expiresIn: 900 },
      isAuthenticated: true,
      setAuth: vi.fn(),
      setTokens: vi.fn(),
      logout: vi.fn(),
    };
    return selector ? selector(state) : state;
  }),
}));

vi.mock('../store/playerStore', () => ({
  usePlayerStore: vi.fn((selector) => {
    const state = {
      current: null,
      queue: [],
      isPlaying: false,
      volume: 80,
      isLoading: false,
      lastMessage: null,
      setQueueState: vi.fn(),
      setLoading: vi.fn(),
      setMessage: vi.fn(),
      setCurrent: vi.fn(),
      setVolume: vi.fn(),
      setPlaying: vi.fn(),
    };
    return selector ? selector(state) : state;
  }),
}));

// ─── Mock MediaRecorder + getUserMedia ────────────────────────────────────────
const mockStop = vi.fn();
const mockStart = vi.fn();

class MockMediaRecorder {
  state = 'inactive';
  mimeType = 'audio/webm';
  ondataavailable: ((e: any) => void) | null = null;
  onstop: (() => void) | null = null;

  start() { this.state = 'recording'; mockStart(); }
  stop() {
    this.state = 'inactive';
    mockStop();
    this.onstop?.();
  }
  static isTypeSupported(type: string) { return type === 'audio/webm'; }
}

Object.defineProperty(global, 'MediaRecorder', { value: MockMediaRecorder, writable: true });

Object.defineProperty(global.navigator, 'mediaDevices', {
  value: {
    getUserMedia: vi.fn().mockResolvedValue({
      getTracks: () => [{ stop: vi.fn() }],
    }),
  },
  writable: true,
});

// ─── Mock HTMLMediaElement.play ───────────────────────────────────────────────
Object.defineProperty(HTMLMediaElement.prototype, 'play', {
  value: vi.fn().mockResolvedValue(undefined),
  writable: true,
});
