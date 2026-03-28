import React from 'react';
import { Button } from '../ui';

interface Props {
  onClose: () => void;
  onLogout: () => void;
}

export function DuplicateTabModal({ onClose, onLogout }: Props) {
  return (
    <div style={styles.overlay} role="dialog" aria-modal aria-labelledby="dup-title">
      <div style={styles.modal}>
        {/* Ícone */}
        <div style={styles.icon} aria-hidden>⚠</div>

        <h2 id="dup-title" style={styles.title}>
          Já existe uma aba aberta!
        </h2>

        <p style={styles.body}>
          O AuraBot só pode ser usado em uma aba por vez. Feche esta aba ou encerre a sessão
          nas outras abas para continuar aqui.
        </p>

        <div style={styles.actions}>
          <Button variant="outline" onClick={onLogout} style={{ flex: 1 }}>
            Sair de todas as abas
          </Button>
          <Button variant="primary" onClick={onClose} style={{ flex: 1 }}>
            Usar esta aba
          </Button>
        </div>

        <p style={styles.hint}>
          Dica: Fechar as outras abas resolve automaticamente.
        </p>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed', inset: 0, zIndex: 9000,
    background: 'rgba(0,0,0,0.75)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: '24px',
    backdropFilter: 'blur(4px)',
  },
  modal: {
    width: '100%', maxWidth: '400px',
    background: 'var(--bg-elevated)',
    border: '1px solid rgba(245,168,32,0.25)',
    borderRadius: 'var(--radius-xl)',
    padding: '36px 32px',
    boxShadow: '0 0 40px rgba(245,168,32,0.08), var(--shadow-card)',
    animation: 'slide-up 0.2s ease',
  },
  icon: {
    fontSize: '36px', textAlign: 'center',
    marginBottom: '16px',
    filter: 'drop-shadow(0 0 8px rgba(245,168,32,0.5))',
  },
  title: {
    fontFamily: 'var(--font-display)',
    fontSize: '18px', fontWeight: 700,
    color: 'var(--amber)',
    textAlign: 'center', marginBottom: '12px',
  },
  body: {
    fontSize: '14px', color: 'var(--text-secondary)',
    textAlign: 'center', lineHeight: 1.65,
    marginBottom: '28px',
  },
  actions: {
    display: 'flex', gap: '12px', marginBottom: '16px',
  },
  hint: {
    fontSize: '12px', color: 'var(--text-muted)',
    textAlign: 'center',
  },
};
