import { AppError, ExternalAPIError } from '../utils/errors';
import { logger } from '../utils/logger';
import { queueService } from '../queue/queue.service';
import { PlayerCommand } from '../queue/queue.service';
import { MusicSource } from '../music/music.service';

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface VoiceCommandResult {
  transcription: string;
  command:        PlayerCommand | null;
  query:          string | null;
  response:       string;
  language:       string;
  queueResult?:   unknown;
}

export type SupportedLanguage = 'pt' | 'en';

export const SUPPORTED_LANGUAGES: Record<SupportedLanguage, string> = {
  pt: 'Português (Brasil)',
  en: 'English',
};

// ─── Mensagens de resposta por idioma ─────────────────────────────────────────

const MESSAGES: Record<SupportedLanguage, {
  notFound:      (query: string) => string;
  notUnderstood: (text: string)  => string;
}> = {
  pt: {
    notFound:      q => `Não encontrei "${q}" no YouTube. Tente um nome diferente.`,
    notUnderstood: t => `Não entendi "${t}". Diga: "Play nome da música", "Stop", "Próxima", "Mais alto" ou "Mais baixo".`,
  },
  en: {
    notFound:      q => `Couldn't find "${q}" on YouTube. Try a different name.`,
    notUnderstood: t => `I didn't understand "${t}". Say: "Play song name", "Stop", "Next", "Turn up" or "Turn down".`,
  },
};

// ─── Formatos de áudio aceitos ────────────────────────────────────────────────

const SUPPORTED_MIME_TYPES = new Set([
  'audio/webm', 'audio/mp4', 'audio/mpeg',
  'audio/wav', 'audio/ogg', 'audio/flac', 'audio/m4a',
]);

const MAX_AUDIO_BYTES = 25 * 1024 * 1024;

// ─── Resposta da STT API ───────────────────────────────────────────────────────

interface SttApiResponse {
  success:       boolean;
  transcription?: string;
  command:       PlayerCommand | null;
  query:         string | null;
  action:        string;
  language:      SupportedLanguage;
  error?:        string;
}

// ─── Serviço ──────────────────────────────────────────────────────────────────

export class VoiceService {
  private readonly sttUrl: string;
  private readonly sttKey: string;

  constructor() {
    this.sttUrl = (process.env.STT_API_URL ?? 'http://localhost:3003').replace(/\/$/, '');
    this.sttKey = process.env.STT_API_KEY ?? '';
  }

  // ─── Fluxo principal ──────────────────────────────────────────────────────

  async processVoiceCommand(
    userId: string,
    audio: Buffer,
    mimeType: string,
    options: {
      language?: SupportedLanguage;
      source?:   MusicSource | 'all';
    } = {}
  ): Promise<VoiceCommandResult> {
    this.validateAudio(audio, mimeType);

    const lang      = options.language ?? 'pt';
    const sttResult = await this.callSttApi(audio, mimeType, lang);
    const detected  = sttResult.language ?? lang;
    const msgs      = MESSAGES[detected] ?? MESSAGES.pt;

    if (sttResult.command === null) {
      return {
        transcription: sttResult.transcription ?? '',
        command:       null,
        query:         null,
        response:      msgs.notUnderstood(sttResult.transcription ?? ''),
        language:      detected,
      };
    }

    let response    = sttResult.action;
    let queueResult: unknown;

    try {
      queueResult = await queueService.dispatch(userId, sttResult.command, {
        query:  sttResult.query ?? undefined,
        source: options.source,
      });

      if ((queueResult as any).message)                                          response = (queueResult as any).message;
      if ((queueResult as any).code === 'TRACK_NOT_FOUND' && sttResult.query)   response = msgs.notFound(sttResult.query);
    } catch (err: any) {
      if (err.code === 'TRACK_NOT_FOUND' && sttResult.query) {
        response = msgs.notFound(sttResult.query);
      } else {
        response = err.message ?? msgs.notUnderstood(sttResult.transcription ?? '');
      }
      logger.warn(`Erro no comando de voz: ${err.message}`);
    }

    return {
      transcription: sttResult.transcription ?? '',
      command:       sttResult.command,
      query:         sttResult.query,
      response,
      language:      detected,
      queueResult,
    };
  }

  // ─── Transcrição simples (sem dispatch de comando) ────────────────────────

  async transcribe(
    audio: Buffer,
    mimeType: string,
    language: SupportedLanguage = 'pt'
  ): Promise<{ text: string; language: string }> {
    this.validateAudio(audio, mimeType);
    const result = await this.callSttApi(audio, mimeType, language);
    return { text: result.transcription ?? '', language: result.language };
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private async callSttApi(audio: Buffer, mimeType: string, language: SupportedLanguage): Promise<SttApiResponse> {
    if (!this.sttKey) throw new ExternalAPIError('STT API', 'STT_API_KEY não configurada');

    const formData = new FormData();
    formData.append('audio', new Blob([audio], { type: mimeType }), `audio.${this.mimeToExt(mimeType)}`);
    formData.append('language', language);

    const res = await fetch(`${this.sttUrl}/api/transcribe`, {
      method: 'POST',
      headers: { 'x-api-key': this.sttKey },
      body: formData,
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({})) as any;
      throw new ExternalAPIError('STT API', body.error ?? `HTTP ${res.status}`);
    }

    return res.json() as Promise<SttApiResponse>;
  }

  private validateAudio(buffer: Buffer, mimeType: string): void {
    if (!buffer || buffer.length === 0)
      throw new AppError('Arquivo de áudio está vazio.', 400, 'EMPTY_AUDIO');
    if (buffer.length > MAX_AUDIO_BYTES)
      throw new AppError(`Áudio muito grande. Máximo: ${MAX_AUDIO_BYTES / 1024 / 1024}MB.`, 413, 'AUDIO_TOO_LARGE');
    if (!SUPPORTED_MIME_TYPES.has(mimeType))
      throw new AppError(`Formato não suportado: ${mimeType}.`, 415, 'UNSUPPORTED_FORMAT');
  }

  private mimeToExt(mime: string): string {
    const map: Record<string, string> = {
      'audio/webm': 'webm', 'audio/mp4': 'mp4',  'audio/mpeg': 'mp3',
      'audio/wav':  'wav',  'audio/ogg': 'ogg',   'audio/flac': 'flac',
      'audio/m4a':  'm4a',
    };
    return map[mime] ?? 'webm';
  }
}

export const voiceService = new VoiceService();
