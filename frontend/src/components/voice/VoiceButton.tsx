import React, { useEffect, useRef, useState } from 'react';
import { useVoiceRecorder } from '../../hooks/useVoiceRecorder';
import { Spinner } from '../ui';

// Idiomas suportados com padrões de comando dedicados
const COMMAND_LANGUAGES = [
  { code: 'pt', label: '🇧🇷 Português' },
  { code: 'en', label: '🇺🇸 English' },
];

interface Props {
  onAudio: (blob: Blob, language: 'pt' | 'en') => void;
  disabled?: boolean;
  processingExternal?: boolean;
  defaultLanguage?: 'pt' | 'en';
}

// Barras de waveform animadas
function Waveform({ active }: { active: boolean }) {
  const bars = [0.4, 0.7, 1, 0.8, 0.5, 0.9, 0.6, 1, 0.7, 0.4];
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '2px', height: '24px' }}>
      {bars.map((h, i) => (
        <div
          key={i}
          style={{
            width: '3px',
            height: `${h * 100}%`,
            borderRadius: '2px',
            background: 'var(--amber)',
            transformOrigin: 'center',
            animation: active ? `waveform ${0.6 + i * 0.07}s ease-in-out infinite` : 'none',
            animationDelay: `${i * 0.06}s`,
            opacity: active ? 1 : 0.3,
            transition: 'opacity 0.2s',
          }}
        />
      ))}
    </div>
  );
}

function formatDuration(s: number) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

export function VoiceButton({ onAudio, disabled, processingExternal, defaultLanguage = 'pt' }: Props) {
  const { state, duration, start, stop, cancel, error } = useVoiceRecorder();
  const [language, setLanguage] = useState(defaultLanguage);
  const isProcessing = state === 'processing' || processingExternal;

  // Auto-stop em 60s
  const autoStopRef = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => {
    if (state === 'recording') {
      autoStopRef.current = setTimeout(async () => {
        const blob = await stop();
        if (blob) onAudio(blob, language);
      }, 60_000);
    }
    return () => clearTimeout(autoStopRef.current);
  }, [state, stop, onAudio]);

  const handleClick = async () => {
    if (isProcessing) return;

    if (state === 'recording') {
      clearTimeout(autoStopRef.current);
      const blob = await stop();
      if (blob) onAudio(blob, language);
    } else {
      await start();
    }
  };

  const isRecording = state === 'recording';

  return (
    <div style={styles.wrap}>
      {/* Seletor de idioma */}
      {!isRecording && !isProcessing && (
        <select
          value={language}
          onChange={e => setLanguage(e.target.value as 'pt' | 'en')}
          disabled={disabled}
          aria-label="Idioma do comando de voz"
          style={styles.langSelect}
        >
          {COMMAND_LANGUAGES.map(l => (
            <option key={l.code} value={l.code}>{l.label}</option>
          ))}
        </select>
      )}
      {/* Botão principal */}
      <button
        onClick={handleClick}
        disabled={disabled || isProcessing}
        aria-label={isRecording ? 'Parar gravação' : 'Iniciar gravação de voz'}
        style={{
          ...styles.btn,
          background: isRecording
            ? 'rgba(224,82,82,0.15)'
            : 'var(--amber-glow)',
          borderColor: isRecording ? 'var(--red)' : 'rgba(245,168,32,0.3)',
          boxShadow: isRecording
            ? '0 0 0 0 rgba(224,82,82,0.4)'
            : undefined,
          animation: isRecording ? 'pulse-ring 1.5s ease-out infinite' : 'none',
          cursor: disabled || isProcessing ? 'not-allowed' : 'pointer',
          opacity: disabled || isProcessing ? 0.5 : 1,
        }}
      >
        {isProcessing ? (
          <Spinner size={24} color="var(--amber)" />
        ) : isRecording ? (
          <span style={{ fontSize: '22px' }}>⏹</span>
        ) : (
          <span style={{ fontSize: '22px' }}>🎙</span>
        )}
      </button>

      {/* Waveform + timer */}
      <div style={styles.indicator}>
        {isRecording ? (
          <>
            <Waveform active />
            <span style={styles.timer}>{formatDuration(duration)}</span>
            <button
              onClick={cancel}
              style={styles.cancelBtn}
              aria-label="Cancelar gravação"
            >
              ✕
            </button>
          </>
        ) : isProcessing ? (
          <span style={styles.status}>Processando...</span>
        ) : (
          <span style={styles.status}>Toque para falar</span>
        )}
      </div>

      {error && (
        <p style={styles.error} role="alert">{error}</p>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrap: {
    display: 'flex', flexDirection: 'column',
    alignItems: 'center', gap: '12px',
  },
  btn: {
    width: '72px', height: '72px',
    borderRadius: '50%',
    border: '1.5px solid',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'none',
    transition: 'all 0.15s',
  },
  indicator: {
    display: 'flex', alignItems: 'center', gap: '8px',
    minHeight: '24px',
  },
  timer: {
    fontFamily: 'var(--font-display)',
    fontSize: '14px', fontWeight: 600,
    color: 'var(--red)', letterSpacing: '0.05em',
  },
  status: {
    fontSize: '13px', color: 'var(--text-muted)',
    fontFamily: 'var(--font-display)', letterSpacing: '0.04em',
  },
  cancelBtn: {
    background: 'none', border: 'none',
    color: 'var(--text-muted)', cursor: 'pointer',
    fontSize: '12px', padding: '2px 6px',
    borderRadius: '4px',
    transition: 'color 0.15s',
  },
  error: {
    fontSize: '12px', color: 'var(--red)',
    textAlign: 'center', maxWidth: '240px',
  },
  langSelect: {
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)',
    color: 'var(--text-secondary)',
    fontSize: '12px',
    padding: '4px 8px',
    cursor: 'pointer',
    outline: 'none',
  },
};
