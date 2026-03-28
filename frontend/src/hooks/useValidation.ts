import { useState, useCallback } from 'react';

// ─── Regras de validação (espelho do backend) ─────────────────────────────────

const EMAIL_RE = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;
const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/;

export function validateEmailClient(value: string): string | null {
  if (!value.trim()) return 'email inválido';
  if (!EMAIL_RE.test(value.trim())) return 'email inválido';
  return null;
}

export function validatePasswordClient(value: string): string | null {
  if (value.length < 8) {
    return 'A senha deve ter pelo menos 8 caracteres, com ao menos 1 número e 1 letra';
  }
  if (!/[0-9]/.test(value)) {
    return 'A senha deve ter pelo menos 8 caracteres, com ao menos 1 número e 1 letra';
  }
  if (!/[a-zA-Z]/.test(value)) {
    return 'A senha deve ter pelo menos 8 caracteres, com ao menos 1 número e 1 letra';
  }
  return null;
}

export function validateUsernameClient(value: string): string | null {
  if (!value.trim()) return 'Nome de usuário é obrigatório';
  if (!USERNAME_RE.test(value.trim())) {
    return 'Use 3–20 caracteres: letras, números e _';
  }
  return null;
}

// ─── Hook genérico de validação de formulário ─────────────────────────────────

type Validator = (value: string) => string | null;

interface FieldConfig {
  validator?: Validator;
  required?: boolean;
}

export function useFormValidation<T extends Record<string, string>>(
  fields: Record<keyof T, FieldConfig>
) {
  const [errors, setErrors] = useState<Partial<Record<keyof T, string>>>({});
  const [touched, setTouched] = useState<Partial<Record<keyof T, boolean>>>({});

  const validateField = useCallback((name: keyof T, value: string): string | null => {
    const config = fields[name];
    if (!config) return null;
    if (config.required && !value.trim()) return 'Campo obrigatório';
    if (config.validator) return config.validator(value);
    return null;
  }, [fields]);

  const touch = useCallback((name: keyof T, value: string) => {
    setTouched(prev => ({ ...prev, [name]: true }));
    const error = validateField(name, value);
    setErrors(prev => ({ ...prev, [name]: error ?? undefined }));
  }, [validateField]);

  const validateAll = useCallback((values: T): boolean => {
    const newErrors: Partial<Record<keyof T, string>> = {};
    let valid = true;

    for (const name in fields) {
      const error = validateField(name as keyof T, values[name] ?? '');
      if (error) {
        newErrors[name as keyof T] = error;
        valid = false;
      }
    }

    setErrors(newErrors);
    setTouched(Object.fromEntries(Object.keys(fields).map(k => [k, true])) as any);
    return valid;
  }, [fields, validateField]);

  const setServerErrors = useCallback((serverErrors: Record<string, string>) => {
    setErrors(prev => ({ ...prev, ...serverErrors }));
    setTouched(prev => ({
      ...prev,
      ...Object.fromEntries(Object.keys(serverErrors).map(k => [k, true])),
    }));
  }, []);

  const clearErrors = useCallback(() => {
    setErrors({});
    setTouched({});
  }, []);

  return { errors, touched, touch, validateAll, setServerErrors, clearErrors };
}
