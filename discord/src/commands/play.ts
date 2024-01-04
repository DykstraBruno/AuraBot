import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  AutocompleteInteraction,
  GuildMember,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} from 'discord.js';
import { joinAndPlay } from '../voice/voiceManager';
import { searchYouTube } from '../utils/ytdlp';
import { buildErrorEmbed } from '../utils/embeds';

// ─── Definição do comando ─────────────────────────────────────────────────────

export const data = new SlashCommandBuilder()
  .setName('play')
  .setDescription('🎵 Toca uma música no canal de voz')
  .addStringOption(opt =>
    opt.setName('query')
      .setDescription('Nome ou URL da música')
      .setRequired(true)
      .setAutocomplete(true)
  );

// ─── Autocomplete ─────────────────────────────────────────────────────────────

export async function autocomplete(interaction: AutocompleteInteraction) {
  const focused = interaction.options.getFocused();
  if (!focused || focused.length < 2) return interaction.respond([]).catch(() => {});

  try {
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('timeout')), 2500)
    );
    const results = await Promise.race([searchYouTube(focused, 5), timeout]);
    await interaction.respond(
      results.map(r => ({
        name: `${r.title} — ${r.artist}`.slice(0, 100),
        value: r.title.slice(0, 100),
      }))
    ).catch(() => {});
  } catch {
    await interaction.respond([]).catch(() => {});
  }
}

// ─── Execução ─────────────────────────────────────────────────────────────────

export async function execute(interaction: ChatInputCommandInteraction) {
  try {
    await interaction.deferReply();
  } catch (err: any) {
    if (err.code === 10062) return;
    throw err;
  }

  const query = interaction.options.getString('query', true);
  const member = interaction.member as GuildMember;
  const voiceChannel = member?.voice?.channel;

  if (!voiceChannel) {
    await interaction.editReply({
      embeds: [buildErrorEmbed('Você precisa estar em um canal de voz para usar este comando.')],
    });
    return;
  }

  try {
    console.log(`[Play] Buscando no YouTube: "${query}"`);
    const results = await searchYouTube(query, 1);

    if (!results.length) {
      await interaction.editReply({
        embeds: [buildErrorEmbed('Nenhuma música encontrada para essa pesquisa.')],
      });
      return;
    }

    const track = results[0];
    console.log(`[Play] Encontrada: ${track.title} — ${track.artist} (${track.youtubeId})`);

    await joinAndPlay(voiceChannel, track);

    const embed = new EmbedBuilder()
      .setColor(0xF5A820)
      .setTitle('▶ Adicionado à fila')
      .setDescription(`**${track.title}**\n${track.artist}`)
      .setFooter({ text: `Pedido por ${interaction.user.username}` })
      .setTimestamp();

    if (track.thumbnail) embed.setThumbnail(track.thumbnail);
    if (track.duration) {
      const m = Math.floor(track.duration / 60);
      const s = track.duration % 60;
      embed.addFields({ name: 'Duração', value: `\`${m}:${s.toString().padStart(2, '0')}\``, inline: true });
    }

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('btn_next').setLabel('⏭ Próxima').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('btn_stop').setLabel('⏹ Stop').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('btn_queue').setLabel('📋 Fila').setStyle(ButtonStyle.Secondary),
    );

    await interaction.editReply({ embeds: [embed], components: [row] });
  } catch (err: any) {
    console.error(`[Play] ERRO:`, err.message);
    await interaction.editReply({
      embeds: [buildErrorEmbed(err.message ?? 'Erro ao reproduzir música.')],
    });
  }
}
