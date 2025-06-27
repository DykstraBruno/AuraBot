import app from './app';
import { initDatabase, prisma } from './config/database';
import { logger } from './utils/logger';

const PORT = process.env.PORT ?? 3001;

async function bootstrap() {
  try {
    await initDatabase();
    await prisma.$connect();
    logger.info('✅ Banco de dados conectado');

    const server = app.listen(PORT, () => {
      logger.info(`🎵 AuraBot API rodando na porta ${PORT} [${process.env.NODE_ENV}]`);
    });

    const shutdown = async (signal: string) => {
      logger.info(`⚠️  Recebido ${signal}. Encerrando...`);
      server.close(async () => {
        await prisma.$disconnect();
        logger.info('🔌 Banco desconectado. Até logo!');
        process.exit(0);
      });
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('uncaughtException', err => {
      logger.error('Exceção não tratada:', err);
      process.exit(1);
    });
    process.on('unhandledRejection', reason => {
      logger.error('Promise rejeitada não tratada:', reason);
      process.exit(1);
    });

  } catch (err) {
    logger.error('❌ Falha ao iniciar servidor:', err);
    process.exit(1);
  }
}

bootstrap();
