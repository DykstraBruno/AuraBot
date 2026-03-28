import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, getApiError } from '../../services/api';
import { useAuthStore } from '../../store/authStore';
import { Button, Input, Toast } from '../../components/ui';
import {
  useFormValidation,
  validateEmailClient,
  validatePasswordClient,
  validateUsernameClient,
} from '../../hooks/useValidation';

// Indicador de força de senha
function PasswordStrength({ password }: { password: string }) {
  if (!password) return null;

  const checks = [
    { label: '8+ caracteres', ok: password.length >= 8 },
    { label: '1 número',      ok: /[0-9]/.test(password) },
    { label: '1 letra',       ok: /[a-zA-Z]/.test(password) },
  ];

  const score = checks.filter(c => c.ok).length;
  const colors = ['var(--red)', 'var(--amber)', 'var(--green)'];
  const labels = ['Fraca', 'Média', 'Forte'];

  return (
    <div style={{ marginTop: '4px' }}>
      <div style={{ display: 'flex', gap: '4px', marginBottom: '6px' }}>
        {[0, 1, 2].map(i => (
          <div key={i} style={{
            flex: 1, height: '3px', borderRadius: '2px',
            background: i < score ? colors[score - 1] : 'var(--border)',
            transition: 'background 0.2s',
          }} />
        ))}
      </div>
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
        {checks.map(c => (
          <span key={c.label} style={{
            fontSize: '11px',
            color: c.ok ? 'var(--green)' : 'var(--text-muted)',
            display: 'flex', alignItems: 'center', gap: '3px',
          }}>
            {c.ok ? '✓' : '○'} {c.label}
          </span>
        ))}
      </div>
    </div>
  );
}

export default function RegisterPage() {
  const navigate = useNavigate();
  const setAuth = useAuthStore(s => s.setAuth);

  const [form, setForm] = useState({
    email: '', username: '', password: '', displayName: '',
  });
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'error' | 'success' } | null>(null);

  const { errors, touched, touch, validateAll, setServerErrors } = useFormValidation({
    email:       { required: true, validator: validateEmailClient },
    username:    { required: true, validator: validateUsernameClient },
    password:    { required: true, validator: validatePasswordClient },
    displayName: {},
  });

  const showToast = (msg: string, type: 'error' | 'success' = 'error') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateAll(form)) return;

    setLoading(true);
    try {
      const { data } = await api.post('/auth/register', form);
      setAuth(data.data.user, data.data.tokens);
      showToast('Conta criada! Verifique seu email.', 'success');
      setTimeout(() => navigate('/app', { replace: true }), 1200);
    } catch (err) {
      const apiErr = getApiError(err);
      if (apiErr.fields) {
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
        <div style={styles.logoWrap}>
          <div style={styles.logoIcon}>♪</div>
          <h1 style={styles.logoText}>AuraBot</h1>
        </div>

        <h2 style={styles.heading}>Criar sua conta</h2>
        <p style={styles.sub}>Grátis para sempre. Sem cartão.</p>

        <form onSubmit={handleSubmit} noValidate style={styles.form}>
          <Input
            label="Email"
            type="email"
            autoComplete="email"
            autoFocus
            value={form.email}
            onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
            onBlur={e => touch('email', e.target.value)}
            error={touched.email ? errors.email : undefined}
            placeholder="seu@email.com"
          />

          <Input
            label="Nome de usuário"
            type="text"
            autoComplete="username"
            value={form.username}
            onChange={e => setForm(f => ({ ...f, username: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') }))}
            onBlur={e => touch('username', e.target.value)}
            error={touched.username ? errors.username : undefined}
            placeholder="meu_usuario"
            hint="3–20 caracteres. Letras, números e _"
          />

          <Input
            label="Nome de exibição (opcional)"
            type="text"
            value={form.displayName}
            onChange={e => setForm(f => ({ ...f, displayName: e.target.value }))}
            placeholder="Como quer ser chamado?"
          />

          <div>
            <Input
              label="Senha"
              type={showPw ? 'text' : 'password'}
              autoComplete="new-password"
              value={form.password}
              onChange={e => {
                setForm(f => ({ ...f, password: e.target.value }));
                if (touched.password) touch('password', e.target.value);
              }}
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
            <PasswordStrength password={form.password} />
          </div>

          <Button type="submit" loading={loading} fullWidth size="lg" style={{ marginTop: '8px' }}>
            {loading ? 'Criando conta...' : 'Criar conta'}
          </Button>
        </form>

        <p style={styles.footer}>
          Já tem conta?{' '}
          <Link to="/login" style={styles.link}>Entrar</Link>
        </p>
      </div>

      {toast && <Toast message={toast.msg} type={toast.type} />}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100dvh',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: '24px', position: 'relative',
  },
  bg: {
    position: 'fixed', inset: 0,
    background: 'radial-gradient(ellipse 60% 50% at 50% 0%, rgba(245,168,32,0.08) 0%, transparent 70%)',
    pointerEvents: 'none',
  },
  card: {
    width: '100%', maxWidth: '440px',
    background: 'var(--bg-card)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-xl)',
    padding: '40px',
    boxShadow: 'var(--shadow-card)',
    animation: 'fadeIn 0.3s ease',
    position: 'relative', zIndex: 1,
  },
  logoWrap: {
    display: 'flex', alignItems: 'center', gap: '10px',
    marginBottom: '28px', justifyContent: 'center',
  },
  logoIcon: {
    width: '40px', height: '40px', background: 'var(--amber)',
    borderRadius: '10px', display: 'flex', alignItems: 'center',
    justifyContent: 'center', fontSize: '20px', color: '#000',
  },
  logoText: {
    fontFamily: 'var(--font-display)', fontSize: '22px',
    fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em',
  },
  heading: {
    fontFamily: 'var(--font-display)', fontSize: '20px', fontWeight: 600,
    color: 'var(--text-primary)', textAlign: 'center', marginBottom: '4px',
  },
  sub: { fontSize: '14px', color: 'var(--text-secondary)', textAlign: 'center', marginBottom: '28px' },
  form: { display: 'flex', flexDirection: 'column', gap: '16px' },
  footer: { textAlign: 'center', fontSize: '14px', color: 'var(--text-secondary)', marginTop: '24px' },
  link: { color: 'var(--amber)', textDecoration: 'none', fontWeight: 500 },
};
