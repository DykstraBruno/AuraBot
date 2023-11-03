import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useVoiceRecorder } from '../../hooks/useVoiceRecorder';

describe('useVoiceRecorder', () => {
  beforeEach(() => {
    vi.mocked(navigator.mediaDevices.getUserMedia).mockResolvedValue({
      getTracks: () => [{ stop: vi.fn() }],
    } as any);
  });

  it('começa no estado idle', () => {
    const { result } = renderHook(() => useVoiceRecorder());
    expect(result.current.state).toBe('idle');
    expect(result.current.duration).toBe(0);
    expect(result.current.error).toBeNull();
  });

  it('transiciona para recording ao chamar start()', async () => {
    const { result } = renderHook(() => useVoiceRecorder());

    await act(async () => {
      await result.current.start();
    });

    expect(result.current.state).toBe('recording');
  });

  it('transiciona para idle ao chamar cancel()', async () => {
    const { result } = renderHook(() => useVoiceRecorder());

    await act(async () => {
      await result.current.start();
    });

    act(() => result.current.cancel());
    expect(result.current.state).toBe('idle');
    expect(result.current.duration).toBe(0);
  });

  it('define error quando getUserMedia é negado', async () => {
    vi.mocked(navigator.mediaDevices.getUserMedia).mockRejectedValue(
      Object.assign(new Error('Permission denied'), { name: 'NotAllowedError' })
    );

    const { result } = renderHook(() => useVoiceRecorder());

    await act(async () => {
      await result.current.start();
    });

    expect(result.current.state).toBe('idle');
    expect(result.current.error).toContain('Permissão de microfone negada');
  });

  it('define error quando microfone não é encontrado', async () => {
    vi.mocked(navigator.mediaDevices.getUserMedia).mockRejectedValue(
      Object.assign(new Error('Not found'), { name: 'NotFoundError' })
    );

    const { result } = renderHook(() => useVoiceRecorder());

    await act(async () => { await result.current.start(); });

    expect(result.current.error).toContain('microfone');
  });

  it('stop() transiciona para processing e depois idle', async () => {
    const { result } = renderHook(() => useVoiceRecorder());

    await act(async () => { await result.current.start(); });

    let blob: Blob | null = null;
    await act(async () => {
      blob = await result.current.stop();
    });

    expect(result.current.state).toBe('idle');
  });

  it('stop() retorna null quando não está gravando', async () => {
    const { result } = renderHook(() => useVoiceRecorder());

    let blob: Blob | null = null;
    await act(async () => {
      blob = await result.current.stop();
    });

    expect(blob).toBeNull();
  });
});
