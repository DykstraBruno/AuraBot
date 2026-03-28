import { vi, beforeEach } from 'vitest';

// ─── Variáveis de ambiente para testes ───────────────────────────────────────
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-supersecure-32chars!!';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-supersecure-32!!';
process.env.JWT_EXPIRES_IN = '15m';
process.env.JWT_REFRESH_EXPIRES_IN = '7d';
process.env.FRONTEND_URL = 'http://localhost:5173';
process.env.SMTP_HOST = '';
process.env.SMTP_USER = '';
process.env.SMTP_PASS = '';

// ─── Mock Prisma ──────────────────────────────────────────────────────────────
vi.mock('../config/database', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      delete: vi.fn(),
    },
    session: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    passwordReset: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    emailVerification: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    queueItem: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
      count: vi.fn(),
    },
    track: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
    playHistory: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
    $transaction: vi.fn((ops: any) =>
      Array.isArray(ops) ? Promise.all(ops) : ops(mockPrismaTransaction)
    ),
    $connect: vi.fn(),
    $disconnect: vi.fn(),
  },
}));

const mockPrismaTransaction = {
  user: { update: vi.fn() },
  passwordReset: { update: vi.fn() },
  session: { updateMany: vi.fn() },
  emailVerification: { update: vi.fn() },
};

// ─── Mock Logger ──────────────────────────────────────────────────────────────
vi.mock('../utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    http: vi.fn(),
  },
}));

// ─── Mock Email ───────────────────────────────────────────────────────────────
vi.mock('../email/email.service', () => ({
  emailService: {
    send: vi.fn().mockResolvedValue(undefined),
    sendPasswordReset: vi.fn().mockResolvedValue(undefined),
    sendEmailVerification: vi.fn().mockResolvedValue(undefined),
  },
  EmailService: vi.fn(),
}));

// ─── Reset mocks entre testes ─────────────────────────────────────────────────
beforeEach(() => {
  vi.clearAllMocks();
});
