import {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  VoiceConnectionStatus,
  AudioPlayer,
  VoiceConnection,
  StreamType,
  NoSubscriberBehavior,
} from '@discordjs/voice';
import { VoiceBasedChannel } from 'discord.js';
import { spawn } from 'child_process';
import path from 'path';
import { FFMPEG_BIN, FFMPEG_EXE, YTDLP_EXE, getStreamUrl as fetchStreamUrl } from '../utils/ytdlp';

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface TrackInfo {
  title: string;
  artist: string;
  youtubeId: string;
}

interface GuildState {
  player: AudioPlayer;
  connection: VoiceConnection;
  current: TrackInfo | null;
  queue: TrackInfo[];
  volume: number;
}

// ─── Estado por servidor ──────────────────────────────────────────────────────

const states = new Map<string, GuildState>();

// ─── API pública ──────────────────────────────────────────────────────────────

export async function joinAndPlay(
  voiceChannel: VoiceBasedChannel,
  track: TrackInfo,
  volume = 80
): Promise<void> {
  const guildId = voiceChannel.guild.id;
  let state = states.get(guildId);

  if (!state) {
    const joinOpts: any = {
      channelId: voiceChannel.id,
      guildId,
      adapterCreator: voiceChannel.guild.voiceAdapterCreator,
      selfDeaf: false,
      selfMute: false,
      debug: true,
    };
    const connection = joinVoiceChannel(joinOpts);

    const player = createAudioPlayer({
      behaviors: { noSubscriber: NoSubscriberBehavior.Pause },
    });
    connection.subscribe(player);

    state = { player, connection, current: null, queue: [], volume };
    states.set(guildId, state);

    player.on(AudioPlayerStatus.Idle, () => {
      state!.current = null;
      playNext(guildId);
    });

    player.on('error', (err) => {
      console.error(`[VoiceManager] Erro no player (guild=${guildId}):`, err.message);
      state!.current = null;
      playNext(guildId);
    });

    // Loga todas as transições de estado da conexão de voz
    connection.on('stateChange', (oldState, newState) => {
      console.log(`[VoiceManager] Conexão: ${oldState.status} → ${newState.status}`);
    });

    // Debug detalhado da conexão de voz
    connection.on('debug', (msg) => {
      console.log(`[VoiceDebug] ${msg}`);
    });

    connection.on(VoiceConnectionStatus.Disconnected, () => {
      console.warn(`[VoiceManager] Desconectado do canal de voz (guild=${guildId})`);
      stop(guildId);
    });

    (connection as any).on('close', (code: number) => {
      console.warn(`[VoiceManager] Networking fechou com código: ${code} (guild=${guildId})`);
    });

    connection.on('error', (err) => {
      console.error(`[VoiceManager] Erro na conexão de voz (guild=${guildId}):`, err.message);
    });

    // Loga transições do player
    state.player.on('stateChange', (oldState, newState) => {
      console.log(`[VoiceManager] Player: ${oldState.status} → ${newState.status}`);
    });

    console.log(`[VoiceManager] Conectado ao canal: ${voiceChannel.name} (guild=${guildId})`);
  } else if (state.connection.joinConfig.channelId !== voiceChannel.id) {
    // Usuário está em outro canal — migra
    const newConnection = joinVoiceChannel({
      channelId: voiceChannel.id,
      guildId,
      adapterCreator: voiceChannel.guild.voiceAdapterCreator as any,
      selfDeaf: false,
      selfMute: false,
    });
    newConnection.subscribe(state.player);
    state.connection = newConnection;
    console.log(`[VoiceManager] Migrado para canal: ${voiceChannel.name}`);
  }

  state.queue.push(track);

  if (state.player.state.status === AudioPlayerStatus.Idle) {
    playNext(guildId);
  }
}

export function stop(guildId: string): void {
  const state = states.get(guildId);
  if (!state) return;
  state.queue = [];
  state.current = null;
  state.player.stop(true);
  state.connection.destroy();
  states.delete(guildId);
}

