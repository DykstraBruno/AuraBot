import React from 'react';
import { usePlayerStore } from '../../store/playerStore';

interface Props {
  onCommand: (cmd: string, query?: string) => void;
  loading: boolean;
}

export function PlayerControls({ onCommand, loading }: Props) {
  const { isPlaying, volume, current } = usePlayerStore();

  const btn = (
    label: string,
    icon: string,
    cmd: string,
    active?: boolean,
    disabled?: boolean
  ) => (
    <button
      onClick={() => onCommand(cmd)}
      disabled={loading || !!disabled}
      aria-label={label}
      title={label}
      style={{
        ...styles.btn,
        background: active ? 'var(--amber-glow)' : 'transparent',
        borderColor: active ? 'rgba(245,168,32,0.35)' : 'var(--border)',
        color: active ? 'var(--amber)' : disabled ? 'var(--text-muted)' : 'var(--text-secondary)',
        cursor: loading || disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.4 : 1,
      }}
    >
      <span style={{ fontSize: '18px' }}>{icon}</span>
      <span style={styles.label}>{label}</span>
    </button>
  );

  return (
    <div style={styles.wrap}>
      <div style={styles.volCard} aria-label={`Volume atual ${volume}%`}>
        <div style={styles.volHeader}>
          <span style={styles.volTitle}>Volume</span>
          <span style={styles.volLabel}>{volume}%</span>
        </div>

        <div style={styles.volGroup}>
          <button
            onClick={() => onCommand('turndown')}
            disabled={loading || volume <= 0}
            style={{ ...styles.volBtn, opacity: volume <= 0 ? 0.3 : 1 }}
            aria-label="Diminuir volume"
            title="Diminuir volume"
          >
            -
          </button>

          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={volume}
            readOnly
            aria-label="Indicador de volume"
            style={styles.volSlider}
          />

          <button
            onClick={() => onCommand('turnup')}
            disabled={loading || volume >= 100}
            style={{ ...styles.volBtn, opacity: volume >= 100 ? 0.3 : 1 }}
            aria-label="Aumentar volume"
            title="Aumentar volume"
          >
            +
          </button>
        </div>
      </div>

      <div style={styles.main}>
        {btn('Stop', 'S', 'stop', false, !current && !isPlaying)}
        {btn(isPlaying ? 'Tocando' : 'Play', 'P', 'play', isPlaying)}
        {btn('Proxima', 'N', 'next', false, !current)}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrap: {
    display: 'flex', flexDirection: 'column', gap: '20px',
  },
  main: {
    display: 'flex', gap: '12px', justifyContent: 'center',
  },
  btn: {
    display: 'flex', flexDirection: 'column',
    alignItems: 'center', gap: '4px',
    padding: '12px 20px',
    border: '1px solid',
    borderRadius: 'var(--radius-md)',
    background: 'none',
    transition: 'all 0.15s',
    minWidth: '80px',
  },
  label: {
    fontSize: '11px',
    fontFamily: 'var(--font-display)',
    letterSpacing: '0.05em',
    textTransform: 'uppercase',
  },
  volCard: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    padding: '12px',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)',
    background: 'var(--bg-elevated)',
  },
  volHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  volTitle: {
    fontSize: '11px',
    color: 'var(--text-muted)',
    fontFamily: 'var(--font-display)',
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
  },
  volGroup: {
    display: 'flex', alignItems: 'center', gap: '10px',
  },
  volLabel: {
    fontSize: '14px', color: 'var(--text-primary)',
    fontFamily: 'var(--font-display)',
    minWidth: '40px', textAlign: 'right',
    fontWeight: 600,
  },
  volBtn: {
    width: '28px',
    height: '28px',
    borderRadius: '8px',
    border: '1px solid var(--border)',
    background: 'transparent',
    color: 'var(--text-secondary)',
    fontSize: '16px',
    fontWeight: 700,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  volSlider: {
    flex: 1,
    accentColor: 'var(--amber)',
    cursor: 'default',
  },
};
