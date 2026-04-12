import { describe, it, expect, beforeEach } from 'vitest';
import { act } from 'react';
import { useAuthStore } from '../../store/authStore';
import type { User, TokenPair } from '../../types';

// ─── Factories ────────────────────────────────────────────────────────────────

const makeUser = (overrides: Partial<User> = {}): User => ({
  id: 'user-1',
  email: 'test@example.com',
  username: 'testuser',
  displayName: 'Test User',
  avatarUrl: null,
  emailVerified: false,
  ...overrides,
});

const makeTokens = (overrides: Partial<TokenPair> = {}): TokenPair => ({
  accessToken:  'access-abc123',
  refreshToken: 'refresh-abc123',
  expiresIn:    900,
  ...overrides,
});

// ─── Suite ────────────────────────────────────────────────────────────────────

describe('authStore', () => {
  beforeEach(() => {
    act(() => {
      useAuthStore.setState({ user: null, tokens: null, isAuthenticated: false });
    });
    localStorage.clear();
  });

  describe('estado inicial', () => {
    it('começa com user=null e isAuthenticated=false', () => {
      const { user, isAuthenticated } = useAuthStore.getState();
      expect(user).toBeNull();
      expect(isAuthenticated).toBe(false);
    });

    it('começa com tokens=null', () => {
      expect(useAuthStore.getState().tokens).toBeNull();
    });
  });

  describe('setAuth', () => {
    it('define user, tokens e isAuthenticated=true', () => {
      const user   = makeUser();
      const tokens = makeTokens();

      act(() => useAuthStore.getState().setAuth(user, tokens));

      const state = useAuthStore.getState();
      expect(state.user).toEqual(user);
      expect(state.tokens).toEqual(tokens);
      expect(state.isAuthenticated).toBe(true);
    });

    it('sobrescreve user existente', () => {
      const first  = makeUser({ email: 'first@example.com' });
      const second = makeUser({ email: 'second@example.com' });

      act(() => useAuthStore.getState().setAuth(first, makeTokens()));
      act(() => useAuthStore.getState().setAuth(second, makeTokens()));

      expect(useAuthStore.getState().user!.email).toBe('second@example.com');
    });
  });

  describe('setTokens', () => {
    it('atualiza apenas os tokens sem alterar o user', () => {
      const user        = makeUser();
      const firstTokens = makeTokens({ accessToken: 'first-access' });
      const newTokens   = makeTokens({ accessToken: 'new-access' });

      act(() => useAuthStore.getState().setAuth(user, firstTokens));
      act(() => useAuthStore.getState().setTokens(newTokens));

      const state = useAuthStore.getState();
      expect(state.tokens!.accessToken).toBe('new-access');
      expect(state.user).toEqual(user);  // user não muda
    });

    it('não altera isAuthenticated', () => {
      act(() => useAuthStore.getState().setAuth(makeUser(), makeTokens()));
      act(() => useAuthStore.getState().setTokens(makeTokens({ accessToken: 'new' })));

      expect(useAuthStore.getState().isAuthenticated).toBe(true);
    });
  });

  describe('logout', () => {
    it('zera user, tokens e isAuthenticated', () => {
      act(() => useAuthStore.getState().setAuth(makeUser(), makeTokens()));
      act(() => useAuthStore.getState().logout());

      const state = useAuthStore.getState();
      expect(state.user).toBeNull();
      expect(state.tokens).toBeNull();
      expect(state.isAuthenticated).toBe(false);
    });

    it('escreve no localStorage para sinalizar outras abas', () => {
      act(() => useAuthStore.getState().setAuth(makeUser(), makeTokens()));
      act(() => useAuthStore.getState().logout());

      const logoutFlag = localStorage.getItem('aurabot_logout');
      expect(logoutFlag).not.toBeNull();
      expect(Number(logoutFlag)).toBeGreaterThan(0);
    });

    it('não lança erro quando chamado sem usuário logado', () => {
      expect(() => act(() => useAuthStore.getState().logout())).not.toThrow();
    });
  });
});
