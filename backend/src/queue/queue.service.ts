import { prisma } from '../config/database';
import { musicService, SearchResult, MusicSource } from '../music/music.service';
import { AppError, NotFoundError } from '../utils/errors';
import { logger } from '../utils/logger';

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type PlayerCommand = 'play' | 'stop' | 'next' | 'turnup' | 'turndown';

export interface QueueState {
  userId: string;
  current: QueueTrack | null;
  queue: QueueTrack[];
  isPlaying: boolean;
  volume: number; // 0–100
}

export interface QueueTrack {
  queueId: string;
  position: number;
  track: {
    id: string;
    title: string;
    artist: string;
    album?: string | null;
    duration?: number | null;
    coverUrl?: string | null;
    spotifyId?: string | null;
    youtubeId?: string | null;
  };
  source: string;
  addedAt: Date;
}

export interface PlayCommandResult {
  action: 'playing' | 'queued';
  track: QueueTrack;
  queuePosition?: number;
  message: string;
}

const VOLUME_STEP = 10;
const MAX_QUEUE_SIZE = 50;

// ─── Queue Service ────────────────────────────────────────────────────────────

export class QueueService {
  // ─── Play ──────────────────────────────────────────────────────────────────
  // Regra: somente uma música por vez.
  // Se já tiver algo tocando, adiciona na fila.

  async play(
    userId: string,
    query: string,
    source: MusicSource | 'all' = 'all'
  ): Promise<PlayCommandResult> {
    if (!query?.trim()) {
      throw new AppError('Informe o nome da música para reproduzir.', 400, 'EMPTY_QUERY');
    }

    // Busca a música
    const results = await musicService.search(query.trim(), source, 5);

    if (results.length === 0) {
      throw new AppError(
        `Nenhuma música encontrada para "${query}". Tente um nome diferente.`,
        404,
        'TRACK_NOT_FOUND'
      );
    }

    const best = results[0];

    // Verifica tamanho máximo da fila
    const queueSize = await prisma.queueItem.count({
      where: { userId, playedAt: null },
    });

    if (queueSize >= MAX_QUEUE_SIZE) {
      throw new AppError(
        `A fila está cheia (${MAX_QUEUE_SIZE} músicas). Use "stop" para limpar.`,
        400,
        'QUEUE_FULL'
      );
    }

    // Salva track no banco
    const dbTrack = await prisma.track.upsert({
      where: best.source === 'spotify'
        ? { spotifyId: best.sourceId }
        : { youtubeId: best.sourceId },
      update: {},
      create: {
        title: best.title,
        artist: best.artist,
        album: best.album,
        duration: best.duration,
        coverUrl: best.coverUrl,
        previewUrl: best.previewUrl,
        spotifyId: best.source === 'spotify' ? best.sourceId : undefined,
        youtubeId: best.source === 'youtube' ? best.sourceId : undefined,
      },
    });

    // Próxima posição na fila
    const lastItem = await prisma.queueItem.findFirst({
      where: { userId, playedAt: null },
      orderBy: { position: 'desc' },
    });
    const nextPosition = (lastItem?.position ?? 0) + 1;

    const queueItem = await prisma.queueItem.create({
      data: {
        userId,
        trackId: dbTrack.id,
        position: nextPosition,
        source: best.source,
      },
      include: { track: true },
    });

    const queueTrack = this.toQueueTrack(queueItem);
    const isFirst = nextPosition === 1;

    logger.info(`[Queue] ${isFirst ? 'Reproduzindo' : 'Adicionado à fila'}: "${best.title}" para userId=${userId}`);

    return {
      action: isFirst ? 'playing' : 'queued',
      track: queueTrack,
      queuePosition: isFirst ? undefined : nextPosition,
      message: isFirst
        ? `▶️ Reproduzindo: ${best.title} — ${best.artist}`
        : `🎵 Adicionado à fila (#${nextPosition}): ${best.title} — ${best.artist}`,
    };
  }

  // ─── Stop ──────────────────────────────────────────────────────────────────

  async stop(userId: string): Promise<{ message: string }> {
    const result = await prisma.queueItem.updateMany({
      where: { userId, playedAt: null },
      data: { playedAt: new Date() },
    });

    if (result.count === 0) {
      return { message: '⏹ Nenhuma música em reprodução.' };
    }

    logger.info(`[Queue] Stop: ${result.count} item(s) removido(s) para userId=${userId}`);
    return { message: `⏹ Reprodução parada. ${result.count} música(s) removida(s) da fila.` };
  }

