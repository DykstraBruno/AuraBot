import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api, getApiError } from '../services/api';
import { Button, Input, Toast } from '../components/ui';
import { validateEmailClient, validatePasswordClient, useFormValidation } from '../hooks/useValidation';

// ─── Forgot Password ──────────────────────────────────────────────────────────

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const err = validateEmailClient(email);
    if (err) { setEmailError(err); return; }
    setEmailError('');
    setLoading(true);

    try {
      await api.post('/auth/forgot-password', { email });
      setSent(true);
    } catch {
      // Sempre mostra sucesso (backend não revela se email existe)
      setSent(true);
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <div style={pageStyle}>
        <div style={cardStyle}>
          <div style={{ textAlign: 'center', padding: '8px 0' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>📬</div>
            <h2 style={headingStyle}>Email enviado!</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px', lineHeight: 1.6, marginBottom: '24px' }}>
              Se este email estiver cadastrado, você receberá as instruções para redefinir sua senha em breve.
              Verifique também a pasta de spam.
            </p>
            <Link to="/login" style={{ color: 'var(--amber)', textDecoration: 'none', fontSize: '14px' }}>
              ← Voltar para login
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={pageStyle}>
      <div style={cardStyle}>
        <div style={logoWrap}>
          <div style={logoIcon}>♪</div>
          <span style={logoText}>AuraBot</span>
        </div>
        <h2 style={headingStyle}>Esqueceu a senha?</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px', textAlign: 'center', marginBottom: '28px' }}>
          Informe seu email e enviaremos um link para redefinir sua senha.
        </p>

        <form onSubmit={handleSubmit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <Input
            label="Email"
            type="email"
            autoFocus
            value={email}
            onChange={e => { setEmail(e.target.value); setEmailError(''); }}
            onBlur={e => { const err = validateEmailClient(e.target.value); if (err) setEmailError(err); }}
            error={emailError || undefined}
            placeholder="seu@email.com"
          />
          <Button type="submit" loading={loading} fullWidth size="lg">
            {loading ? 'Enviando...' : 'Enviar link de redefinição'}
          </Button>
        </form>

        <p style={{ textAlign: 'center', marginTop: '20px', fontSize: '14px', color: 'var(--text-secondary)' }}>
          Lembrou?{' '}
          <Link to="/login" style={{ color: 'var(--amber)', textDecoration: 'none' }}>Entrar</Link>
        </p>
      </div>
    </div>
  );
}

// ─── Reset Password ───────────────────────────────────────────────────────────

export function ResetPasswordPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';

  const [form, setForm] = useState({ password: '', confirm: '' });
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'error' | 'success' } | null>(null);

  const { errors, touched, touch, validateAll, setServerErrors } = useFormValidation({
    password: { required: true, validator: validatePasswordClient },
    confirm: {
      required: true,
      validator: (v) => v !== form.password ? 'As senhas não coincidem' : null,
    },
  });

  const showToast = (msg: string, type: 'error' | 'success' = 'error') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  if (!token) {
    return (
      <div style={pageStyle}>
        <div style={cardStyle}>
          <p style={{ color: 'var(--red)', textAlign: 'center' }}>
            Link inválido ou expirado. <Link to="/forgot-password" style={{ color: 'var(--amber)' }}>Solicitar novo link</Link>
          </p>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateAll(form)) return;
    setLoading(true);

    try {
      await api.post('/auth/reset-password', { token, password: form.password });
      showToast('Senha redefinida com sucesso!', 'success');
      setTimeout(() => navigate('/login', { replace: true }), 1500);
    } catch (err) {
      const apiErr = getApiError(err);
      if (apiErr.fields) setServerErrors(apiErr.fields);
      else showToast(apiErr.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={pageStyle}>
      <div style={cardStyle}>
        <div style={logoWrap}>
          <div style={logoIcon}>♪</div>
          <span style={logoText}>AuraBot</span>
        </div>
        <h2 style={headingStyle}>Nova senha</h2>

        <form onSubmit={handleSubmit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <Input
            label="Nova senha"
            type="password"
            autoFocus
            value={form.password}
            onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
            onBlur={e => touch('password', e.target.value)}
            error={touched.password ? errors.password : undefined}
            placeholder="••••••••"
          />
          <Input
            label="Confirmar senha"
            type="password"
            value={form.confirm}
            onChange={e => setForm(f => ({ ...f, confirm: e.target.value }))}
            onBlur={e => touch('confirm', e.target.value)}
            error={touched.confirm ? errors.confirm : undefined}
            placeholder="••••••••"
          />
          <Button type="submit" loading={loading} fullWidth size="lg">
            {loading ? 'Salvando...' : 'Redefinir senha'}
          </Button>
        </form>
      </div>
      {toast && <Toast message={toast.msg} type={toast.type} />}
    </div>
  );
}

// ─── Estilos compartilhados ───────────────────────────────────────────────────
const pageStyle: React.CSSProperties = {
  minHeight: '100dvh', display: 'flex',
  alignItems: 'center', justifyContent: 'center', padding: '24px',
};
const cardStyle: React.CSSProperties = {
  width: '100%', maxWidth: '420px',
  background: 'var(--bg-card)', border: '1px solid var(--border)',
  borderRadius: 'var(--radius-xl)', padding: '40px',
  boxShadow: 'var(--shadow-card)', animation: 'fadeIn 0.3s ease',
};
const logoWrap: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: '10px',
  marginBottom: '24px', justifyContent: 'center',
};
const logoIcon: React.CSSProperties = {
  width: '36px', height: '36px', background: 'var(--amber)',
  borderRadius: '8px', display: 'flex', alignItems: 'center',
  justifyContent: 'center', fontSize: '18px', color: '#000',
};
const logoText: React.CSSProperties = {
  fontFamily: 'var(--font-display)', fontSize: '20px',
  fontWeight: 700, color: 'var(--text-primary)',
};
const headingStyle: React.CSSProperties = {
  fontFamily: 'var(--font-display)', fontSize: '20px', fontWeight: 600,
  color: 'var(--text-primary)', textAlign: 'center', marginBottom: '4px',
};
