import React, { useState, useRef } from 'react';
import { MusicSource, SearchResult } from '../../types';
import { Button, Spinner } from '../ui';

interface Props {
  onPlay: (query: string, source: MusicSource) => void;
  onSearch: (query: string, source: MusicSource) => Promise<SearchResult[]>;
  disabled?: boolean;
}

export function SearchBar({ onPlay, onSearch, disabled }: Props) {
  const [query, setQuery] = useState('');
  const [source, setSource] = useState<MusicSource>('all');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const wrapRef = useRef<HTMLDivElement>(null);

  const handleChange = (value: string) => {
    setQuery(value);
    clearTimeout(debounceRef.current);

    if (value.trim().length < 2) {
      setResults([]);
      setShowDropdown(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await onSearch(value, source);
        setResults(res.slice(0, 6));
        setShowDropdown(res.length > 0);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 400);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setShowDropdown(false);
    onPlay(query.trim(), source);
    setQuery('');
    setResults([]);
  };

  const handleSelect = (result: SearchResult) => {
    setShowDropdown(false);
    setQuery('');
    setResults([]);
    onPlay(result.title + ' ' + result.artist, result.source);
  };

  // Fecha ao clicar fora
  React.useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <form onSubmit={handleSubmit} style={styles.form} role="search">
        {/* Source selector */}
        <div style={styles.sourceWrap}>
          {(['all', 'spotify', 'youtube'] as MusicSource[]).map(s => (
            <button
              key={s}
              type="button"
              onClick={() => setSource(s)}
              style={{
                ...styles.sourceBtn,
                background: source === s ? 'var(--amber-glow)' : 'transparent',
                color: source === s ? 'var(--amber)' : 'var(--text-muted)',
                borderColor: source === s ? 'rgba(245,168,32,0.3)' : 'transparent',
              }}
            >
              {s === 'all' ? 'Todos' : s === 'spotify' ? '♫ Spotify' : '▶ YouTube'}
            </button>
          ))}
        </div>

        {/* Input */}
        <div style={styles.inputWrap}>
          <input
            type="search"
            value={query}
            onChange={e => handleChange(e.target.value)}
            placeholder='Nome da música, artista... ou "Play: " para voz'
            disabled={disabled}
            aria-label="Buscar música"
            autoComplete="off"
            style={styles.input}
            onFocus={() => results.length > 0 && setShowDropdown(true)}
          />
          {searching && (
            <span style={styles.inputSpinner}>
              <Spinner size={16} color="var(--amber)" />
            </span>
          )}
        </div>

        <Button
          type="submit"
          disabled={!query.trim() || disabled}
          style={{ flexShrink: 0 }}
        >
          ▶ Play
        </Button>
      </form>

      {/* Dropdown de resultados */}
      {showDropdown && results.length > 0 && (
        <ul style={styles.dropdown} role="listbox" aria-label="Sugestões de músicas">
          {results.map(r => (
            <li
              key={r.id}
              role="option"
              aria-selected={false}
              onClick={() => handleSelect(r)}
              style={styles.dropItem}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              {r.coverUrl && (
                <img src={r.coverUrl} alt="" aria-hidden style={styles.dropThumb} />
              )}
              <div style={{ minWidth: 0 }}>
                <p style={styles.dropTitle}>{r.title}</p>
                <p style={styles.dropArtist}>{r.artist}</p>
              </div>
              <span style={{
                fontSize: '11px', marginLeft: 'auto', flexShrink: 0,
                color: r.source === 'spotify' ? '#1ed760' : '#ff4444',
                fontFamily: 'var(--font-display)',
              }}>
                {r.source === 'spotify' ? '♫' : '▶'}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  form: {
    display: 'flex', gap: '8px', alignItems: 'center',
    flexWrap: 'wrap',
  },
  sourceWrap: {
    display: 'flex', gap: '4px',
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)',
    padding: '3px',
  },
  sourceBtn: {
    border: '1px solid transparent',
    borderRadius: '6px',
    padding: '4px 10px',
    fontSize: '12px',
    fontFamily: 'var(--font-display)',
    cursor: 'pointer',
    transition: 'all 0.12s',
    background: 'none',
  },
  inputWrap: { flex: 1, position: 'relative', minWidth: '180px' },
  input: {
    width: '100%', height: '40px',
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)',
    padding: '0 40px 0 14px',
    color: 'var(--text-primary)',
    fontSize: '14px',
    fontFamily: 'var(--font-body)',
    outline: 'none',
  },
  inputSpinner: {
    position: 'absolute', right: '12px', top: '50%',
    transform: 'translateY(-50%)',
  },
  dropdown: {
    position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0,
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)',
    listStyle: 'none',
    overflow: 'hidden',
    zIndex: 100,
    boxShadow: 'var(--shadow-card)',
    animation: 'slide-up 0.15s ease',
  },
  dropItem: {
    display: 'flex', alignItems: 'center', gap: '10px',
    padding: '10px 14px',
    cursor: 'pointer', transition: 'background 0.1s',
  },
  dropThumb: {
    width: '36px', height: '36px',
    borderRadius: '6px', objectFit: 'cover', flexShrink: 0,
  },
  dropTitle: {
    fontSize: '13px', fontWeight: 500,
    color: 'var(--text-primary)',
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  },
  dropArtist: {
    fontSize: '12px', color: 'var(--text-secondary)',
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  },
};
