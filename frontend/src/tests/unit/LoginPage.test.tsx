import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import LoginPage from '../../pages/LoginPage';
import { api, getApiError } from '../../services/api';
import { useAuthStore } from '../../store/authStore';

// Helpers
const renderLogin = () =>
  render(
    <MemoryRouter initialEntries={['/login']}>
      <LoginPage />
    </MemoryRouter>
  );

const getEmailInput = () => screen.getByPlaceholderText(/email\.com/i);
const getPasswordInput = () => screen.getByPlaceholderText(/••••••••/);
const getSubmitBtn = () => screen.getByRole('button', { name: /entrar(do)?/i });

describe('LoginPage', () => {
  beforeEach(() => {
    vi.mocked(api.post).mockReset();
  });

  it('renderiza campos de email, senha e botão de entrar', () => {
    renderLogin();
    expect(getEmailInput()).toBeInTheDocument();
    expect(getPasswordInput()).toBeInTheDocument();
    expect(getSubmitBtn()).toBeInTheDocument();
  });

  it('mostra link para cadastro', () => {
    renderLogin();
    expect(screen.getByText(/criar conta/i)).toBeInTheDocument();
  });

  it('mostra link para esqueci minha senha', () => {
    renderLogin();
    expect(screen.getByText(/esqueci minha senha/i)).toBeInTheDocument();
  });

  it('exibe "email inválido" ao submeter email errado', async () => {
    renderLogin();
    const user = userEvent.setup();

    // 'nao-e-email' sem @ é tratado como username (sem validação de formato)
    // Com @ mas formato inválido ativa o validateEmailClient
    await user.type(getEmailInput(), 'invalido@');
    await user.click(getSubmitBtn());

    await waitFor(() => {
      // O Input renderiza <p><span>⚠</span> email inválido</p>
      // Usar getAllByText e pegar o elemento mais específico
      const els = screen.getAllByText((_, element) =>
        element?.tagName === 'P' &&
        (element?.textContent?.toLowerCase().includes('email inválido') ?? false)
      );
      expect(els.length).toBeGreaterThan(0);
    });
    expect(api.post).not.toHaveBeenCalled();
  });

  it('exibe erro ao submeter com campos vazios', async () => {
    renderLogin();
    const user = userEvent.setup();
    await user.click(getSubmitBtn());

    await waitFor(() => {
      expect(screen.getAllByText(/obrigatório/i).length).toBeGreaterThan(0);
    });
    expect(api.post).not.toHaveBeenCalled();
  });

  it('chama api.post com credenciais corretas', async () => {
    vi.mocked(api.post).mockResolvedValue({
      data: {
        success: true,
        data: {
          user: { id: 'u1', email: 'test@test.com', username: 'test', displayName: null, avatarUrl: null, emailVerified: false },
          tokens: { accessToken: 'acc', refreshToken: 'ref', expiresIn: 900 },
        },
      },
    });

    renderLogin();
    const user = userEvent.setup();

    await user.type(getEmailInput(), 'test@test.com');
    await user.type(getPasswordInput(), 'Senha123');
    await user.click(getSubmitBtn());

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/auth/login', {
        emailOrUsername: 'test@test.com',
        password: 'Senha123',
      });
    });
  });

  it('exibe "senha incorreta" vindo do backend', async () => {
    vi.mocked(getApiError).mockReturnValue({
      message: 'senha incorreta',
      code: 'UNAUTHORIZED',
    });
    vi.mocked(api.post).mockRejectedValue({ response: { data: { error: { message: 'senha incorreta', code: 'UNAUTHORIZED' } } } });

    renderLogin();
    const user = userEvent.setup();

    await user.type(getEmailInput(), 'test@test.com');
    await user.type(getPasswordInput(), 'SenhaErrada1');
    await user.click(getSubmitBtn());

    await waitFor(() => {
      expect(screen.getByText(/senha incorreta/i)).toBeInTheDocument();
    });
  });

  it('exibe mensagem de conta bloqueada', async () => {
    vi.mocked(getApiError).mockReturnValue({
      message: 'Conta temporariamente bloqueada. Tente novamente em 15 minuto(s).',
      code: 'ACCOUNT_LOCKED',
    });
    vi.mocked(api.post).mockRejectedValue(new Error('locked'));

    renderLogin();
    const user = userEvent.setup();

    await user.type(getEmailInput(), 'test@test.com');
    await user.type(getPasswordInput(), 'Senha123');
    await user.click(getSubmitBtn());

    await waitFor(() => {
      expect(screen.getByText(/bloqueada/i)).toBeInTheDocument();
    });
  });

  it('botão fica desabilitado durante loading', async () => {
    // Mock que demora para resolver
    vi.mocked(api.post).mockImplementation(() => new Promise(r => setTimeout(r, 5000)));

    renderLogin();
    const user = userEvent.setup();

    await user.type(getEmailInput(), 'test@test.com');
    await user.type(getPasswordInput(), 'Senha123');

    // Clicar no botão — durante loading o texto muda para "Entrando..."
    const btn = getSubmitBtn();
    await user.click(btn);

    await waitFor(() => {
      // Durante loading o botão fica disabled (prop loading=true no Button)
      const buttons = screen.getAllByRole('button');
      const submitBtn = buttons.find(b => 
        b.textContent?.includes('Entrar') || b.textContent?.includes('Entrando')
      );
      expect(submitBtn).toBeDisabled();
    });
  });

  it('botão de mostrar/ocultar senha funciona', async () => {
    renderLogin();
    const user = userEvent.setup();
    const pwInput = getPasswordInput();

    expect(pwInput).toHaveAttribute('type', 'password');

    const toggleBtn = screen.getByLabelText(/mostrar senha/i);
    await user.click(toggleBtn);
    expect(pwInput).toHaveAttribute('type', 'text');

    await user.click(screen.getByLabelText(/ocultar senha/i));
    expect(pwInput).toHaveAttribute('type', 'password');
  });

  it('valida em tempo real ao sair do campo de email', async () => {
    renderLogin();
    const user = userEvent.setup();

    // Precisa de '@' para ativar validação de email (sem @ trata como username)
    await user.type(getEmailInput(), 'nao-e-email@');
    await user.tab(); // blur

    await waitFor(() => {
      const els = screen.getAllByText((_, element) =>
        element?.tagName === 'P' &&
        (element?.textContent?.toLowerCase().includes('email inválido') ?? false)
      );
      expect(els.length).toBeGreaterThan(0);
    });
  });
});
