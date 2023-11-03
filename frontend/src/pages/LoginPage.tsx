import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, getApiError } from '../services/api';
import { useAuthStore } from '../store/authStore';
import { Button, Input, Toast } from '../components/ui';
import {
  useFormValidation,
  validateEmailClient,
  validatePasswordClient,
} from '../hooks/useValidation';

export default function LoginPage() {
  const navigate = useNavigate();
  const setAuth = useAuthStore(s => s.setAuth);

  const [form, setForm] = useState({ emailOrUsername: '', password: '' });
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'error' | 'success' } | null>(null);

  const { errors, touched, touch, validateAll, setServerErrors } = useFormValidation({
    emailOrUsername: {
      required: true,
      validator: (v) => {
        // aceita username ou email
        if (v.includes('@')) return validateEmailClient(v);
        if (v.length < 3) return 'Nome de usuário inválido';
        return null;
      },
    },
    password: { required: true },
  });

  const showToast = (msg: string, type: 'error' | 'success' = 'error') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateAll(form)) return;

    setLoading(true);
    try {
      const { data } = await api.post('/auth/login', form);
      setAuth(data.data.user, data.data.tokens);
      navigate('/app', { replace: true });
    } catch (err) {
      const apiErr = getApiError(err);

      if (apiErr.code === 'ACCOUNT_LOCKED') {
        showToast(apiErr.message);
      } else if (apiErr.message === 'senha incorreta') {
        setServerErrors({ password: 'senha incorreta' });
      } else if (apiErr.fields) {
        setServerErrors(apiErr.fields);
      } else {
        showToast(apiErr.message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.bg} aria-hidden />

      <div style={styles.card}>
        {/* Logo */}
        <div style={styles.logoWrap}>
          <div style={styles.logoIcon}>♪</div>
          <h1 style={styles.logoText}>AuraBot</h1>
        </div>

        <h2 style={styles.heading}>Entrar na sua conta</h2>
        <p style={styles.sub}>Controle sua música com voz</p>

        <form onSubmit={handleSubmit} noValidate style={styles.form}>
          <Input
            label="Email ou usuário"
            type="text"
            autoComplete="username"
            autoFocus
            value={form.emailOrUsername}
            onChange={e => setForm(f => ({ ...f, emailOrUsername: e.target.value }))}
            onBlur={e => touch('emailOrUsername', e.target.value)}
            error={touched.emailOrUsername ? errors.emailOrUsername : undefined}
            placeholder="seu@email.com ou @usuario"
          />

          <Input
            label="Senha"
            type={showPw ? 'text' : 'password'}
            autoComplete="current-password"
            value={form.password}
            onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
            onBlur={e => touch('password', e.target.value)}
            error={touched.password ? errors.password : undefined}
            placeholder="••••••••"
            suffix={
              <button
                type="button"
                onClick={() => setShowPw(v => !v)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: '16px' }}
                aria-label={showPw ? 'Ocultar senha' : 'Mostrar senha'}
              >
                {showPw ? '🙈' : '👁'}
              </button>
            }
          />

          <div style={{ textAlign: 'right', marginTop: '-4px' }}>
            <Link to="/forgot-password" style={styles.link}>Esqueci minha senha</Link>
          </div>

          <Button type="submit" loading={loading} fullWidth size="lg" style={{ marginTop: '8px' }}>
            {loading ? 'Entrando...' : 'Entrar'}
          </Button>
        </form>

        <p style={styles.footer}>
          Não tem conta?{' '}
          <Link to="/register" style={styles.link}>Criar conta</Link>
        </p>
      </div>

      {toast && <Toast message={toast.msg} type={toast.type} />}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100dvh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px',
    position: 'relative',
  },
  bg: {
    position: 'fixed',
    inset: 0,
    background: 'radial-gradient(ellipse 60% 50% at 50% 0%, rgba(245,168,32,0.08) 0%, transparent 70%)',
    pointerEvents: 'none',
  },
  card: {
    width: '100%',
    maxWidth: '420px',
    background: 'var(--bg-card)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-xl)',
    padding: '40px',
    boxShadow: 'var(--shadow-card)',
    animation: 'fadeIn 0.3s ease',
    position: 'relative',
    zIndex: 1,
  },
  logoWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    marginBottom: '28px',
    justifyContent: 'center',
  },
  logoIcon: {
    width: '40px', height: '40px',
    background: 'var(--amber)',
    borderRadius: '10px',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: '20px', color: '#000',
  },
  logoText: {
    fontFamily: 'var(--font-display)',
    fontSize: '22px',
    fontWeight: 700,
    color: 'var(--text-primary)',
    letterSpacing: '-0.02em',
  },
  heading: {
    fontFamily: 'var(--font-display)',
    fontSize: '20px',
    fontWeight: 600,
    color: 'var(--text-primary)',
    textAlign: 'center',
    marginBottom: '4px',
  },
  sub: {
    fontSize: '14px',
    color: 'var(--text-secondary)',
    textAlign: 'center',
    marginBottom: '28px',
  },
  form: { display: 'flex', flexDirection: 'column', gap: '16px' },
  footer: {
    textAlign: 'center',
    fontSize: '14px',
    color: 'var(--text-secondary)',
    marginTop: '24px',
  },
  link: { color: 'var(--amber)', textDecoration: 'none', fontWeight: 500 },
};
