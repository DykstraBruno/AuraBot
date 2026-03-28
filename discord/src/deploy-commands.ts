/**
 * Script standalone para registrar slash commands no Discord.
 * Roda separado do bot — não inicia o client.
 *
 * Uso: npm run discord:deploy
 */
import 'dotenv/config';
import { REST, Routes } from 'discord.js';
import { data as playData } from './commands/play';
import {
  stopData, nextData, turnupData, turndownData, queueData,
} from './commands/controls';

const TOKEN     = process.env.DISCORD_TOKEN!;
const CLIENT_ID = process.env.DISCORD_CLIENT_ID!;
const GUILD_ID  = process.env.DISCORD_GUILD_ID;

if (!TOKEN || !CLIENT_ID) {
  console.error('❌ DISCORD_TOKEN e DISCORD_CLIENT_ID são obrigatórios em discord/.env');
  process.exit(1);
}

const commands = [playData, stopData, nextData, turnupData, turndownData, queueData]
  .map(c => c.toJSON());

const rest = new REST({ version: '10' }).setToken(TOKEN);

async function deploy() {
  try {
    console.log(`🔧 Registrando ${commands.length} slash commands...`);

    if (GUILD_ID) {
      // Dev: apenas no servidor especificado (instantâneo)
      await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });
      console.log(`✅ Comandos registrados no servidor ${GUILD_ID} (instantâneo)`);
    } else {
      // Produção: deploy global (pode levar até 1 hora para propagar)
      await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
      console.log('✅ Comandos registrados globalmente (aguarde até 1h para propagar)');
    }
  } catch (err) {
    console.error('❌ Falha ao registrar comandos:', err);
    process.exit(1);
  }
}

deploy();
