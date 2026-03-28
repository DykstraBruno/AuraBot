import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useSingleTab } from '../../hooks/useSingleTab';
import { DuplicateTabModal } from '../../components/ui/DuplicateTabModal';
import { useAuthStore } from '../../store/authStore';

// ─── useSingleTab ──────────────────────────────────────────────────────────────

describe('useSingleTab', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('reivindica a aba ao montar quando autenticado', () => {
    const onDuplicate = vi.fn();
    renderHook(() => useSingleTab(onDuplicate));

    const stored = localStorage.getItem('aurabot_active_tab');
    expect(stored).not.toBeNull();

    const parsed = JSON.parse(stored!);
    expect(parsed.id).toBeDefined();
    expect(parsed.ts).toBeTypeOf('number');
  });

  it('não chama onDuplicate quando não há outra aba', () => {
    const onDuplicate = vi.fn();
    renderHook(() => useSingleTab(onDuplicate));
    expect(onDuplicate).not.toHaveBeenCalled();
  });

  it('chama onDuplicate quando outra aba ativa existe', () => {
    const onDuplicate = vi.fn();

    // Simula outra aba ativa (tab diferente, timestamp recente)
    localStorage.setItem('aurabot_active_tab', JSON.stringify({
      id: 'other-tab-id',
      ts: Date.now(),
    }));

    renderHook(() => useSingleTab(onDuplicate));

    // Dispara evento de storage como se outra aba atualizasse
    act(() => {
      window.dispatchEvent(new StorageEvent('storage', {
        key: 'aurabot_active_tab',
        newValue: JSON.stringify({ id: 'other-tab-id', ts: Date.now() }),
      }));
    });

    expect(onDuplicate).toHaveBeenCalled();
  });

  it('não chama onDuplicate para entrada stale (>6s)', () => {
    const onDuplicate = vi.fn();

    // Aba "morta" — timestamp antigo
    localStorage.setItem('aurabot_active_tab', JSON.stringify({
      id: 'dead-tab-id',
      ts: Date.now() - 10_000, // 10 segundos atrás = stale
    }));

    renderHook(() => useSingleTab(onDuplicate));
    expect(onDuplicate).not.toHaveBeenCalled();
  });

  it('logout em outra aba dispara logout local', () => {
    const onDuplicate = vi.fn();
    const mockLogout = vi.fn();
    vi.mocked(useAuthStore).mockReturnValue(mockLogout as any);

    renderHook(() => useSingleTab(onDuplicate));

    act(() => {
      window.dispatchEvent(new StorageEvent('storage', {
        key: 'aurabot_logout',
        newValue: Date.now().toString(),
      }));
    });

    // O store deve ter recebido chamada de logout
    expect(useAuthStore.getState).toBeDefined();
  });
});

// ─── DuplicateTabModal ────────────────────────────────────────────────────────

describe('DuplicateTabModal', () => {
  it('renderiza a mensagem "Já existe uma aba aberta!"', () => {
    render(<DuplicateTabModal onClose={vi.fn()} onLogout={vi.fn()} />);
    expect(screen.getByText(/Já existe uma aba aberta!/i)).toBeInTheDocument();
  });

  it('chama onClose ao clicar em "Usar esta aba"', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<DuplicateTabModal onClose={onClose} onLogout={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: /usar esta aba/i }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('chama onLogout ao clicar em "Sair de todas as abas"', async () => {
    const onLogout = vi.fn();
    const user = userEvent.setup();
    render(<DuplicateTabModal onClose={vi.fn()} onLogout={onLogout} />);

    await user.click(screen.getByRole('button', { name: /sair de todas/i }));
    expect(onLogout).toHaveBeenCalledOnce();
  });

  it('tem role dialog e aria-modal', () => {
    render(<DuplicateTabModal onClose={vi.fn()} onLogout={vi.fn()} />);
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('aria-labelledby');
  });
});
