import { AppError, ExternalAPIError } from '../utils/errors';
import { logger } from '../utils/logger';
import { queueService } from '../queue/queue.service';
import { PlayerCommand } from '../queue/queue.service';
import { MusicSource } from '../music/music.service';

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface TranscriptionResult {
  text: string;
  language: string;
  confidence: number;
  durationSeconds?: number;
}

export interface VoiceCommandResult {
  transcription: TranscriptionResult;
  command: PlayerCommand | null;
  query: string | null;
  response: string;
  audioResponse?: Buffer;
  queueResult?: unknown;
}

export type TTSVoice = 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer';

// ─── Idiomas suportados ───────────────────────────────────────────────────────

export type SupportedLanguage = 'pt' | 'en';

export const SUPPORTED_LANGUAGES: Record<SupportedLanguage, string> = {
  pt: 'Português (Brasil)',
  en: 'English',
};

// ─── Padrões de comando ───────────────────────────────────────────────────────
//
// Cada array contém os padrões de um idioma.
// A detecção testa pt-BR primeiro (idioma padrão), depois en.
// O fallback final trata o texto inteiro como nome de música (play implícito).

const PATTERNS: Record<SupportedLanguage, Array<{
  pattern: RegExp;
  command: PlayerCommand;
  extractQuery?: boolean;
}>> = {
  pt: [
    // play
    { pattern: /^(play|toque|reproduza?|coloca?|bota|quero ouvir|me coloca|me bota|põe|ponha)\s+(.+)/i, command: 'play', extractQuery: true },
    // stop
    { pattern: /^(stop|para(r)?|pausa(r)?|silêncio|chega|cancela(r)?|desliga(r)?)/i, command: 'stop' },
    // next
    { pattern: /^(próxima?|pula(r)?|avança(r)?|next|skip|passa(r)?|outra)/i, command: 'next' },
    // turnup
    { pattern: /^(mais alto|sobe(r)?( o)?( volume)?|aumenta(r)?( o)?( volume)?|volume (mais )?alto|turn up)/i, command: 'turnup' },
    // turndown
    { pattern: /^(mais baixo|baixa(r)?( o)?( volume)?|diminui(r)?( o)?( volume)?|volume (mais )?baixo|turn down)/i, command: 'turndown' },
  ],
  en: [
    // play
    { pattern: /^(play|put on|i want to hear|play me|can you play|start playing)\s+(.+)/i, command: 'play', extractQuery: true },
    // stop
    { pattern: /^(stop|pause|quiet|enough|cancel|turn off|shut up)/i, command: 'stop' },
    // next
    { pattern: /^(next|skip|forward|next (one|song|track)|skip (this|it))/i, command: 'next' },
    // turnup
    { pattern: /^(turn up|volume up|louder|increase (the )?volume|make it louder)/i, command: 'turnup' },
    // turndown
    { pattern: /^(turn down|volume down|quieter|decrease (the )?volume|lower (the )?volume|make it quieter)/i, command: 'turndown' },
  ],
};

// ─── Mensagens de resposta por idioma ─────────────────────────────────────────

const MESSAGES: Record<SupportedLanguage, {
  notFound:      (query: string) => string;
  notUnderstood: (text: string)  => string;
  emptyAudio:    string;
  help:          string;
}> = {
  pt: {
    notFound:      q => `Não encontrei "${q}" no Spotify nem no YouTube. Tente um nome diferente ou seja mais específico.`,
    notUnderstood: t => `Não entendi o comando "${t}". Você pode dizer: "Play nome da música", "Stop", "Próxima", "Mais alto" ou "Mais baixo".`,
    emptyAudio:    'Não consegui entender o áudio. Fale mais alto e claramente, e tente novamente.',
    help:          '"Play nome da música" · "Stop" · "Próxima" · "Mais alto" · "Mais baixo"',
  },
  en: {
    notFound:      q => `Couldn't find "${q}" on Spotify or YouTube. Try a different name or be more specific.`,
    notUnderstood: t => `I didn't understand "${t}". You can say: "Play song name", "Stop", "Next", "Turn up" or "Turn down".`,
    emptyAudio:    'Could not understand the audio. Please speak clearly and try again.',
    help:          '"Play song name" · "Stop" · "Next" · "Turn up" · "Turn down"',
  },
};

