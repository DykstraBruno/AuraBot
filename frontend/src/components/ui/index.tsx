import React from 'react';
import clsx from 'clsx';

// ─── Button ───────────────────────────────────────────────────────────────────

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'ghost' | 'danger' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  fullWidth?: boolean;
}

export function Button({
  variant = 'primary', size = 'md', loading, fullWidth,
  children, className, disabled, ...props
}: ButtonProps) {
  const base = 'inline-flex items-center justify-center gap-2 font-medium transition-all duration-150 cursor-pointer border-0 select-none';

  const variants = {
    primary: 'bg-amber text-bg-base hover:bg-amber-dim active:scale-[0.98]',
    ghost:   'bg-transparent text-text-secondary hover:text-text-primary hover:bg-bg-hover',
    danger:  'bg-red/10 text-red hover:bg-red/20 border border-red/20',
    outline: 'bg-transparent border border-border text-text-primary hover:border-amber/40 hover:text-amber',
  };

  const sizes = {
    sm: 'h-8 px-3 text-sm rounded-md',
    md: 'h-10 px-5 text-sm rounded-lg',
    lg: 'h-12 px-7 text-base rounded-xl',
  };

  return (
    <button
      {...props}
      disabled={disabled || loading}
      className={clsx(base, variants[variant], sizes[size], fullWidth && 'w-full', (disabled || loading) && 'opacity-50 cursor-not-allowed', className)}
      style={{ fontFamily: 'var(--font-display)', letterSpacing: '0.01em', ...props.style }}
    >
      {loading && <Spinner size={16} />}
      {children}
    </button>
  );
}

// ─── Input ────────────────────────────────────────────────────────────────────

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  suffix?: React.ReactNode;
}

export function Input({ label, error, hint, suffix, className, id, ...props }: InputProps) {
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      {label && (
        <label
          htmlFor={inputId}
          style={{
            fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)',
            letterSpacing: '0.06em', textTransform: 'uppercase',
            fontFamily: 'var(--font-display)',
          }}
        >
          {label}
        </label>
      )}
      <div style={{ position: 'relative' }}>
        <input
          id={inputId}
          {...props}
          style={{
            width: '100%',
            height: '48px',
            background: 'var(--bg-elevated)',
            border: `1px solid ${error ? 'var(--red)' : 'var(--border)'}`,
            borderRadius: 'var(--radius-md)',
            padding: suffix ? '0 44px 0 16px' : '0 16px',
            color: 'var(--text-primary)',
            fontSize: '15px',
            fontFamily: 'var(--font-body)',
            outline: 'none',
            transition: 'border-color 0.15s',
            ...props.style,
          }}
          onFocus={e => {
            e.currentTarget.style.borderColor = error ? 'var(--red)' : 'var(--amber)';
            props.onFocus?.(e);
          }}
          onBlur={e => {
            e.currentTarget.style.borderColor = error ? 'var(--red)' : 'var(--border)';
            props.onBlur?.(e);
          }}
          className={className}
        />
        {suffix && (
          <span style={{
            position: 'absolute', right: '12px', top: '50%',
            transform: 'translateY(-50%)', color: 'var(--text-muted)',
            display: 'flex', alignItems: 'center',
          }}>
            {suffix}
          </span>
        )}
      </div>
      {error && (
        <p style={{ fontSize: '13px', color: 'var(--red)', display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span>⚠</span> {error}
        </p>
      )}
      {hint && !error && (
        <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{hint}</p>
      )}
    </div>
  );
}

// ─── Spinner ──────────────────────────────────────────────────────────────────

export function Spinner({ size = 20, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24" fill="none"
      style={{ animation: 'spin 0.75s linear infinite', flexShrink: 0 }}
    >
      <circle cx="12" cy="12" r="10" stroke={color} strokeWidth="2.5" strokeOpacity="0.2" />
      <path d="M12 2a10 10 0 0 1 10 10" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

// ─── Card ─────────────────────────────────────────────────────────────────────

export function Card({ children, className, style }: {
  children: React.ReactNode; className?: string; style?: React.CSSProperties;
}) {
  return (
    <div
      className={className}
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--shadow-card)',
        ...style,
      }}
    >
      {children}
    </div>
  );
}

// ─── Toast ────────────────────────────────────────────────────────────────────

export function Toast({ message, type = 'info' }: { message: string; type?: 'info' | 'error' | 'success' }) {
  const colors = { info: 'var(--amber)', error: 'var(--red)', success: 'var(--green)' };
  return (
    <div style={{
      position: 'fixed', bottom: '24px', left: '50%', transform: 'translateX(-50%)',
      background: 'var(--bg-elevated)', border: `1px solid ${colors[type]}30`,
      borderLeft: `3px solid ${colors[type]}`,
      borderRadius: 'var(--radius-md)', padding: '12px 20px',
      color: 'var(--text-primary)', fontSize: '14px',
      boxShadow: 'var(--shadow-card)',
      animation: 'slide-up 0.2s ease',
      zIndex: 9999, whiteSpace: 'nowrap',
    }}>
      {message}
    </div>
  );
}
