import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

async function createPrismaClient(): Promise<PrismaClient> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL não configurada');

  // Neon serverless (produção/Vercel) — usa WebSocket adapter
  if (url.includes('neon.tech') || process.env.USE_NEON_ADAPTER === 'true') {
    const { neonConfig, Pool }  = await import('@neondatabase/serverless');
    const { PrismaNeon }        = await import('@prisma/adapter-neon');
    const ws                    = await import('ws');

    neonConfig.webSocketConstructor = ws.default;
    const pool    = new Pool({ connectionString: url });
    const adapter = new PrismaNeon(pool);

    return new PrismaClient({
      adapter,
      log: process.env.NODE_ENV === 'development'
        ? [{ emit: 'event', level: 'query' }, 'warn', 'error']
        : ['warn', 'error'],
    } as any);
  }

  // PostgreSQL padrão (local / Railway / etc.)
  return new PrismaClient({
    datasources: { db: { url } },
    log: process.env.NODE_ENV === 'development'
      ? [{ emit: 'event', level: 'query' }, 'warn', 'error']
      : ['warn', 'error'],
  } as any);
}

let _prisma: PrismaClient | undefined = globalThis.__prisma;

export async function getPrisma(): Promise<PrismaClient> {
  if (!_prisma) {
    _prisma = await createPrismaClient();
    if (process.env.NODE_ENV !== 'production') {
      globalThis.__prisma = _prisma;
    }
    if (process.env.NODE_ENV === 'development') {
      (_prisma as any).$on?.('query', (e: any) => {
        logger.debug(`Query: ${e.query} — ${e.duration}ms`);
      });
    }
  }
  return _prisma;
}

// Exporta instância síncrona para compatibilidade com código existente.
// Inicializada no bootstrap (server.ts) antes de qualquer uso.
export let prisma: PrismaClient = null as any;

export async function initDatabase(): Promise<void> {
  prisma = await getPrisma();
}
