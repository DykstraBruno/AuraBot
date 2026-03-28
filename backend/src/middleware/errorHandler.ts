import { Request, Response, NextFunction } from 'express';
import { AppError, ValidationError, AccountLockedError } from '../utils/errors';
import { logger } from '../utils/logger';
// Verificação de erros do Prisma via duck typing (não depende do client gerado)

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
) {
  logger.error({ message: err.message, url: req.url, method: req.method, stack: err.stack });

  // Erros operacionais conhecidos
  if (err instanceof AccountLockedError) {
    return res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
        lockedUntil: err.lockedUntil,
      },
    });
  }

  if (err instanceof ValidationError) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: err.message,
        fields: err.fields,
      },
    });
  }

  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      error: { code: err.code, message: err.message },
    });
  }

  // Erros do Prisma (duck typing — funciona sem o client gerado)
  const prismaErr = err as any;
  if (prismaErr?.code === 'P2002') {
    const field = (prismaErr.meta?.target as string[])?.join(', ') || 'campo';
    return res.status(409).json({
      success: false,
      error: { code: 'CONFLICT', message: `Já existe um registro com este ${field}` },
    });
  }
  if (prismaErr?.code === 'P2025') {
    return res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Registro não encontrado' },
    });
  }

  // Erro genérico — não expõe detalhes em produção
  const isDev = process.env.NODE_ENV === 'development';
  return res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: isDev ? err.message : 'Ocorreu um erro inesperado. Tente novamente.',
      ...(isDev && { stack: err.stack }),
    },
  });
}

export function notFound(req: Request, res: Response) {
  res.status(404).json({
    success: false,
    error: { code: 'NOT_FOUND', message: `Rota ${req.method} ${req.path} não encontrada` },
  });
}