// ─── Formatos de áudio aceitos ────────────────────────────────────────────────

const SUPPORTED_MIME_TYPES = new Set([
  'audio/webm', 'audio/mp4', 'audio/mpeg',
  'audio/wav', 'audio/ogg', 'audio/flac', 'audio/m4a',
]);

const MAX_AUDIO_BYTES = 25 * 1024 * 1024; // 25 MB (limite do Whisper)

// ─── Serviço ──────────────────────────────────────────────────────────────────

export class VoiceService {
  private readonly ttsVoice: TTSVoice = 'nova';

  // ─── Transcrição (Whisper) ────────────────────────────────────────────────
  // language: 'pt' | 'en' — dica para o Whisper melhorar a precisão
  // O Whisper ainda detecta o idioma real e retorna em `result.language`

  async transcribe(
    audio: Buffer,
    mimeType: string,
    language: SupportedLanguage = 'pt'
  ): Promise<TranscriptionResult> {
    this.validateAudio(audio, mimeType);

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new ExternalAPIError('OpenAI', 'OPENAI_API_KEY não configurada');

    const formData = new FormData();
    formData.append('file', new Blob([audio], { type: mimeType }), `audio.${this.mimeToExt(mimeType)}`);
    formData.append('model', 'whisper-1');
    formData.append('language', language);
    formData.append('response_format', 'verbose_json');

    const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: formData,
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      if (res.status === 400) throw new AppError(MESSAGES[language].emptyAudio, 400, 'INVALID_AUDIO');
      if (res.status === 429) throw new ExternalAPIError('OpenAI', 'Limite de requisições atingido. Tente novamente em alguns segundos.');
      throw new ExternalAPIError('OpenAI', body.error?.message ?? `HTTP ${res.status}`);
    }

    const data = await res.json();

    if (!data.text?.trim()) {
      throw new AppError(MESSAGES[language].emptyAudio, 400, 'EMPTY_TRANSCRIPTION');
    }

    const confidence = this.calcConfidence(data.segments ?? []);
    logger.info(`Transcrição [${language}]: "${data.text}" (conf=${confidence.toFixed(2)})`);

