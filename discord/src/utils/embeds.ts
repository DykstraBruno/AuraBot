import { EmbedBuilder, ColorResolvable } from 'discord.js';
import { ApiQueueResult } from './apiClient';

const COLORS = {
  success: 0xF5A820 as ColorResolvable, // âmbar — tocando
  queued:  0x5294E0 as ColorResolvable, // azul — adicionado à fila
  info:    0x52C97A as ColorResolvable, // verde — info
  error:   0xE05252 as ColorResolvable, // vermelho — erro
  volume:  0xA78BFA as ColorResolvable, // roxo — volume
  stop:    0x8A8880 as ColorResolvable, // cinza — parado
};

function formatDuration(secs?: number | null): string {
  if (!secs) return '';
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `\`${m}:${s.toString().padStart(2, '0')}\``;
}

function sourceIcon(source: string): string {
  return source === 'spotify' ? '🎵' : '▶️';
}

// ─── Embed: música reproduzindo / adicionada à fila ──────────────────────────

export function buildTrackEmbed(result: ApiQueueResult, username: string): EmbedBuilder {
  const isPlaying = result.action === 'playing';
  const track = result.track?.track;

  const embed = new EmbedBuilder()
    .setColor(isPlaying ? COLORS.success : COLORS.queued)
    .setTitle(isPlaying ? '▶ Reproduzindo agora' : `#${result.queuePosition ?? '?'} Na fila`)
    .setFooter({ text: `Pedido por ${username}` })
    .setTimestamp();

  if (track) {
    embed.setDescription(
      `**${track.title}**\n${track.artist}` +
      (track.album ? `\n*${track.album}*` : '')
    );

    const fields: Array<{ name: string; value: string; inline: boolean }> = [];

    if (track.duration) {
      fields.push({ name: 'Duração', value: formatDuration(track.duration), inline: true });
    }
    if (result.track?.source) {
      fields.push({
        name: 'Fonte',
        value: `${sourceIcon(result.track.source)} ${result.track.source}`,
        inline: true,
      });
    }
    if (fields.length) embed.addFields(fields);

    if (track.coverUrl) embed.setThumbnail(track.coverUrl);
  } else {
    embed.setDescription(result.message);
  }

  return embed;
}

// ─── Embed: fila vazia / parado ───────────────────────────────────────────────

export function buildStopEmbed(message: string): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(COLORS.stop)
    .setTitle('⏹ Parado')
    .setDescription(message)
    .setTimestamp();
}

// ─── Embed: próxima música / fila concluída ───────────────────────────────────

export function buildNextEmbed(result: ApiQueueResult): EmbedBuilder {
  if (!result.track) {
    return new EmbedBuilder()
      .setColor(COLORS.info)
      .setTitle('📭 Fila vazia')
      .setDescription(result.message)
      .setTimestamp();
  }
  return buildTrackEmbed(result, 'AuraBot');
}

// ─── Embed: volume ────────────────────────────────────────────────────────────

export function buildVolumeEmbed(result: ApiQueueResult): EmbedBuilder {
  const vol = result.volume ?? 0;
  const blocks = Math.round(vol / 10);
  const bar = '█'.repeat(blocks) + '░'.repeat(10 - blocks);

  return new EmbedBuilder()
    .setColor(COLORS.volume)
    .setTitle(result.message.split(' ')[0] + ' Volume')
    .setDescription(`\`${bar}\` **${vol}%**`)
    .setTimestamp();
}

// ─── Embed: erro ──────────────────────────────────────────────────────────────

export function buildErrorEmbed(message: string): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(COLORS.error)
    .setTitle('❌ Erro')
    .setDescription(message)
    .setTimestamp();
}

// ─── Embed: fila de músicas ───────────────────────────────────────────────────

export function buildQueueEmbed(state: {
  current: any; queue: any[]; volume: number;
}): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(COLORS.success)
    .setTitle('🎵 Fila do AuraBot')
    .setTimestamp();

  if (!state.current) {
    embed.setDescription('Nenhuma música tocando no momento.');
    return embed;
  }

  const cur = state.current.track;
  embed.addFields({
    name: '▶ Tocando agora',
    value: `**${cur.title}** — ${cur.artist}${cur.duration ? ' ' + formatDuration(cur.duration) : ''}`,
    inline: false,
  });

  if (state.queue.length > 0) {
    const queueLines = state.queue.slice(0, 10).map((item: any, i: number) => {
      const t = item.track;
      return `\`${i + 2}.\` ${t.title} — ${t.artist}`;
    });

    if (state.queue.length > 10) {
      queueLines.push(`*...e mais ${state.queue.length - 10} músicas*`);
    }

    embed.addFields({
      name: `📋 Na fila (${state.queue.length})`,
      value: queueLines.join('\n'),
      inline: false,
    });
  }

  embed.setFooter({ text: `Volume: ${state.volume}%` });
  return embed;
}
