"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const prisma = new client_1.PrismaClient();
async function main() {
    console.log('🌱 Iniciando seed...');
    // Usuário de demonstração
    const demoPassword = process.env.SEED_DEMO_PASSWORD ?? 'AuraBot@Demo2025';
    const passwordHash = await bcryptjs_1.default.hash(demoPassword, 12);
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
        { title: 'Hotel California', artist: 'Eagles', album: 'Hotel California', duration: 391, spotifyId: 'demo-sp-2' },
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
//# sourceMappingURL=seed.js.map