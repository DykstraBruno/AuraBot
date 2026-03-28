import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from '../store/authStore';

const BASE_URL = import.meta.env.VITE_API_URL ?? '/api';

export const api = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

// ─── Request: injeta access token ─────────────────────────────────────────────
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = useAuthStore.getState().tokens?.accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ─── Response: trata erros e faz refresh automático ──────────────────────────
let isRefreshing = false;
let refreshQueue: Array<(token: string) => void> = [];

api.interceptors.response.use(
  res => res,
  async (error: AxiosError) => {
    const original = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    if (error.response?.status === 401 && !original._retry) {
      const data = error.response.data as any;

      // Token expirado — tenta refresh
      if (data?.error?.code === 'TOKEN_EXPIRED') {
        if (isRefreshing) {
          return new Promise(resolve => {
            refreshQueue.push((newToken: string) => {
              original.headers.Authorization = `Bearer ${newToken}`;
              resolve(api(original));
            });
          });
        }

        original._retry = true;
        isRefreshing = true;

        try {
          const refreshToken = useAuthStore.getState().tokens?.refreshToken;
          if (!refreshToken) throw new Error('Sem refresh token');

          const { data: refreshData } = await axios.post(`${BASE_URL}/auth/refresh`, { refreshToken });
          const newTokens = refreshData.data.tokens;

          useAuthStore.getState().setTokens(newTokens);
          refreshQueue.forEach(cb => cb(newTokens.accessToken));
          refreshQueue = [];

          original.headers.Authorization = `Bearer ${newTokens.accessToken}`;
          return api(original);
        } catch {
          useAuthStore.getState().logout();
          refreshQueue = [];
          return Promise.reject(error);
        } finally {
          isRefreshing = false;
        }
      }

      // Outros 401 (não é token expirado) = logout
      if (data?.error?.code !== 'TOKEN_EXPIRED') {
        useAuthStore.getState().logout();
      }
    }

    return Promise.reject(error);
  }
);

// ─── Helpers de extração de erro ──────────────────────────────────────────────

export function getApiError(error: unknown): {
  message: string;
  code: string;
  fields?: Record<string, string>;
} {
  if (axios.isAxiosError(error) && error.response?.data?.error) {
    return error.response.data.error;
  }
  return { message: 'Ocorreu um erro inesperado.', code: 'UNKNOWN' };
}

export function getFieldError(error: unknown, field: string): string | undefined {
  const apiErr = getApiError(error);
  return apiErr.fields?.[field];
}
