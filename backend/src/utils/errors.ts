export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly isOperational: boolean;

  constructor(
    message: string,
    statusCode = 500,
    code = 'INTERNAL_ERROR',
    isOperational = true
  ) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = isOperational;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  public readonly fields: Record<string, string>;
  constructor(message: string, fields: Record<string, string> = {}) {
    super(message, 400, 'VALIDATION_ERROR');
    this.name = 'ValidationError';
    this.fields = fields;
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string) {
    super(`${resource} não encontrado`, 404, 'NOT_FOUND');
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 409, 'CONFLICT');
    this.name = 'ConflictError';
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Não autorizado') {
    super(message, 401, 'UNAUTHORIZED');
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Acesso negado') {
    super(message, 403, 'FORBIDDEN');
    this.name = 'ForbiddenError';
  }
}

export class TooManyRequestsError extends AppError {
  constructor(message = 'Muitas tentativas. Tente novamente mais tarde.') {
    super(message, 429, 'TOO_MANY_REQUESTS');
    this.name = 'TooManyRequestsError';
  }
}

export class ExternalAPIError extends AppError {
  public readonly service: string;
  constructor(service: string, message: string) {
    super(`Erro na API ${service}: ${message}`, 502, 'EXTERNAL_API_ERROR');
    this.name = 'ExternalAPIError';
    this.service = service;
  }
}

export class AccountLockedError extends AppError {
  public readonly lockedUntil: Date;
  constructor(lockedUntil: Date) {
    const minutes = Math.ceil((lockedUntil.getTime() - Date.now()) / 60000);
    super(
      `Conta temporariamente bloqueada. Tente novamente em ${minutes} minuto(s).`,
      423,
      'ACCOUNT_LOCKED'
    );
    this.name = 'AccountLockedError';
    this.lockedUntil = lockedUntil;
  }
}
