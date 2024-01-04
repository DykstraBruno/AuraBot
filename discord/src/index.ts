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
  EmbedBuilder,
} from 'discord.js';
import * as voiceManager from './voice/voiceManager';
import { buildErrorEmbed } from './utils/embeds';

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

const TOKEN     = process.env.DISCORD_TOKEN!;
const CLIENT_ID = process.env.DISCORD_CLIENT_ID!;

if (!TOKEN || !CLIENT_ID) {
  console.error('❌ Variáveis de ambiente ausentes: DISCORD_TOKEN, DISCORD_CLIENT_ID');
  process.exit(1);
}

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
  // Descarta interações já expiradas (Discord dá apenas 3s para responder)
  const age = Date.now() - interaction.createdTimestamp;
  if (age > 2500 && interaction.type !== InteractionType.ApplicationCommandAutocomplete) {
    console.warn(`[Discord] Interação expirada descartada (${age}ms): ${interaction.id}`);
    return;
  }

  try {
    // ── Autocomplete ─────────────────────────────────────────────────────────
    if (interaction.type === InteractionType.ApplicationCommandAutocomplete) {
      const auto = interaction as AutocompleteInteraction;
      const cmd  = commands.get(auto.commandName);
      if (cmd && 'autocomplete' in cmd && cmd.autocomplete) {
        await cmd.autocomplete(auto);
      }
      return;
    }

    // ── Slash command ─────────────────────────────────────────────────────────
    if (interaction.isChatInputCommand()) {
      const cmd = commands.get(interaction.commandName);
      if (!cmd) return;
      await cmd.execute(interaction as ChatInputCommandInteraction);
      return;
    }

    // ── Botões inline ─────────────────────────────────────────────────────────
    if (interaction.isButton()) {
      const btn = interaction as ButtonInteraction;
      const guildId = btn.guildId!;

      if (btn.customId === 'btn_next') {
        try { await btn.deferUpdate(); } catch (e: any) { if (e.code === 10062) return; throw e; }
        const next = voiceManager.skip(guildId);
        const desc = next ? `A tocar: **${next.title}**` : '📭 Fila vazia.';
        await btn.followUp({ embeds: [new EmbedBuilder().setColor(0xF5A820).setTitle('⏭ Próxima').setDescription(desc)], ephemeral: false });
        return;
      }

      if (btn.customId === 'btn_stop') {
        try { await btn.deferUpdate(); } catch (e: any) { if (e.code === 10062) return; throw e; }
        voiceManager.stop(guildId);
        await btn.followUp({ embeds: [new EmbedBuilder().setColor(0x8A8880).setTitle('⏹ Parado').setDescription('Reprodução encerrada.')], ephemeral: false });
        return;
      }

      if (btn.customId === 'btn_queue') {
        try { await btn.deferReply({ flags: 64 }); } catch (e: any) { if (e.code === 10062) return; throw e; }
        const state = voiceManager.getState(guildId);
        const embed = new EmbedBuilder().setColor(0x5294E0).setTitle('🎵 Fila');
        if (!state?.current) {
          embed.setDescription('Nenhuma música tocando.');
        } else {
          embed.setDescription(`▶ **${state.current.title}** — ${state.current.artist}`);
          if (state.queue.length > 0) {
            embed.addFields({ name: `📋 Na fila (${state.queue.length})`, value: state.queue.slice(0, 10).map((t, i) => `\`${i + 2}.\` ${t.title}`).join('\n') });
          }
        }
        await btn.editReply({ embeds: [embed] });
        return;
      }
    }
  } catch (err: any) {
    console.error('[Discord] Erro ao processar interação:', err.message);
    try {
      const reply = { embeds: [buildErrorEmbed(err.message ?? 'Ocorreu um erro inesperado.')] };
      if ('deferred' in interaction && interaction.deferred) {
        await (interaction as any).editReply(reply);
      } else if ('replied' in interaction && !(interaction as any).replied) {
        await (interaction as any).reply({ ...reply, flags: 64 });
      }
    } catch { /* ignora erro secundário */ }
  }
});

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
