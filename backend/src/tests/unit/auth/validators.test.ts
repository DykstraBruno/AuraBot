import { describe, it, expect } from 'vitest';
import {
  validateEmail,
  validatePassword,
  validateUsername,
  isValidEmail,
  checkPassword,
} from '../../../utils/validators';
import { ValidationError } from '../../../utils/errors';

describe('validateEmail', () => {
  it('aceita emails válidos', () => {
    expect(validateEmail('user@example.com')).toBe('user@example.com');
    expect(validateEmail('USER@EXAMPLE.COM')).toBe('user@example.com'); // normaliza
    expect(validateEmail('  user@example.com  ')).toBe('user@example.com'); // trim
    expect(validateEmail('user+tag@sub.domain.com')).toBe('user+tag@sub.domain.com');
    expect(validateEmail('user.name@domain.org')).toBe('user.name@domain.org');
  });

  it('retorna mensagem "email inválido" para formato errado', () => {
    const cases = ['invalido', 'sem@dominio', '@semuser.com', 'duplo@@dominio.com', ''];

    for (const email of cases) {
      try {
        validateEmail(email);
        expect.fail(`Deveria ter rejeitado: "${email}"`);
      } catch (e) {
        expect(e).toBeInstanceOf(ValidationError);
        expect((e as ValidationError).fields.email).toBe('email inválido');
      }
    }
  });

  it('rejeita tipos não-string', () => {
    expect(() => validateEmail(null as any)).toThrow(ValidationError);
    expect(() => validateEmail(123 as any)).toThrow(ValidationError);
    expect(() => validateEmail(undefined as any)).toThrow(ValidationError);
  });
});

describe('isValidEmail', () => {
  it('retorna true para emails válidos', () => {
    expect(isValidEmail('user@domain.com')).toBe(true);
  });

  it('retorna false para emails inválidos', () => {
    expect(isValidEmail('invalido')).toBe(false);
    expect(isValidEmail('')).toBe(false);
    expect(isValidEmail('a@b')).toBe(false);
  });
});

describe('validatePassword', () => {
  it('aceita senhas válidas', () => {
    expect(validatePassword('Senha123')).toBe('Senha123');
    expect(validatePassword('password1')).toBe('password1');
    expect(validatePassword('12345678a')).toBe('12345678a');
    expect(validatePassword('MyStr0ngP@ssword')).toBe('MyStr0ngP@ssword');
  });

  it('rejeita senha com menos de 8 caracteres', () => {
    try {
      validatePassword('Ab1');
      expect.fail();
    } catch (e) {
      expect(e).toBeInstanceOf(ValidationError);
      expect((e as ValidationError).fields.password).toContain('8 caracteres');
    }
  });

  it('rejeita senha sem número', () => {
    try {
      validatePassword('SemNumero');
      expect.fail();
    } catch (e) {
      expect(e).toBeInstanceOf(ValidationError);
      expect((e as ValidationError).fields.password).toContain('1 número');
    }
  });

  it('rejeita senha sem letra', () => {
    try {
      validatePassword('12345678');
      expect.fail();
    } catch (e) {
      expect(e).toBeInstanceOf(ValidationError);
      expect((e as ValidationError).fields.password).toContain('1 letra');
    }
  });

  it('mensagem contém todas as regras juntas', () => {
    try {
      validatePassword('fraca');
      expect.fail();
    } catch (e) {
      const msg = (e as ValidationError).fields.password;
      expect(msg).toContain('8 caracteres');
      expect(msg).toContain('1 número');
      expect(msg).toContain('1 letra');
    }
  });

  it('rejeita tipos não-string', () => {
    expect(() => validatePassword(null as any)).toThrow(ValidationError);
    expect(() => validatePassword(12345678 as any)).toThrow(ValidationError);
  });
});

describe('checkPassword', () => {
  it('retorna { valid: true } para senha válida', () => {
    expect(checkPassword('Senha123')).toEqual({ valid: true });
  });

  it('retorna { valid: false, message } para senha inválida', () => {
    const result = checkPassword('fraca');
    expect(result.valid).toBe(false);
    expect(result.message).toBeDefined();
    expect(result.message).toContain('8 caracteres');
  });
});

describe('validateUsername', () => {
  it('aceita usernames válidos', () => {
    expect(validateUsername('user123')).toBe('user123');
    expect(validateUsername('USER_NAME')).toBe('user_name'); // normaliza
    expect(validateUsername('abc')).toBe('abc'); // mínimo 3
  });

  it('rejeita username muito curto', () => {
    expect(() => validateUsername('ab')).toThrow(ValidationError);
  });

  it('rejeita username muito longo', () => {
    expect(() => validateUsername('a'.repeat(21))).toThrow(ValidationError);
  });

  it('rejeita caracteres especiais', () => {
    expect(() => validateUsername('user@name')).toThrow(ValidationError);
    expect(() => validateUsername('user name')).toThrow(ValidationError);
    expect(() => validateUsername('user-name')).toThrow(ValidationError);
    expect(() => validateUsername('user.name')).toThrow(ValidationError);
  });

  it('rejeita vazio ou não-string', () => {
    expect(() => validateUsername('')).toThrow(ValidationError);
    expect(() => validateUsername(null as any)).toThrow(ValidationError);
  });
});
