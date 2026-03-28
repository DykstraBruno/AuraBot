import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
} from 'discord.js';
import { AuraBotApiClient } from '../utils/apiClient';
import {
  buildStopEmbed,
  buildNextEmbed,
  buildVolumeEmbed,
  buildErrorEmbed,
  buildQueueEmbed,
} from '../utils/embeds';

// ─── /stop ────────────────────────────────────────────────────────────────────

export const stopData = new SlashCommandBuilder()
  .setName('stop')
  .setDescription('⏹ Para a reprodução e limpa a fila');

export async function stopExecute(
  interaction: ChatInputCommandInteraction,
  client: AuraBotApiClient
) {
  await interaction.deferReply();
  try {
    const result = await client.stop(interaction.user.id);
    await interaction.editReply({ embeds: [buildStopEmbed(result.message)] });
  } catch (err: any) {
    await interaction.editReply({ embeds: [buildErrorEmbed(err.message)] });
  }
}

// ─── /next ────────────────────────────────────────────────────────────────────

export const nextData = new SlashCommandBuilder()
  .setName('next')
  .setDescription('⏭ Pula para a próxima música da fila');

export async function nextExecute(
  interaction: ChatInputCommandInteraction,
  client: AuraBotApiClient
) {
  await interaction.deferReply();
  try {
    const result = await client.next(interaction.user.id);
    await interaction.editReply({ embeds: [buildNextEmbed(result)] });
  } catch (err: any) {
    await interaction.editReply({ embeds: [buildErrorEmbed(err.message)] });
  }
}

// ─── /turnup ─────────────────────────────────────────────────────────────────

export const turnupData = new SlashCommandBuilder()
  .setName('turnup')
  .setDescription('🔊 Aumenta o volume em 10%');

export async function turnupExecute(
  interaction: ChatInputCommandInteraction,
  client: AuraBotApiClient
) {
  await interaction.deferReply({ ephemeral: true });
  try {
    const result = await client.turnUp(interaction.user.id);
    await interaction.editReply({ embeds: [buildVolumeEmbed(result)] });
  } catch (err: any) {
    await interaction.editReply({ embeds: [buildErrorEmbed(err.message)] });
  }
}

// ─── /turndown ────────────────────────────────────────────────────────────────

export const turndownData = new SlashCommandBuilder()
  .setName('turndown')
  .setDescription('🔉 Diminui o volume em 10%');

export async function turndownExecute(
  interaction: ChatInputCommandInteraction,
  client: AuraBotApiClient
) {
  await interaction.deferReply({ ephemeral: true });
  try {
    const result = await client.turnDown(interaction.user.id);
    await interaction.editReply({ embeds: [buildVolumeEmbed(result)] });
  } catch (err: any) {
    await interaction.editReply({ embeds: [buildErrorEmbed(err.message)] });
  }
}

// ─── /queue ───────────────────────────────────────────────────────────────────

export const queueData = new SlashCommandBuilder()
  .setName('queue')
  .setDescription('📋 Exibe a fila de reprodução atual');

export async function queueExecute(
  interaction: ChatInputCommandInteraction,
  client: AuraBotApiClient
) {
  await interaction.deferReply();
  try {
    const state = await client.getQueue(interaction.user.id);
    await interaction.editReply({ embeds: [buildQueueEmbed(state)] });
  } catch (err: any) {
    await interaction.editReply({ embeds: [buildErrorEmbed(err.message)] });
  }
}
