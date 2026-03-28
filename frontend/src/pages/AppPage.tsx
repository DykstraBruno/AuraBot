import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { usePlayerStore } from '../store/playerStore';
import { useSingleTab } from '../hooks/useSingleTab';
import { api, getApiError } from '../services/api';
import { DuplicateTabModal } from '../components/ui/DuplicateTabModal';
import { VoiceButton } from '../components/voice/VoiceButton';
import { NowPlaying } from '../components/player/NowPlaying';
import { PlayerControls } from '../components/player/PlayerControls';
import { QueueList } from '../components/player/QueueList';
import { SearchBar } from '../components/player/SearchBar';
import { SpotifyConnect } from '../components/player/SpotifyConnect';
import { Button, Toast } from '../components/ui';
import { MusicSource, SearchResult } from '../types';

export default function AppPage() {
  const navigate = useNavigate();
  const { user, logout: storeLogout, tokens } = useAuthStore();
  const { current, queue, isPlaying, volume, setQueueState, setLoading, isLoading } = usePlayerStore();

  const [showDupTab, setShowDupTab] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'info' | 'error' | 'success' } | null>(null);
  const [voiceProcessing, setVoiceProcessing] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // ─── Single-tab enforcement ───────────────────────────────────────────────
  useSingleTab(() => setShowDupTab(true));

  // ─── Carrega estado da fila ao montar ─────────────────────────────────────
  useEffect(() => {
    loadQueueState();
  }, []);

  const loadQueueState = useCallback(async () => {
    try {
      const { data } = await api.get('/music/queue');
      setQueueState(data.data);
    } catch {
      /* silencia erros de estado inicial */
    }
  }, [setQueueState]);

  const showToast = useCallback((msg: string, type: 'info' | 'error' | 'success' = 'info') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }, []);

  // ─── Executar comando de player ───────────────────────────────────────────
  const handleCommand = useCallback(async (cmd: string, query?: string) => {
    setLoading(true);
    try {
      let res;

      switch (cmd) {
        case 'play':
          if (!query) return;
          res = await api.post('/music/play', { query });
          showToast(res.data.data.message, 'success');
          break;
        case 'stop':
          res = await api.post('/music/stop');
          showToast(res.data.data.message, 'info');
          break;
        case 'next':
          res = await api.post('/music/next');
          showToast(res.data.data.message, 'info');
          break;
        case 'turnup':
          res = await api.post('/music/volume', { direction: 'up' });
          showToast(res.data.data.message, 'info');
          break;
        case 'turndown':
          res = await api.post('/music/volume', { direction: 'down' });
          showToast(res.data.data.message, 'info');
          break;
      }

      await loadQueueState();
    } catch (err) {
      const apiErr = getApiError(err);
      showToast(apiErr.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [setLoading, showToast, loadQueueState]);

  // ─── Busca de músicas ─────────────────────────────────────────────────────
  const handleSearch = useCallback(async (query: string, source: MusicSource): Promise<SearchResult[]> => {
    try {
      const { data } = await api.get('/music/search', { params: { q: query, source, limit: 6 } });
      return data.data.results;
    } catch {
      return [];
    }
  }, []);

  // ─── Comando de voz ───────────────────────────────────────────────────────
  const handleVoiceAudio = useCallback(async (blob: Blob, language: 'pt' | 'en' = 'pt') => {
    setVoiceProcessing(true);
    try {
      const form = new FormData();
      form.append('audio', blob, 'voice.webm');
      form.append('generateAudio', 'true');
      form.append('language', language);

      const res = await api.post('/voice/command', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
        responseType: 'arraybuffer',
      });

      // Resposta em áudio (TTS) — toca automaticamente
      if (res.headers['content-type']?.includes('audio')) {
        const audioBlob = new Blob([res.data], { type: 'audio/mpeg' });
        const url = URL.createObjectURL(audioBlob);

        if (audioRef.current) {
          audioRef.current.src = url;
          await audioRef.current.play();
          audioRef.current.onended = () => URL.revokeObjectURL(url);
        }

        // Extrai mensagem do header
        const msg = decodeURIComponent(res.headers['x-response-text'] ?? '');
        if (msg) showToast(msg, 'success');
      } else {
        // Resposta em JSON
        const text = new TextDecoder().decode(res.data);
        const json = JSON.parse(text);
        showToast(json.data?.response ?? 'Comando executado', 'success');
      }

      await loadQueueState();
    } catch (err) {
      const apiErr = getApiError(err);
      showToast(apiErr.message, 'error');
    } finally {
      setVoiceProcessing(false);
    }
  }, [showToast, loadQueueState]);

  // ─── Logout ───────────────────────────────────────────────────────────────
  const handleLogout = useCallback(async () => {
    try {
      await api.post('/auth/logout', { refreshToken: tokens?.refreshToken });
    } catch { /* ignora */ }
    storeLogout();
    navigate('/login', { replace: true });
  }, [storeLogout, navigate, tokens]);

  return (
    <div style={styles.page}>
      {/* Fundo atmosférico */}
      <div style={styles.bg} aria-hidden />

      {/* Header */}
      <header style={styles.header}>
        <div style={styles.logo}>
          <div style={styles.logoIcon}>♪</div>
          <span style={styles.logoText}>AuraBot</span>
        </div>

        <div style={styles.userArea}>
          <span style={styles.username}>@{user?.username}</span>
          <Button variant="ghost" size="sm" onClick={handleLogout}>
            Sair
          </Button>
        </div>
      </header>

      {/* Main */}
      <main style={styles.main}>
        <div style={styles.grid}>

          {/* Coluna esquerda — Player */}
          <section style={styles.playerSection} aria-label="Player de música">

            {/* Now Playing */}
            <NowPlaying current={current} isPlaying={isPlaying} />

            {/* Controls */}
            <PlayerControls onCommand={handleCommand} loading={isLoading} />

            {/* Separador */}
            <div style={styles.divider} />

            {/* Voice command */}
            <div style={styles.voiceSection}>
              <p style={styles.sectionLabel}>Comando de voz</p>
              <p style={styles.sectionHint}>
                Diga: "Play nome da música", "Stop", "Next", "Turn up", "Turn down"
              </p>
              <div style={{ display: 'flex', justifyContent: 'center', marginTop: '16px' }}>
                <VoiceButton
                  onAudio={handleVoiceAudio}
                  disabled={isLoading}
                  processingExternal={voiceProcessing}
                  defaultLanguage="pt"
                />
              </div>
            </div>

            {/* Separador */}
            <div style={styles.divider} />

            {/* Search */}
            <div>
              <p style={styles.sectionLabel}>Buscar música</p>
              <div style={{ marginTop: '8px' }}>
                <SearchBar
                  onPlay={(q, _s) => handleCommand('play', q)}
                  onSearch={handleSearch}
                  disabled={isLoading}
                />
              </div>
            </div>

            {/* Spotify */}
            <div style={styles.divider} />
            <div>
              <p style={styles.sectionLabel}>Conta Spotify</p>
              <div style={{ marginTop: '8px' }}>
                <SpotifyConnect />
              </div>
            </div>
          </section>

          {/* Coluna direita — Fila */}
          <section style={styles.queueSection} aria-label="Fila de reprodução">
            <p style={styles.sectionLabel}>Fila de reprodução</p>
            <div style={{ marginTop: '12px' }}>
              <QueueList queue={queue} />
            </div>
          </section>
        </div>
      </main>

      {/* Audio element para TTS */}
      <audio ref={audioRef} style={{ display: 'none' }} aria-hidden />

      {/* Modal aba duplicada */}
      {showDupTab && (
        <DuplicateTabModal
          onClose={() => setShowDupTab(false)}
          onLogout={handleLogout}
        />
      )}

      {/* Toast */}
      {toast && <Toast message={toast.msg} type={toast.type} />}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100dvh',
    display: 'flex', flexDirection: 'column',
    position: 'relative',
  },
  bg: {
    position: 'fixed', inset: 0,
    background: `
      radial-gradient(ellipse 80% 40% at 20% 0%, rgba(245,168,32,0.05) 0%, transparent 60%),
      radial-gradient(ellipse 60% 40% at 80% 100%, rgba(245,168,32,0.03) 0%, transparent 60%)
    `,
    pointerEvents: 'none', zIndex: 0,
  },
  header: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '16px 24px',
    borderBottom: '1px solid var(--border)',
    background: 'rgba(8,8,9,0.8)',
    backdropFilter: 'blur(12px)',
    position: 'sticky', top: 0, zIndex: 50,
  },
  logo: { display: 'flex', alignItems: 'center', gap: '10px' },
  logoIcon: {
    width: '32px', height: '32px',
    background: 'var(--amber)', borderRadius: '8px',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: '16px', color: '#000',
  },
  logoText: {
    fontFamily: 'var(--font-display)', fontSize: '18px',
    fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em',
  },
  userArea: { display: 'flex', alignItems: 'center', gap: '12px' },
  username: { fontSize: '13px', color: 'var(--text-secondary)', fontFamily: 'var(--font-display)' },
  main: {
    flex: 1, padding: '24px',
    maxWidth: '1100px', margin: '0 auto',
    width: '100%', position: 'relative', zIndex: 1,
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1.2fr) minmax(0, 1fr)',
    gap: '24px',
    alignItems: 'start',
  },
  playerSection: {
    background: 'var(--bg-card)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-xl)',
    padding: '28px',
    display: 'flex', flexDirection: 'column', gap: '24px',
    boxShadow: 'var(--shadow-card)',
  },
  queueSection: {
    background: 'var(--bg-card)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-xl)',
    padding: '28px',
    boxShadow: 'var(--shadow-card)',
    maxHeight: 'calc(100dvh - 120px)',
    overflowY: 'auto',
    position: 'sticky', top: '80px',
  },
  divider: { height: '1px', background: 'var(--border)' },
  voiceSection: { display: 'flex', flexDirection: 'column', alignItems: 'center' },
  sectionLabel: {
    fontFamily: 'var(--font-display)',
    fontSize: '11px', fontWeight: 600,
    color: 'var(--text-muted)',
    letterSpacing: '0.08em', textTransform: 'uppercase',
  },
  sectionHint: {
    fontSize: '12px', color: 'var(--text-muted)',
    textAlign: 'center', marginTop: '6px', lineHeight: 1.5,
  },
};
