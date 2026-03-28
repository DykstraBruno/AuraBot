import React, { useEffect, useState } from 'react';
import { api, getApiError } from '../../services/api';
import { Button, Spinner, Toast } from '../ui';

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface SpotifyStatus {
  linked: boolean;
  spotifyId: string | null;
  isPremium: boolean | null;
  tokenValid: boolean;
}

interface SpotifyDevice {
  id: string;
  name: string;
  type: string;
  is_active: boolean;
}

// ─── Spotify Web Playback SDK (injeta o script dinamicamente) ─────────────────

function loadSpotifySDK(): Promise<void> {
  return new Promise((resolve) => {
    if (window.Spotify) { resolve(); return; }
    const script = document.createElement('script');
    script.src = 'https://sdk.scdn.co/spotify-player.js';
    script.async = true;
    document.body.appendChild(script);
    window.onSpotifyWebPlaybackSDKReady = resolve;
  });
}

// ─── Hook: Spotify Web Playback SDK ──────────────────────────────────────────

interface UseSpotifyPlayerOptions {
  accessToken: string | null;
  onReady?: (deviceId: string) => void;
  onTrackChange?: (track: any) => void;
  onError?: (msg: string) => void;
}

function useSpotifyPlayer({ accessToken, onReady, onTrackChange, onError }: UseSpotifyPlayerOptions) {
  const [player, setPlayer] = useState<any>(null);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [isPaused, setIsPaused] = useState(true);

  useEffect(() => {
    if (!accessToken) return;

    let spotifyPlayer: any;

    loadSpotifySDK().then(() => {
      spotifyPlayer = new window.Spotify.Player({
        name: 'AuraBot Web Player',
        getOAuthToken: (cb: (token: string) => void) => cb(accessToken),
        volume: 0.8,
      });

      spotifyPlayer.addListener('ready', ({ device_id }: { device_id: string }) => {
        setDeviceId(device_id);
        onReady?.(device_id);
      });

      spotifyPlayer.addListener('player_state_changed', (state: any) => {
        if (!state) return;
        setIsPaused(state.paused);
        onTrackChange?.(state.track_window?.current_track);
      });

      spotifyPlayer.addListener('not_ready', () => setDeviceId(null));

      spotifyPlayer.addListener('initialization_error', ({ message }: any) => {
        onError?.(`Erro ao inicializar player: ${message}`);
      });
      spotifyPlayer.addListener('authentication_error', () => {
        onError?.('Erro de autenticação Spotify. Reconecte sua conta.');
      });
      spotifyPlayer.addListener('account_error', () => {
        onError?.('Spotify Premium é necessário para usar o Web Player.');
      });

      spotifyPlayer.connect();
      setPlayer(spotifyPlayer);
    });

    return () => {
      spotifyPlayer?.disconnect();
    };
  }, [accessToken]);

  return { player, deviceId, isPaused };
}

// ─── Componente principal ─────────────────────────────────────────────────────

interface SpotifyConnectProps {
  onDeviceReady?: (deviceId: string) => void;
}

