import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { User, TokenPair } from '../types';

interface AuthState {
  user: User | null;
  tokens: TokenPair | null;
  isAuthenticated: boolean;

  setAuth: (user: User, tokens: TokenPair) => void;
  setTokens: (tokens: TokenPair) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      tokens: null,
      isAuthenticated: false,

      setAuth: (user, tokens) =>
        set({ user, tokens, isAuthenticated: true }),

      setTokens: (tokens) =>
        set({ tokens }),

      logout: () => {
        set({ user: null, tokens: null, isAuthenticated: false });
        // Notifica outras abas
        localStorage.setItem('aurabot_logout', Date.now().toString());
      },
    }),
    {
      name: 'aurabot_auth',
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ user: s.user, tokens: s.tokens, isAuthenticated: s.isAuthenticated }),
    }
  )
);
