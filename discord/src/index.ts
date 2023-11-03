import 'dotenv/config';
import {
  Client,
  GatewayIntentBits,
  Partials,
  Events,
  ChatInputCommandInteraction,
  AutocompleteInteraction,
  ButtonInteraction,
  InteractionType,
} from 'discord.js';
import { AuraBotApiClient } from './utils/apiClient';
import { buildErrorEmbed, buildNextEmbed, buildStopEmbed, buildQueueEmbed } from './utils/embeds';

// ─── Comandos ─────────────────────────────────────────────────────────────────
import { data as playData, execute as playExecute, autocomplete as playAutocomplete } from './commands/play';
import {
  stopData, stopExecute,
  nextData, nextExecute,
  turnupData, turnupExecute,
  turndownData, turndownExecute,
  queueData, queueExecute,
} from './commands/controls';

// ─── Configuração ─────────────────────────────────────────────────────────────

const TOKEN    = process.env.DISCORD_TOKEN!;
const CLIENT_ID = process.env.DISCORD_CLIENT_ID!;
const API_URL  = process.env.AURABOT_API_URL ?? 'http://localhost:3001/api';
const BOT_TOKEN = process.env.AURABOT_BOT_TOKEN!;

if (!TOKEN || !CLIENT_ID || !BOT_TOKEN) {
  console.error('❌ Variáveis de ambiente ausentes: DISCORD_TOKEN, DISCORD_CLIENT_ID, AURABOT_BOT_TOKEN');
  process.exit(1);
}

// ─── Cliente da API AuraBot ───────────────────────────────────────────────────

const apiClient = new AuraBotApiClient(API_URL, BOT_TOKEN);

// ─── Mapa de comandos ─────────────────────────────────────────────────────────

const commands = new Map([
  ['play',     { data: playData,     execute: playExecute,     autocomplete: playAutocomplete }],
  ['stop',     { data: stopData,     execute: stopExecute }],
  ['next',     { data: nextData,     execute: nextExecute }],
  ['turnup',   { data: turnupData,   execute: turnupExecute }],
  ['turndown', { data: turndownData, execute: turndownExecute }],
  ['queue',    { data: queueData,    execute: queueExecute }],
]);

// ─── Discord Client ───────────────────────────────────────────────────────────

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Channel],
});

// ─── Evento: pronto ───────────────────────────────────────────────────────────

client.once(Events.ClientReady, (c) => {
  console.log(`✅ AuraBot Discord conectado como: ${c.user.tag}`);
  c.user.setActivity('🎵 /play para começar', { type: 0 });
});

// ─── Evento: slash commands + botões + autocomplete ───────────────────────────

client.on(Events.InteractionCreate, async (interaction) => {
  try {
    // ── Autocomplete ─────────────────────────────────────────────────────────
    if (interaction.type === InteractionType.ApplicationCommandAutocomplete) {
      const auto = interaction as AutocompleteInteraction;
      const cmd  = commands.get(auto.commandName);
      if (cmd && 'autocomplete' in cmd && cmd.autocomplete) {
        await cmd.autocomplete(auto, apiClient);
      }
      return;
    }

    // ── Slash command ─────────────────────────────────────────────────────────
    if (interaction.isChatInputCommand()) {
      const cmd = commands.get(interaction.commandName);
      if (!cmd) return;
      await cmd.execute(interaction as ChatInputCommandInteraction, apiClient);
      return;
    }

    // ── Botões inline (reply rápido do /play) ─────────────────────────────────
    if (interaction.isButton()) {
      const btn = interaction as ButtonInteraction;

      if (btn.customId === 'btn_next') {
        await btn.deferUpdate();
        const result = await apiClient.next(btn.user.id);
        await btn.followUp({ embeds: [buildNextEmbed(result)], ephemeral: false });
        return;
      }

      if (btn.customId === 'btn_stop') {
        await btn.deferUpdate();
        const result = await apiClient.stop(btn.user.id);
        await btn.followUp({ embeds: [buildStopEmbed(result.message)], ephemeral: false });
        return;
      }

      if (btn.customId === 'btn_queue') {
        await btn.deferReply({ ephemeral: true });
        const state = await apiClient.getQueue(btn.user.id);
        await btn.editReply({ embeds: [buildQueueEmbed(state)] });
        return;
      }
    }
  } catch (err: any) {
    console.error('[Discord] Erro ao processar interação:', err);

    const reply = { embeds: [buildErrorEmbed(err.message ?? 'Ocorreu um erro inesperado.')], ephemeral: true };

    try {
      if ('deferred' in interaction && interaction.deferred) {
        await (interaction as any).editReply(reply);
      } else if ('replied' in interaction && !(interaction as any).replied) {
        await (interaction as any).reply(reply);
      }
    } catch { /* ignora erro secundário */ }
  }
});

// ─── Deploy de slash commands ─────────────────────────────────────────────────
// Executado separadamente via: npm run discord:deploy
// Arquivo: src/deploy-commands.ts

// ─── Bootstrap ────────────────────────────────────────────────────────────────

async function main() {
  try {
    console.log('🚀 Conectando ao Discord...');
    await client.login(TOKEN);
  } catch (err) {
    console.error('❌ Falha ao iniciar AuraBot Discord:', err);
    process.exit(1);
  }
}

main();

export { client };
