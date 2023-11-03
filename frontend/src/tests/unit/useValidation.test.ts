import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  validateEmailClient,
  validatePasswordClient,
  validateUsernameClient,
  checkPassword,
  useFormValidation,
} from '../../hooks/useValidation';

// ─── validateEmailClient ──────────────────────────────────────────────────────

describe('validateEmailClient', () => {
  it('retorna null para emails válidos', () => {
    expect(validateEmailClient('user@example.com')).toBeNull();
    expect(validateEmailClient('user+tag@sub.domain.org')).toBeNull();
    expect(validateEmailClient('USER@EXAMPLE.COM')).toBeNull();
  });

  it('retorna "email inválido" para formato errado', () => {
    const invalids = ['invalido', 'sem@dominio', '@semuser.com', '', '  '];
    invalids.forEach(e => {
      expect(validateEmailClient(e)).toBe('email inválido');
    });
  });

  it('mensagem de erro é exatamente "email inválido"', () => {
    expect(validateEmailClient('nao-e-email')).toBe('email inválido');
  });
});

// ─── validatePasswordClient ───────────────────────────────────────────────────

describe('validatePasswordClient', () => {
  it('retorna null para senhas válidas', () => {
    expect(validatePasswordClient('Senha123')).toBeNull();
    expect(validatePasswordClient('password1')).toBeNull();
    expect(validatePasswordClient('12345678a')).toBeNull();
    expect(validatePasswordClient('AbC12345!')).toBeNull();
  });

  it('exige mínimo de 8 caracteres', () => {
    const result = validatePasswordClient('Ab1');
    expect(result).not.toBeNull();
    expect(result).toContain('8 caracteres');
  });

  it('exige ao menos 1 número', () => {
    const result = validatePasswordClient('SenhaSemNumero');
    expect(result).not.toBeNull();
    expect(result).toContain('1 número');
  });

  it('exige ao menos 1 letra', () => {
    const result = validatePasswordClient('12345678');
    expect(result).not.toBeNull();
    expect(result).toContain('1 letra');
  });

  it('retorna o primeiro erro encontrado (senha muito curta)', () => {
    // A função retorna apenas o primeiro erro — 'abc' falha primeiro em tamanho
    const result = validatePasswordClient('abc');
    expect(result).not.toBeNull();
    expect(result).toContain('8 caracteres');
  });

  it('mensagens são consistentes com o backend', () => {
    // Regra fundamental: cada regra retorna sua mensagem específica
    expect(validatePasswordClient('Ab1')).toContain('8 caracteres');       // muito curta
    expect(validatePasswordClient('abcdefgh')).toContain('ao menos 1 número'); // sem número
    expect(validatePasswordClient('12345678')).toContain('ao menos 1 letra');  // sem letra
    expect(validatePasswordClient('Senha123')).toBeNull();                  // válida
  });
});

// ─── validateUsernameClient ───────────────────────────────────────────────────

describe('validateUsernameClient', () => {
  it('aceita usernames válidos', () => {
    expect(validateUsernameClient('user123')).toBeNull();
    expect(validateUsernameClient('abc')).toBeNull();
    expect(validateUsernameClient('my_user_20')).toBeNull();
  });

  it('rejeita username curto demais', () => {
    expect(validateUsernameClient('ab')).not.toBeNull();
    expect(validateUsernameClient('a')).not.toBeNull();
  });

  it('rejeita username longo demais', () => {
    expect(validateUsernameClient('a'.repeat(21))).not.toBeNull();
  });

  it('rejeita caracteres especiais', () => {
    expect(validateUsernameClient('user@name')).not.toBeNull();
    expect(validateUsernameClient('user-name')).not.toBeNull();
    expect(validateUsernameClient('user name')).not.toBeNull();
  });

  it('rejeita string vazia', () => {
    expect(validateUsernameClient('')).not.toBeNull();
  });
});

// ─── checkPassword ────────────────────────────────────────────────────────────

describe('checkPassword', () => {
  it('retorna valid: true para senha correta', () => {
    expect(checkPassword('Senha123')).toEqual({ valid: true, message: 'Senha válida' });
  });

  it('retorna valid: false com mensagem para senha fraca', () => {
    const result = checkPassword('fraca');
    expect(result.valid).toBe(false);
    expect(result.message).toBeDefined();
    expect(result.message!.length).toBeGreaterThan(0);
  });
});

// ─── useFormValidation ────────────────────────────────────────────────────────

describe('useFormValidation', () => {
  const fields = {
    email:    { required: true, validator: validateEmailClient },
    password: { required: true, validator: validatePasswordClient },
  };

  it('começa sem erros', () => {
    const { result } = renderHook(() => useFormValidation(fields));
    expect(result.current.errors).toEqual({});
    expect(result.current.touched).toEqual({});
  });

  it('touch valida o campo e atualiza errors', () => {
    const { result } = renderHook(() => useFormValidation(fields));

    act(() => result.current.touch('email', 'invalido'));

    expect(result.current.touched.email).toBe(true);
    expect(result.current.errors.email).toBe('email inválido');
  });

  it('touch limpa erro quando valor passa a ser válido', () => {
    const { result } = renderHook(() => useFormValidation(fields));

    act(() => result.current.touch('email', 'invalido'));
    expect(result.current.errors.email).toBe('email inválido');

    act(() => result.current.touch('email', 'valid@email.com'));
    expect(result.current.errors.email).toBeUndefined();
  });

  it('validateAll retorna false e popula todos os erros', () => {
    const { result } = renderHook(() => useFormValidation(fields));

    let isValid: boolean;
    act(() => {
      isValid = result.current.validateAll({ email: 'invalido', password: 'fraca' });
    });

    expect(isValid!).toBe(false);
    expect(result.current.errors.email).toBe('email inválido');
    expect(result.current.errors.password).toBeDefined();
    expect(result.current.touched.email).toBe(true);
    expect(result.current.touched.password).toBe(true);
  });

  it('validateAll retorna true para valores válidos', () => {
    const { result } = renderHook(() => useFormValidation(fields));

    let isValid: boolean;
    act(() => {
      isValid = result.current.validateAll({ email: 'ok@test.com', password: 'Senha123' });
    });

    expect(isValid!).toBe(true);
    expect(Object.keys(result.current.errors)).toHaveLength(0);
  });

  it('setServerErrors injeta erros do servidor', () => {
    const { result } = renderHook(() => useFormValidation(fields));

    act(() => result.current.setServerErrors({ password: 'senha incorreta' }));

    expect(result.current.errors.password).toBe('senha incorreta');
    expect(result.current.touched.password).toBe(true);
  });

  it('clearErrors reseta tudo', () => {
    const { result } = renderHook(() => useFormValidation(fields));

    act(() => result.current.touch('email', 'invalido'));
    act(() => result.current.clearErrors());

    expect(result.current.errors).toEqual({});
    expect(result.current.touched).toEqual({});
  });

  it('campo required rejeita string vazia', () => {
    const { result } = renderHook(() => useFormValidation(fields));

    act(() => result.current.touch('email', ''));
    expect(result.current.errors.email).toBeDefined();
  });
});