export function skip(guildId: string): TrackInfo | null {
  const state = states.get(guildId);
  if (!state) return null;
  state.player.stop();
  return state.queue[0] ?? null;
}

export function getState(guildId: string) {
  const state = states.get(guildId);
  if (!state) return null;
  return {
    current: state.current,
    queue: [...state.queue],
    volume: state.volume,
    isPlaying: state.player.state.status === AudioPlayerStatus.Playing,
  };
}

export function setVolume(guildId: string, volume: number): number {
  const clamped = Math.max(0, Math.min(100, volume));
  const state = states.get(guildId);
  if (state) state.volume = clamped;
  return clamped;
}

// ─── Interno ──────────────────────────────────────────────────────────────────

function playNext(guildId: string): void {
  const state = states.get(guildId);
  if (!state) return;

  const next = state.queue.shift();
  if (!next) {
    setTimeout(() => {
      const s = states.get(guildId);
      if (s && s.player.state.status === AudioPlayerStatus.Idle) {
        s.connection.destroy();
        states.delete(guildId);
      }
    }, 60_000);
    return;
  }

  state.current = next;
  streamTrack(guildId, next).catch(err => {
    console.error(`[VoiceManager] Falha ao iniciar stream (guild=${guildId}):`, err.message);
    state.current = null;
    playNext(guildId);
  });
}

async function streamTrack(guildId: string, track: TrackInfo): Promise<void> {
  const state = states.get(guildId);
  if (!state) return;

  console.log(`[VoiceManager] ▶ Tocando: ${track.title} — ${track.artist}`);

  const streamUrl = await fetchStreamUrl(track.youtubeId);
  console.log(`[VoiceManager] Stream URL obtida, iniciando ffmpeg...`);

  // ffmpeg → OggOpus (format nativo do @discordjs/voice, sem re-encoding pelo Node)
  const ffmpeg = spawn(FFMPEG_EXE, [
    '-reconnect', '1',
    '-reconnect_streamed', '1',
    '-reconnect_delay_max', '5',
    '-i', streamUrl,
    '-vn',                    // sem vídeo
    '-c:a', 'libopus',        // codec Opus
    '-b:a', '128k',
    '-ar', '48000',
    '-ac', '2',
    '-f', 'ogg',              // container OggOpus
    'pipe:1',
  ], { stdio: ['ignore', 'pipe', 'pipe'] });

  let ffmpegStarted = false;
  const ffmpegErrors: string[] = [];

  ffmpeg.stderr.on('data', (d: Buffer) => {
    const msg = d.toString();
    if (!ffmpegStarted && msg.includes('Output #0')) {
      ffmpegStarted = true;
      console.log('[VoiceManager] ffmpeg iniciou output de áudio');
    }
    // Coleta erros reais (não progresso)
    if (msg.toLowerCase().includes('error') || msg.toLowerCase().includes('invalid')) {
      ffmpegErrors.push(msg.trim());
      console.error('[ffmpeg]', msg.trim());
    }
  });

  ffmpeg.on('error', (err) => {
    console.error('[VoiceManager] ffmpeg spawn error:', err.message);
  });

  ffmpeg.on('close', (code) => {
    if (code !== 0 && code !== null) {
      console.error(`[VoiceManager] ffmpeg encerrou com código ${code}`);
      if (ffmpegErrors.length) console.error('Erros ffmpeg:', ffmpegErrors.join('\n'));
    }
  });

  const resource = createAudioResource(ffmpeg.stdout, {
    inputType: StreamType.OggOpus,  // @discordjs/voice lê Ogg/Opus nativamente
    inlineVolume: true,
  });

  resource.volume?.setVolume(state.volume / 100);
  state.player.play(resource);
  console.log(`[VoiceManager] Player iniciado com resource OggOpus`);
}
