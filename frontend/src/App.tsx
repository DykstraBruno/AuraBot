import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import { Spinner } from './components/ui';

// Lazy loading — importações normais (sem await top-level que quebra o build)
const LoginPage          = lazy(() => import('./pages/LoginPage'));
const RegisterPage       = lazy(() => import('./pages/RegisterPage'));
const AppPage            = lazy(() => import('./pages/AppPage'));
const ForgotPasswordPage = lazy(() =>
  import('./pages/AuthPages').then(m => ({ default: m.ForgotPasswordPage }))
);
const ResetPasswordPage  = lazy(() =>
  import('./pages/AuthPages').then(m => ({ default: m.ResetPasswordPage }))
);

// ─── Loading fallback ─────────────────────────────────────────────────────────

function PageLoader() {
  return (
    <div style={{
      minHeight: '100dvh', display: 'flex',
      alignItems: 'center', justifyContent: 'center',
    }}>
      <Spinner size={32} color="var(--amber)" />
    </div>
  );
}

// ─── Protected route ──────────────────────────────────────────────────────────

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore(s => s.isAuthenticated);
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}

// ─── Guest route (redireciona logados para /app) ──────────────────────────────

function GuestRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore(s => s.isAuthenticated);
  if (isAuthenticated) return <Navigate to="/app" replace />;
  return <>{children}</>;
}

// ─── App ──────────────────────────────────────────────────────────────────────

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          {/* Raiz → redireciona */}
          <Route path="/" element={<Navigate to="/app" replace />} />

          {/* Rotas de autenticação (apenas para não logados) */}
          <Route path="/login" element={
            <GuestRoute><LoginPage /></GuestRoute>
          } />
          <Route path="/register" element={
            <GuestRoute><RegisterPage /></GuestRoute>
          } />
          <Route path="/forgot-password" element={
            <GuestRoute><ForgotPasswordPage /></GuestRoute>
          } />
          <Route path="/reset-password" element={
            <GuestRoute><ResetPasswordPage /></GuestRoute>
          } />

          {/* App protegido */}
          <Route path="/app" element={
            <ProtectedRoute><AppPage /></ProtectedRoute>
          } />

          {/* 404 */}
          <Route path="*" element={
            <div style={{
              minHeight: '100dvh', display: 'flex',
              flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', gap: '16px',
            }}>
              <span style={{ fontSize: '64px' }}>♪</span>
              <h1 style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}>
                Página não encontrada
              </h1>
              <a href="/app" style={{ color: 'var(--amber)', textDecoration: 'none' }}>
                Voltar ao início
              </a>
            </div>
          } />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
