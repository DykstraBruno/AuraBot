import React from 'react';
import { QueueTrack } from '../../types';

interface Props {
  queue: QueueTrack[];
  onSkipTo?: (queueId: string) => void;
}

function formatDuration(secs?: number | null) {
  if (!secs) return '';
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function QueueList({ queue, onSkipTo }: Props) {
  if (queue.length === 0) {
    return (
      <div style={styles.empty}>
        <span style={{ fontSize: '24px', opacity: 0.4 }}>🎵</span>
        <p>Fila vazia</p>
      </div>
    );
  }

  return (
    <div style={styles.wrap}>
      <p style={styles.header}>
        Na fila — <strong style={{ color: 'var(--text-primary)' }}>{queue.length}</strong>
        {queue.length === 1 ? ' música' : ' músicas'}
      </p>
      <ul style={styles.list} role="list">
        {queue.map((item, idx) => (
          <li
            key={item.queueId}
            style={styles.item}
            onClick={() => onSkipTo?.(item.queueId)}
            role={onSkipTo ? 'button' : undefined}
            tabIndex={onSkipTo ? 0 : undefined}
            onKeyDown={e => e.key === 'Enter' && onSkipTo?.(item.queueId)}
            aria-label={`${idx + 2}ª na fila: ${item.track.title} — ${item.track.artist}`}
          >
            <span style={styles.pos}>{idx + 2}</span>

            {item.track.coverUrl ? (
              <img
                src={item.track.coverUrl}
                alt=""
                aria-hidden
                style={styles.thumb}
              />
            ) : (
              <div style={{ ...styles.thumb, background: 'var(--bg-hover)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: '14px', opacity: 0.4 }}>♪</span>
              </div>
            )}

            <div style={styles.trackInfo}>
              <p style={styles.trackTitle}>{item.track.title}</p>
              <p style={styles.trackArtist}>{item.track.artist}</p>
            </div>

            <div style={styles.right}>
              <span style={{
                ...styles.srcBadge,
                color: item.source === 'spotify' ? '#1ed760' : '#ff4444',
              }}>
                {item.source === 'spotify' ? '♫' : '▶'}
              </span>
              {item.track.duration && (
                <span style={styles.dur}>{formatDuration(item.track.duration)}</span>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrap: { display: 'flex', flexDirection: 'column', gap: '8px' },
  header: {
    fontSize: '12px', color: 'var(--text-muted)',
    fontFamily: 'var(--font-display)',
    letterSpacing: '0.06em', textTransform: 'uppercase',
    marginBottom: '4px',
  },
  list: { listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '2px' },
  item: {
    display: 'flex', alignItems: 'center', gap: '12px',
    padding: '8px 10px',
    borderRadius: 'var(--radius-md)',
    cursor: 'pointer',
    transition: 'background 0.12s',
  },
  pos: {
    fontSize: '12px', color: 'var(--text-muted)',
    fontFamily: 'var(--font-display)',
    minWidth: '16px', textAlign: 'center',
  },
  thumb: {
    width: '36px', height: '36px',
    borderRadius: '6px', objectFit: 'cover',
    flexShrink: 0,
  },
  trackInfo: { flex: 1, minWidth: 0 },
  trackTitle: {
    fontSize: '13px', fontWeight: 500,
    color: 'var(--text-primary)',
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  },
  trackArtist: {
    fontSize: '12px', color: 'var(--text-secondary)',
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  },
  right: {
    display: 'flex', flexDirection: 'column',
    alignItems: 'flex-end', gap: '2px', flexShrink: 0,
  },
  srcBadge: { fontSize: '14px' },
  dur: { fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-display)' },
  empty: {
    display: 'flex', flexDirection: 'column',
    alignItems: 'center', gap: '8px',
    padding: '32px 0',
    color: 'var(--text-muted)', fontSize: '13px',
  },
};
