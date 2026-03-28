import React from 'react';
import { QueueTrack } from '../../types';

interface Props {
  current: QueueTrack | null;
  isPlaying: boolean;
}

function formatDuration(secs?: number | null) {
  if (!secs) return '--:--';
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function NowPlaying({ current, isPlaying }: Props) {
  const track = current?.track;

  return (
    <div style={styles.wrap}>
      {/* Album art */}
      <div style={styles.artWrap}>
        {track?.coverUrl ? (
          <img
            src={track.coverUrl}
            alt={`Capa de ${track.title}`}
            style={{
              ...styles.art,
              animation: isPlaying ? 'none' : 'none',
            }}
          />
        ) : (
          <div style={styles.artPlaceholder}>
            <span style={{ fontSize: '40px' }}>♪</span>
          </div>
        )}
        {/* Spinner de reprodução sobreposto */}
        {isPlaying && (
          <div style={styles.playingDot} aria-label="Reproduzindo" />
        )}
      </div>

      {/* Info */}
      <div style={styles.info}>
        {track ? (
          <>
            <p style={styles.title} title={track.title}>{track.title}</p>
            <p style={styles.artist} title={track.artist}>{track.artist}</p>
            {track.album && (
              <p style={styles.album}>{track.album}</p>
            )}
            <div style={styles.meta}>
              <span style={{
                ...styles.badge,
                background: current?.source === 'spotify'
                  ? 'rgba(30,215,96,0.12)'
                  : 'rgba(255,0,0,0.12)',
                color: current?.source === 'spotify' ? '#1ed760' : '#ff4444',
              }}>
                {current?.source === 'spotify' ? '♫ Spotify' : '▶ YouTube'}
              </span>
              <span style={styles.duration}>
                {formatDuration(track.duration)}
              </span>
            </div>
          </>
        ) : (
          <div style={styles.empty}>
            <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
              Nenhuma música tocando
            </p>
            <p style={{ color: 'var(--text-muted)', fontSize: '12px', marginTop: '4px' }}>
              Use a voz ou o campo de busca para começar
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrap: {
    display: 'flex', alignItems: 'center', gap: '20px',
    padding: '20px',
    background: 'var(--bg-elevated)',
    borderRadius: 'var(--radius-lg)',
    border: '1px solid var(--border)',
  },
  artWrap: {
    position: 'relative', flexShrink: 0,
  },
  art: {
    width: '88px', height: '88px',
    borderRadius: 'var(--radius-md)',
    objectFit: 'cover',
    display: 'block',
  },
  artPlaceholder: {
    width: '88px', height: '88px',
    borderRadius: 'var(--radius-md)',
    background: 'var(--bg-card)',
    border: '1px solid var(--border)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: 'var(--text-muted)',
  },
  playingDot: {
    position: 'absolute', bottom: '6px', right: '6px',
    width: '10px', height: '10px',
    borderRadius: '50%',
    background: 'var(--amber)',
    animation: 'pulse-ring 1.5s ease-out infinite',
  },
  info: { flex: 1, minWidth: 0 },
  title: {
    fontFamily: 'var(--font-display)',
    fontSize: '16px', fontWeight: 600,
    color: 'var(--text-primary)',
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
    marginBottom: '4px',
  },
  artist: {
    fontSize: '14px', color: 'var(--text-secondary)',
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
    marginBottom: '2px',
  },
  album: {
    fontSize: '12px', color: 'var(--text-muted)',
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
    marginBottom: '8px',
  },
  meta: { display: 'flex', alignItems: 'center', gap: '8px' },
  badge: {
    fontSize: '11px', fontWeight: 600,
    padding: '2px 8px', borderRadius: '20px',
    fontFamily: 'var(--font-display)',
  },
  duration: {
    fontSize: '12px', color: 'var(--text-muted)',
    fontFamily: 'var(--font-display)',
  },
  empty: { padding: '8px 0' },
};
