import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  AutocompleteInteraction,
} from 'discord.js';
import { AuraBotApiClient } from '../utils/apiClient';
import { buildTrackEmbed, buildErrorEmbed } from '../utils/embeds';

export const data = new SlashCommandBuilder()
  .setName('play')
  .setDescription('▶ Toca uma música ou adiciona à fila')
  .addStringOption(opt =>
    opt
      .setName('musica')
      .setDescription('Nome da música ou artista')
      .setRequired(true)
      .setAutocomplete(true)
  )
  .addStringOption(opt =>
    opt
      .setName('fonte')
      .setDescription('Fonte da música (padrão: todas)')
      .setRequired(false)
      .addChoices(
        { name: '🔀 Todas',     value: 'all'     },
        { name: '🎵 Spotify',   value: 'spotify'  },
        { name: '▶️ YouTube',   value: 'youtube'  }
      )
  );

export async function autocomplete(
  interaction: AutocompleteInteraction,
  client: AuraBotApiClient
) {
  const focused = interaction.options.getFocused();
  if (!focused || focused.length < 2) {
    return interaction.respond([]);
  }

  try {
    const results = await client.search(interaction.user.id, focused);
    const choices = results.slice(0, 5).map((r: any) => ({
      name: `${r.title} — ${r.artist}`.slice(0, 100),
      value: `${r.title} ${r.artist}`.slice(0, 100),
    }));
    await interaction.respond(choices);
  } catch {
    await interaction.respond([]);
  }
}

export async function execute(
  interaction: ChatInputCommandInteraction,
  client: AuraBotApiClient
) {
  const query  = interaction.options.getString('musica', true);
  const source = interaction.options.getString('fonte') ?? 'all';

  await interaction.deferReply();

  try {
    const result = await client.play(interaction.user.id, query);
    const embed  = buildTrackEmbed(result, interaction.user.username);

    // Adiciona botões rápidos
    const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = await import('discord.js');
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('btn_next')
        .setLabel('⏭ Próxima')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('btn_stop')
        .setLabel('⏹ Stop')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('btn_queue')
        .setLabel('📋 Fila')
        .setStyle(ButtonStyle.Secondary),
    );

    await interaction.editReply({ embeds: [embed], components: [row] });
  } catch (err: any) {
    await interaction.editReply({
      embeds: [buildErrorEmbed(err.message ?? 'Erro ao reproduzir música.')],
    });
  }
}