    return {
      text:            data.text.trim(),
      language:        data.language ?? language,
      confidence,
      durationSeconds: data.duration,
    };
  }

  // ─── Síntese de voz (TTS) ─────────────────────────────────────────────────
  // O modelo tts-1 detecta automaticamente o idioma do texto.
  // Não é necessário passar parâmetro de idioma.

  async synthesize(text: string, voice: TTSVoice = this.ttsVoice): Promise<Buffer> {
    if (!text?.trim()) throw new AppError('Texto para síntese não pode ser vazio', 400);

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new ExternalAPIError('OpenAI', 'OPENAI_API_KEY não configurada');

    const res = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        Authorization:  `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model:           'tts-1',
        input:           text.slice(0, 4096),
        voice,
        response_format: 'mp3',
        speed:           1.0,
      }),
    });

    if (!res.ok) throw new ExternalAPIError('OpenAI', `TTS falhou: ${res.status}`);

    return Buffer.from(await res.arrayBuffer());
  }

  // ─── Processar comando de voz (fluxo principal) ───────────────────────────

  async processVoiceCommand(
    userId: string,
    audio: Buffer,
    mimeType: string,
    options: {
      language?: SupportedLanguage;
      source?: MusicSource | 'all';
      generateAudio?: boolean;
    } = {}
  ): Promise<VoiceCommandResult> {
    const lang = options.language ?? 'pt';

    // 1. Transcreve
    const transcription = await this.transcribe(audio, mimeType, lang);

    // 2. Detecta idioma real (Whisper pode retornar 'portuguese' ou 'english')
    const detected = this.normalizeLanguage(transcription.language);

    // 3. Interpreta o comando no idioma detectado
    const parsed = this.parseCommand(transcription.text, detected);

    // 4. Mensagens no idioma correto
    const msgs = MESSAGES[detected];

    let response: string;
    let queueResult: unknown;

    if (!parsed.command) {
      response = msgs.notUnderstood(transcription.text);
    } else {
      try {
        queueResult = await queueService.dispatch(userId, parsed.command, {
          query:  parsed.query ?? undefined,
          source: options.source,
        });

        response = (queueResult as any).message ?? 'Comando executado.';

        if ((queueResult as any).code === 'TRACK_NOT_FOUND' && parsed.query) {
          response = msgs.notFound(parsed.query);
        }
      } catch (err: any) {
        response = err.message ?? msgs.notUnderstood(transcription.text);
        logger.warn(`Erro no comando de voz: ${err.message}`);
      }
    }

    // 5. Gera resposta em áudio (TTS fala no idioma do texto)
    let audioResponse: Buffer | undefined;
    if (options.generateAudio !== false) {
      try {
        audioResponse = await this.synthesize(response);
      } catch (err) {
        logger.warn('TTS falhou, retornando apenas texto:', err);
      }
    }

    return {
      transcription,
      command:      parsed.command,
      query:        parsed.query,
      response,
      audioResponse,
      queueResult,
    };
  }

  // ─── Parse de comando ─────────────────────────────────────────────────────
  // Testa padrões do idioma detectado primeiro, depois o outro idioma,
  // e por último o fallback de play implícito (nome da música direto).

  parseCommand(
    text: string,
    language: SupportedLanguage = 'pt'
  ): { command: PlayerCommand | null; query: string | null } {
    const normalized = text.trim();
    const other: SupportedLanguage = language === 'pt' ? 'en' : 'pt';

    // Testa idioma principal → idioma alternativo → fallback
    for (const lang of [language, other] as SupportedLanguage[]) {
      for (const { pattern, command, extractQuery } of PATTERNS[lang]) {
        const match = normalized.match(pattern);
        if (match) {
          const query = extractQuery
            ? this.cleanQuery(match[match.length - 1])
            : null;
          return { command, query };
        }
      }
    }

    // Fallback: texto sem prefixo → trata como nome de música
    // Ex: "Bohemian Rhapsody" sem "play" na frente
    const trimmed = normalized.trim();
    if (trimmed.length > 1 && trimmed.length <= 200) {
      return { command: 'play', query: this.cleanQuery(trimmed) };
    }

    return { command: null, query: null };
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  /** Normaliza o nome de idioma retornado pelo Whisper para 'pt' | 'en' */
  private normalizeLanguage(lang: string): SupportedLanguage {
    const l = lang.toLowerCase();
    if (l.startsWith('pt') || l === 'portuguese') return 'pt';
    if (l.startsWith('en') || l === 'english')    return 'en';
    // Para qualquer outro idioma detectado, usa pt como fallback
    return 'pt';
  }

  private cleanQuery(query: string): string {
    return query.replace(/\s+/g, ' ').trim();
  }

  private validateAudio(buffer: Buffer, mimeType: string): void {
    if (!buffer || buffer.length === 0) {
      throw new AppError('Arquivo de áudio está vazio.', 400, 'EMPTY_AUDIO');
    }
    if (buffer.length > MAX_AUDIO_BYTES) {
      throw new AppError(
        `Áudio muito grande. Máximo: ${MAX_AUDIO_BYTES / 1024 / 1024}MB.`,
        413,
        'AUDIO_TOO_LARGE'
      );
    }
    if (!SUPPORTED_MIME_TYPES.has(mimeType)) {
      throw new AppError(
        `Formato de áudio não suportado: ${mimeType}. Use: webm, mp4, mp3, wav, ogg ou flac.`,
        415,
        'UNSUPPORTED_FORMAT'
      );
    }
  }

  private mimeToExt(mime: string): string {
    const map: Record<string, string> = {
      'audio/webm': 'webm', 'audio/mp4': 'mp4',  'audio/mpeg': 'mp3',
      'audio/wav':  'wav',  'audio/ogg': 'ogg',   'audio/flac': 'flac',
      'audio/m4a':  'm4a',
    };
    return map[mime] ?? 'webm';
  }

  private calcConfidence(segments: Array<{ avg_logprob?: number }>): number {
    if (!segments.length) return 0.8;
    const avg = segments.reduce((s, seg) => s + (seg.avg_logprob ?? -0.5), 0) / segments.length;
    return Math.max(0, Math.min(1, Math.exp(avg)));
  }
}

export const voiceService = new VoiceService();
