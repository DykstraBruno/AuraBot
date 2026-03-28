import { useEffect, useRef, useCallback } from 'react';
import { useAuthStore } from '../store/authStore';

const TAB_KEY = 'aurabot_active_tab';
const HEARTBEAT_MS = 2000;
const STALE_MS = 6000;

/**
 * Garante que somente UMA aba autenticada fique ativa por vez.
 * Se outra aba abrir, esta exibe aviso e redireciona para login.
 */
export function useSingleTab(onDuplicate: () => void) {
  const tabId = useRef(`tab_${Date.now()}_${Math.random().toString(36).slice(2)}`);
  const intervalRef = useRef<ReturnType<typeof setInterval>>();
  const isAuthenticated = useAuthStore(s => s.isAuthenticated);

  const claimTab = useCallback(() => {
    localStorage.setItem(TAB_KEY, JSON.stringify({
      id: tabId.current,
      ts: Date.now(),
    }));
  }, []);

  const checkTab = useCallback(() => {
    const raw = localStorage.getItem(TAB_KEY);
    if (!raw) { claimTab(); return; }

    try {
      const { id, ts } = JSON.parse(raw);
      const isStale = Date.now() - ts > STALE_MS;

      if (id !== tabId.current && !isStale) {
        // Outra aba está ativa e não está stale
        onDuplicate();
      } else {
        claimTab();
      }
    } catch {
      claimTab();
    }
  }, [claimTab, onDuplicate]);

  useEffect(() => {
    if (!isAuthenticated) return;

    claimTab();
    checkTab();

    // Heartbeat: renova posse da aba a cada 2s
    intervalRef.current = setInterval(claimTab, HEARTBEAT_MS);

    // Escuta mudanças de outras abas
    const onStorage = (e: StorageEvent) => {
      if (e.key === TAB_KEY) checkTab();
      if (e.key === 'aurabot_logout') useAuthStore.getState().logout();
    };

    window.addEventListener('storage', onStorage);

    return () => {
      clearInterval(intervalRef.current);
      window.removeEventListener('storage', onStorage);
      // Libera a aba ao fechar/desmontar
      const raw = localStorage.getItem(TAB_KEY);
      if (raw) {
        try {
          const { id } = JSON.parse(raw);
          if (id === tabId.current) localStorage.removeItem(TAB_KEY);
        } catch {}
      }
    };
  }, [isAuthenticated, checkTab, claimTab]);
}
