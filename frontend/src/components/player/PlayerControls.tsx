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
      {/* Volume down */}
      <div style={styles.volGroup}>
        <span style={styles.volLabel}>{volume}%</span>
        <button
          onClick={() => onCommand('turndown')}
          disabled={loading || volume <= 0}
          style={{ ...styles.volBtn, opacity: volume <= 0 ? 0.3 : 1 }}
          aria-label="Diminuir volume"
        >
          🔉
        </button>
        <div style={styles.volBar}>
          <div style={{ ...styles.volFill, width: `${volume}%` }} />
        </div>
        <button
          onClick={() => onCommand('turnup')}
          disabled={loading || volume >= 100}
          style={{ ...styles.volBtn, opacity: volume >= 100 ? 0.3 : 1 }}
          aria-label="Aumentar volume"
        >
          🔊
        </button>
      </div>

      {/* Controles principais */}
      <div style={styles.main}>
        {btn('Stop', '⏹', 'stop', false, !current && !isPlaying)}
        {btn(isPlaying ? 'Tocando' : 'Play', isPlaying ? '▶' : '▶', 'play', isPlaying)}
        {btn('Próxima', '⏭', 'next', false, !current)}
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
  volGroup: {
    display: 'flex', alignItems: 'center', gap: '8px',
  },
  volLabel: {
    fontSize: '12px', color: 'var(--text-muted)',
    fontFamily: 'var(--font-display)',
    minWidth: '32px', textAlign: 'right',
  },
  volBtn: {
    background: 'none', border: 'none',
    fontSize: '16px', cursor: 'pointer', padding: '4px',
  },
  volBar: {
    flex: 1, height: '4px',
    background: 'var(--border)', borderRadius: '2px',
    overflow: 'hidden',
  },
  volFill: {
    height: '100%',
    background: 'var(--amber)',
    borderRadius: '2px',
    transition: 'width 0.2s',
  },
};
