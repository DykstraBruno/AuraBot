import { ValidationError } from './errors';

// ─── Email ────────────────────────────────────────────────────────────────────

const EMAIL_REGEX = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;

export function validateEmail(email: unknown): string {
  if (typeof email !== 'string' || email.trim() === '') {
    throw new ValidationError('email inválido', { email: 'email inválido' });
  }

  const trimmed = email.trim().toLowerCase();

  if (!EMAIL_REGEX.test(trimmed)) {
    throw new ValidationError('email inválido', { email: 'email inválido' });
  }

  if (trimmed.length > 254) {
    throw new ValidationError('email inválido', { email: 'email inválido' });
  }

  return trimmed;
}

export function isValidEmail(email: string): boolean {
  try {
    validateEmail(email);
    return true;
  } catch {
    return false;
  }
}

// ─── Senha ────────────────────────────────────────────────────────────────────

const PASSWORD_RULES = {
  minLength: 8,
  requireNumber: true,
  requireLetter: true,
};

export interface PasswordValidationResult {
  valid: boolean;
  message?: string;
}

export function validatePassword(password: unknown): string {
  if (typeof password !== 'string') {
    throw new ValidationError('Senha inválida', {
      password: `A senha deve ter pelo menos ${PASSWORD_RULES.minLength} caracteres, com ao menos 1 número e 1 letra`,
    });
  }

  if (password.length < PASSWORD_RULES.minLength) {
    throw new ValidationError('Senha inválida', {
      password: `A senha deve ter pelo menos ${PASSWORD_RULES.minLength} caracteres, com ao menos 1 número e 1 letra`,
    });
  }

  if (!/[0-9]/.test(password)) {
    throw new ValidationError('Senha inválida', {
      password: `A senha deve ter pelo menos ${PASSWORD_RULES.minLength} caracteres, com ao menos 1 número e 1 letra`,
    });
  }

  if (!/[a-zA-Z]/.test(password)) {
    throw new ValidationError('Senha inválida', {
      password: `A senha deve ter pelo menos ${PASSWORD_RULES.minLength} caracteres, com ao menos 1 número e 1 letra`,
    });
  }

  return password;
}

export function checkPassword(password: string): PasswordValidationResult {
  try {
    validatePassword(password);
    return { valid: true };
  } catch (e) {
    if (e instanceof ValidationError) {
      return { valid: false, message: e.fields.password };
    }
    return { valid: false, message: 'Senha inválida' };
  }
}

// ─── Username ─────────────────────────────────────────────────────────────────

export function validateUsername(username: unknown): string {
  if (typeof username !== 'string' || username.trim() === '') {
    throw new ValidationError('Nome de usuário inválido', {
      username: 'Nome de usuário é obrigatório',
    });
  }

  const trimmed = username.trim();

  if (trimmed.length < 3 || trimmed.length > 20) {
    throw new ValidationError('Nome de usuário inválido', {
      username: 'O nome de usuário deve ter entre 3 e 20 caracteres',
    });
  }

  if (!/^[a-zA-Z0-9_]+$/.test(trimmed)) {
    throw new ValidationError('Nome de usuário inválido', {
      username: 'O nome de usuário deve conter apenas letras, números e _',
    });
  }

  return trimmed.toLowerCase();
}

// ─── Token de reset ───────────────────────────────────────────────────────────

export function validateResetToken(token: unknown): string {
  if (typeof token !== 'string' || token.trim() === '') {
    throw new ValidationError('Token inválido', { token: 'Token é obrigatório' });
  }
  if (token.length < 32) {
    throw new ValidationError('Token inválido', { token: 'Token inválido' });
  }
  return token.trim();
}