  // ─── Next ──────────────────────────────────────────────────────────────────

  async next(userId: string): Promise<PlayCommandResult | { message: string }> {
    // Marca a música atual como tocada
    const current = await prisma.queueItem.findFirst({
      where: { userId, playedAt: null },
      orderBy: { position: 'asc' },
    });

    if (!current) {
      return { message: '📭 A fila está vazia.' };
    }

    await prisma.queueItem.update({
      where: { id: current.id },
      data: { playedAt: new Date() },
    });

    // Busca a próxima
    const nextItem = await prisma.queueItem.findFirst({
      where: { userId, playedAt: null },
      orderBy: { position: 'asc' },
      include: { track: true },
    });

    if (!nextItem) {
      return { message: '✅ Fila concluída. Não há mais músicas.' };
    }

    const queueTrack = this.toQueueTrack(nextItem);
    logger.info(`[Queue] Next: "${nextItem.track.title}" para userId=${userId}`);

    return {
      action: 'playing',
      track: queueTrack,
      message: `⏭ Próxima: ${nextItem.track.title} — ${nextItem.track.artist}`,
    };
  }

  // ─── Volume ────────────────────────────────────────────────────────────────

  async turnUp(userId: string): Promise<{ volume: number; message: string }> {
    return this.adjustVolume(userId, +VOLUME_STEP);
  }

  async turnDown(userId: string): Promise<{ volume: number; message: string }> {
    return this.adjustVolume(userId, -VOLUME_STEP);
  }

  private async adjustVolume(
    userId: string,
    delta: number
  ): Promise<{ volume: number; message: string }> {
    const prefs = await prisma.userPreferences.findUnique({ where: { userId } });

    if (!prefs) {
      throw new NotFoundError('Preferências do usuário');
    }

    const newVolume = Math.max(0, Math.min(100, prefs.volume + delta));

    await prisma.userPreferences.update({
      where: { userId },
      data: { volume: newVolume },
    });

    const icon = delta > 0 ? '🔊' : '🔉';
    const label = newVolume === 0 ? '(mudo)' : `${newVolume}%`;

    return {
      volume: newVolume,
      message: `${icon} Volume: ${label}`,
    };
  }

  // ─── Estado atual da fila ─────────────────────────────────────────────────

  async getState(userId: string): Promise<QueueState> {
    const [items, prefs] = await Promise.all([
      prisma.queueItem.findMany({
        where: { userId, playedAt: null },
        orderBy: { position: 'asc' },
        include: { track: true },
        take: MAX_QUEUE_SIZE,
      }),
      prisma.userPreferences.findUnique({ where: { userId } }),
    ]);

    const [current, ...rest] = items;

    return {
      userId,
      current: current ? this.toQueueTrack(current) : null,
      queue: rest.map(i => this.toQueueTrack(i)),
      isPlaying: !!current,
      volume: prefs?.volume ?? 80,
    };
  }

  // ─── Dispatch de comando ───────────────────────────────────────────────────
  // Centraliza os 5 comandos: play, stop, next, turnup, turndown

  async dispatch(
    userId: string,
    command: PlayerCommand,
    args: { query?: string; source?: MusicSource | 'all' } = {}
  ) {
    switch (command) {
      case 'play':
        if (!args.query) throw new AppError('Informe o nome da música após "play:"', 400, 'MISSING_QUERY');
        return this.play(userId, args.query, args.source);
      case 'stop':
        return this.stop(userId);
      case 'next':
        return this.next(userId);
      case 'turnup':
        return this.turnUp(userId);
      case 'turndown':
        return this.turnDown(userId);
      default:
        throw new AppError(
          `Comando desconhecido: "${command}". Use: play, stop, next, turnup ou turndown.`,
          400,
          'UNKNOWN_COMMAND'
        );
    }
  }

  // ─── Helper ───────────────────────────────────────────────────────────────

  private toQueueTrack(item: any): QueueTrack {
    return {
      queueId: item.id,
      position: item.position,
      track: {
        id: item.track.id,
        title: item.track.title,
        artist: item.track.artist,
        album: item.track.album,
        duration: item.track.duration,
        coverUrl: item.track.coverUrl,
        spotifyId: item.track.spotifyId,
        youtubeId: item.track.youtubeId,
      },
      source: item.source,
      addedAt: item.addedAt,
    };
  }
}

export const queueService = new QueueService();
