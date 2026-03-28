import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Iniciando seed...');

  // Usuário de demonstração
  const demoPassword = process.env.SEED_DEMO_PASSWORD ?? 'AuraBot@Demo2025';
  const passwordHash = await bcrypt.hash(demoPassword, 12);

  const demo = await prisma.user.upsert({
    where: { email: 'demo@aurabot.app' },
    update: {},
    create: {
      email: 'demo@aurabot.app',
      username: 'demo',
      passwordHash,
      displayName: 'Usuário Demo',
      emailVerified: true,
      preferences: {
        create: {
          language: 'pt-BR',
          preferredSource: 'spotify',
          audioQuality: 'high',
          volume: 80,
        },
      },
    },
  });

  console.log(`✅ Usuário demo criado: ${demo.email}`);

  // Algumas músicas de exemplo no histórico
  const tracks = [
    { title: 'Bohemian Rhapsody', artist: 'Queen', album: 'A Night at the Opera', duration: 354, spotifyId: 'demo-sp-1' },
    { title: 'Hotel California',  artist: 'Eagles', album: 'Hotel California',      duration: 391, spotifyId: 'demo-sp-2' },
    { title: 'Stairway to Heaven', artist: 'Led Zeppelin', album: 'Led Zeppelin IV', duration: 482, spotifyId: 'demo-sp-3' },
  ];

  for (const t of tracks) {
    const track = await prisma.track.upsert({
      where: { spotifyId: t.spotifyId },
      update: {},
      create: t,
    });

    await prisma.playHistory.create({
      data: {
        userId: demo.id,
        trackId: track.id,
        source: 'spotify',
        platform: 'web',
      },
    });
  }

  console.log(`✅ ${tracks.length} faixas no histórico`);
  console.log('');
  console.log('─────────────────────────────────────');
  console.log('  Login demo:');
  console.log('  Email:  demo@aurabot.app');
  console.log(`  Senha:  ${demoPassword}`);
  console.log('─────────────────────────────────────');
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