export function SpotifyConnect({ onDeviceReady }: SpotifyConnectProps) {
  const [status, setStatus] = useState<SpotifyStatus | null>(null);
  const [devices, setDevices] = useState<SpotifyDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ msg: string; type: 'error' | 'success' | 'info' } | null>(null);
  const [sdkToken, setSdkToken] = useState<string | null>(null);

  const showToast = (msg: string, type: 'error' | 'success' | 'info' = 'info') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Carrega status ao montar e checa parâmetros de URL (retorno do OAuth)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const spotifyResult = params.get('spotify');

    if (spotifyResult === 'connected') {
      showToast('Spotify conectado com sucesso!', 'success');
      // Remove parâmetro da URL sem recarregar
      window.history.replaceState({}, '', window.location.pathname);
    } else if (spotifyResult === 'error') {
      const msg = decodeURIComponent(params.get('msg') ?? 'Erro ao conectar Spotify');
      showToast(msg, 'error');
      window.history.replaceState({}, '', window.location.pathname);
    } else if (spotifyResult === 'cancelled') {
      showToast('Conexão com Spotify cancelada.', 'info');
      window.history.replaceState({}, '', window.location.pathname);
    }

    loadStatus();
  }, []);

  const loadStatus = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/spotify/status');
      setStatus(data.data);

      // Se vinculado e Premium, carrega o token para o Web Playback SDK
      if (data.data.linked && data.data.isPremium) {
        // Usamos o token do authStore — o SDK precisa do token do USUÁRIO SPOTIFY
        // que está salvo no banco. Criamos um endpoint dedicado para isso.
        try {
          const { data: tokenData } = await api.get('/spotify/player-token');
          setSdkToken(tokenData.data.accessToken);
        } catch {
          // Premium mas token expirado — status será atualizado
        }
      }

      if (data.data.linked) {
        loadDevices();
      }
    } catch (err) {
      const e = getApiError(err);
      // Não mostra erro se simplesmente não está vinculado
      if (e.code !== 'SPOTIFY_NOT_LINKED') {
        showToast(e.message, 'error');
      }
      setStatus({ linked: false, spotifyId: null, isPremium: null, tokenValid: false });
    } finally {
      setLoading(false);
    }
  };

  const loadDevices = async () => {
    try {
      const { data } = await api.get('/spotify/devices');
      setDevices(data.data.devices ?? []);
    } catch {
      setDevices([]);
    }
  };

  const handleConnect = async () => {
    try {
      const { data } = await api.get('/spotify/auth-url');
      // Abre o OAuth do Spotify na mesma aba
      window.location.href = data.data.url;
    } catch (err) {
      showToast(getApiError(err).message, 'error');
    }
  };

  const handleDisconnect = async () => {
    try {
      await api.delete('/spotify/disconnect');
      setStatus({ linked: false, spotifyId: null, isPremium: null, tokenValid: false });
      setSdkToken(null);
      showToast('Spotify desvinculado.', 'info');
    } catch (err) {
      showToast(getApiError(err).message, 'error');
    }
  };

  // Web Playback SDK — só inicializa se Premium
  const { deviceId, isPaused, player } = useSpotifyPlayer({
    accessToken: sdkToken,
    onReady: (id) => {
      onDeviceReady?.(id);
      loadDevices();
    },
    onError: (msg) => showToast(msg, 'error'),
  });

  if (loading) {
    return (
      <div style={styles.wrap}>
        <Spinner size={20} color="var(--text-muted)" />
      </div>
    );
  }

  return (
    <div style={styles.wrap}>
      {!status?.linked ? (
        // ── Não vinculado ─────────────────────────────────────────────────
        <div style={styles.card}>
          <div style={styles.spotifyIcon}>♫</div>
          <div>
            <p style={styles.title}>Conectar Spotify</p>
            <p style={styles.sub}>
              Vincule sua conta para reproduzir músicas completas.
              Requer Spotify Premium.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={handleConnect}
            style={{ borderColor: '#1ed760', color: '#1ed760' }}>
            Conectar
          </Button>
        </div>
      ) : (
        // ── Vinculado ─────────────────────────────────────────────────────
        <div style={styles.card}>
          <div style={{ ...styles.spotifyIcon, background: '#1ed76015' }}>♫</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <p style={styles.title}>Spotify conectado</p>
              {status.isPremium === true && (
                <span style={styles.premiumBadge}>Premium</span>
              )}
              {status.isPremium === false && (
                <span style={styles.freeBadge}>Free</span>
              )}
            </div>

            {status.isPremium === false && (
              <p style={{ ...styles.sub, color: 'var(--amber)' }}>
                ⚠ Spotify Premium é necessário para reprodução completa.
                Sem Premium, apenas prévia de 30s está disponível.
              </p>
            )}

            {status.isPremium === true && deviceId && (
              <p style={{ ...styles.sub, color: 'var(--green)' }}>
                ✓ AuraBot Web Player ativo
              </p>
            )}

            {status.isPremium === true && !deviceId && (
              <p style={styles.sub}>Inicializando player...</p>
            )}

            {/* Dispositivos disponíveis */}
            {devices.length > 0 && (
              <div style={styles.devices}>
                {devices.map(d => (
                  <span key={d.id} style={{
                    ...styles.deviceBadge,
                    borderColor: d.is_active ? '#1ed760' : 'var(--border)',
                    color: d.is_active ? '#1ed760' : 'var(--text-muted)',
                  }}>
                    {d.type === 'Computer' ? '💻' : d.type === 'Smartphone' ? '📱' : '📻'}{' '}
                    {d.name}
                  </span>
                ))}
              </div>
            )}
          </div>

          <Button variant="ghost" size="sm" onClick={handleDisconnect}
            style={{ color: 'var(--text-muted)', flexShrink: 0 }}>
            Desvincular
          </Button>
        </div>
      )}

      {toast && <Toast message={toast.msg} type={toast.type} />}
    </div>
  );
}

// Tipos globais para o SDK do Spotify
declare global {
  interface Window {
    Spotify: any;
    onSpotifyWebPlaybackSDKReady: () => void;
  }
}

const styles: Record<string, React.CSSProperties> = {
  wrap: { width: '100%' },
  card: {
    display: 'flex', alignItems: 'center', gap: '14px',
    padding: '14px 16px',
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)',
  },
  spotifyIcon: {
    width: '36px', height: '36px', flexShrink: 0,
    background: 'rgba(30,215,96,0.1)',
    borderRadius: '8px',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: '18px', color: '#1ed760',
  },
  title: {
    fontSize: '14px', fontWeight: 500,
    color: 'var(--text-primary)',
    fontFamily: 'var(--font-display)',
  },
  sub: {
    fontSize: '12px', color: 'var(--text-muted)',
    marginTop: '2px', lineHeight: 1.4,
  },
  premiumBadge: {
    fontSize: '10px', fontWeight: 600,
    padding: '1px 6px', borderRadius: '10px',
    background: 'rgba(30,215,96,0.15)',
    color: '#1ed760',
    fontFamily: 'var(--font-display)',
    letterSpacing: '0.04em',
  },
  freeBadge: {
    fontSize: '10px', fontWeight: 600,
    padding: '1px 6px', borderRadius: '10px',
    background: 'rgba(245,168,32,0.15)',
    color: 'var(--amber)',
    fontFamily: 'var(--font-display)',
  },
  devices: {
    display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '6px',
  },
  deviceBadge: {
    fontSize: '11px', padding: '2px 8px',
    border: '1px solid',
    borderRadius: '20px',
  },
};
