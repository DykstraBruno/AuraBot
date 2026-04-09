import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import * as voiceManager from '../voice/voiceManager';
import { buildErrorEmbed } from '../utils/embeds';

const COLORS = {
  stop:   0x8A8880 as const,
  next:   0xF5A820 as const,
  volume: 0xA78BFA as const,
  queue:  0x5294E0 as const,
};

function volumeBar(vol: number): string {
  const blocks = Math.round(vol / 10);
  return '█'.repeat(blocks) + '░'.repeat(10 - blocks);
}

function formatDuration(secs?: number): string {
  if (!secs) return '';
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `\`${m}:${s.toString().padStart(2, '0')}\``;
}

// ─── /stop ────────────────────────────────────────────────────────────────────

export const stopData = new SlashCommandBuilder()
  .setName('stop')
  .setDescription('⏹ Para a reprodução e sai do canal de voz');

export async function stopExecute(interaction: ChatInputCommandInteraction) {
  try { await interaction.deferReply(); } catch (e: any) { if (e.code === 10062) return; throw e; }
  try {
    voiceManager.stop(interaction.guildId!);
    await interaction.editReply({
      embeds: [new EmbedBuilder().setColor(COLORS.stop).setTitle('⏹ Parado').setDescription('Reprodução encerrada.').setTimestamp()],
    });
  } catch (err: any) {
    await interaction.editReply({ embeds: [buildErrorEmbed(err.message)] });
  }
}

// ─── /next ────────────────────────────────────────────────────────────────────

export const nextData = new SlashCommandBuilder()
  .setName('next')
  .setDescription('⏭ Pula para a próxima música da fila');

export async function nextExecute(interaction: ChatInputCommandInteraction) {
  try { await interaction.deferReply(); } catch (e: any) { if (e.code === 10062) return; throw e; }
  try {
    const next = voiceManager.skip(interaction.guildId!);
    const state = voiceManager.getState(interaction.guildId!);
    const desc = next
      ? `A tocar: **${next.title}**`
      : state?.current
        ? `A tocar: **${state.current.title}**`
        : '📭 Fila vazia.';
    await interaction.editReply({
      embeds: [new EmbedBuilder().setColor(COLORS.next).setTitle('⏭ Próxima').setDescription(desc).setTimestamp()],
    });
  } catch (err: any) {
    await interaction.editReply({ embeds: [buildErrorEmbed(err.message)] });
  }
}

// ─── /turnup ─────────────────────────────────────────────────────────────────

export const turnupData = new SlashCommandBuilder()
  .setName('turnup')
  .setDescription('🔊 Aumenta o volume em 10%');

export async function turnupExecute(interaction: ChatInputCommandInteraction) {
  try { await interaction.deferReply({ flags: 64 }); } catch (e: any) { if (e.code === 10062) return; throw e; }
  try {
    const guildId = interaction.guildId!;
    const state = voiceManager.getState(guildId);
    const current = state?.volume ?? 80;
    const vol = voiceManager.setVolume(guildId, current + 10);
    await interaction.editReply({
      embeds: [new EmbedBuilder().setColor(COLORS.volume).setTitle('🔊 Volume').setDescription(`\`${volumeBar(vol)}\` **${vol}%**`).setTimestamp()],
    });
  } catch (err: any) {
    await interaction.editReply({ embeds: [buildErrorEmbed(err.message)] });
  }
}

// ─── /turndown ────────────────────────────────────────────────────────────────

export const turndownData = new SlashCommandBuilder()
  .setName('turndown')
  .setDescription('🔉 Diminui o volume em 10%');

export async function turndownExecute(interaction: ChatInputCommandInteraction) {
  try { await interaction.deferReply({ flags: 64 }); } catch (e: any) { if (e.code === 10062) return; throw e; }
  try {
    const guildId = interaction.guildId!;
    const state = voiceManager.getState(guildId);
    const current = state?.volume ?? 80;
    const vol = voiceManager.setVolume(guildId, current - 10);
    await interaction.editReply({
      embeds: [new EmbedBuilder().setColor(COLORS.volume).setTitle('🔉 Volume').setDescription(`\`${volumeBar(vol)}\` **${vol}%**`).setTimestamp()],
    });
  } catch (err: any) {
    await interaction.editReply({ embeds: [buildErrorEmbed(err.message)] });
  }
}

// ─── /queue ───────────────────────────────────────────────────────────────────

export const queueData = new SlashCommandBuilder()
  .setName('queue')
  .setDescription('📋 Exibe a fila de reprodução atual');

export async function queueExecute(interaction: ChatInputCommandInteraction) {
  try { await interaction.deferReply(); } catch (e: any) { if (e.code === 10062) return; throw e; }
  try {
    const state = voiceManager.getState(interaction.guildId!);
    const embed = new EmbedBuilder().setColor(COLORS.queue).setTitle('🎵 Fila do AuraBot').setTimestamp();

    if (!state?.current) {
      embed.setDescription('Nenhuma música tocando no momento.');
    } else {
      embed.addFields({
        name: '▶ Tocando agora',
        value: `**${state.current.title}** — ${state.current.artist}`,
        inline: false,
      });
      if (state.queue.length > 0) {
        const lines = state.queue.slice(0, 10).map((t, i) =>
          `\`${i + 2}.\` ${t.title} — ${t.artist}`
        );
        if (state.queue.length > 10) lines.push(`*...e mais ${state.queue.length - 10} músicas*`);
        embed.addFields({ name: `📋 Na fila (${state.queue.length})`, value: lines.join('\n'), inline: false });
      }
      embed.setFooter({ text: `Volume: ${state.volume}%` });
    }

    await interaction.editReply({ embeds: [embed] });
  } catch (err: any) {
    await interaction.editReply({ embeds: [buildErrorEmbed(err.message)] });
  }
}
