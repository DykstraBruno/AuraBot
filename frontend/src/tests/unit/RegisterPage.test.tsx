import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import RegisterPage from '../../pages/RegisterPage';
import { api, getApiError } from '../../services/api';

const renderRegister = () =>
  render(<MemoryRouter><RegisterPage /></MemoryRouter>);

describe('RegisterPage', () => {
  beforeEach(() => {
    vi.mocked(api.post).mockReset();
  });

  it('renderiza todos os campos obrigatórios', () => {
    renderRegister();
    expect(screen.getByPlaceholderText(/email\.com/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/meu_usuario/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/••••••••/)).toBeInTheDocument();
  });

  it('mostra indicador de força de senha ao digitar', async () => {
    renderRegister();
    const user = userEvent.setup();
    const pwInput = screen.getByPlaceholderText(/••••••••/);

    await user.type(pwInput, 'abc');
    expect(screen.getByText(/8\+ caracteres/i)).toBeInTheDocument();
    expect(screen.getByText(/1 número/i)).toBeInTheDocument();
    expect(screen.getByText(/1 letra/i)).toBeInTheDocument();
  });

  it('indicador mostra "✓" para requisitos cumpridos', async () => {
    renderRegister();
    const user = userEvent.setup();

    await user.type(screen.getByPlaceholderText(/••••••••/), 'Senha123');

    const checks = screen.getAllByText(/✓/);
    expect(checks.length).toBeGreaterThan(0);
  });

  it('normaliza username para lowercase sem caracteres especiais', async () => {
    renderRegister();
    const user = userEvent.setup();
    const usernameInput = screen.getByPlaceholderText(/meu_usuario/i);

    await user.type(usernameInput, 'User-Name!@#');
    // Só letras, números e _ devem permanecer (lowercase)
    expect((usernameInput as HTMLInputElement).value).toMatch(/^[a-z0-9_]*$/);
  });

  it('exibe "email inválido" ao submeter email ruim', async () => {
    renderRegister();
    const user = userEvent.setup();

    await user.type(screen.getByPlaceholderText(/email\.com/i), 'invalido');
    await user.click(screen.getByRole('button', { name: /criar conta/i }));

    await waitFor(() => {
      expect(screen.getByText('email inválido')).toBeInTheDocument();
    });
  });

  it('exibe erro de senha fraca vindo do backend', async () => {
    vi.mocked(getApiError).mockReturnValue({
      message: 'Senha inválida',
      code: 'VALIDATION_ERROR',
      fields: {
        password: 'A senha deve ter pelo menos 8 caracteres, com ao menos 1 número e 1 letra',
      },
    });
    vi.mocked(api.post).mockRejectedValue(new Error('validation'));

    renderRegister();
    const user = userEvent.setup();

    await user.type(screen.getByPlaceholderText(/email\.com/i), 'ok@test.com');
    await user.type(screen.getByPlaceholderText(/meu_usuario/i), 'testuser');
    await user.type(screen.getByPlaceholderText(/••••••••/), 'fraca');
    await user.click(screen.getByRole('button', { name: /criar conta/i }));

    await waitFor(() => {
      expect(screen.getByText(/8 caracteres/i)).toBeInTheDocument();
    });
  });

  it('exibe erro de email duplicado do backend', async () => {
    vi.mocked(getApiError).mockReturnValue({
      message: 'Já existe uma conta com este email',
      code: 'CONFLICT',
    });
    vi.mocked(api.post).mockRejectedValue(new Error('conflict'));

    renderRegister();
    const user = userEvent.setup();

    await user.type(screen.getByPlaceholderText(/email\.com/i), 'ja@existe.com');
    await user.type(screen.getByPlaceholderText(/meu_usuario/i), 'testuser');
    await user.type(screen.getByPlaceholderText(/••••••••/), 'Senha123');
    await user.click(screen.getByRole('button', { name: /criar conta/i }));

    await waitFor(() => {
      expect(screen.getByText(/já existe/i)).toBeInTheDocument();
    });
  });

  it('tem link para a página de login', () => {
    renderRegister();
    expect(screen.getByRole('link', { name: /entrar/i })).toBeInTheDocument();
  });
});
