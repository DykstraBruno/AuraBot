import { describe, it, expect, vi, beforeEach } from 'vitest';
import { VoiceService } from '../../../voice/voice.service';
import { queueService } from '../../../queue/queue.service';
import { AppError, ExternalAPIError } from '../../../utils/errors';

vi.mock('../../queue/queue.service', () => ({
  queueService: { dispatch: vi.fn() },
}));

const mockFetch = vi.fn();
global.fetch = mockFetch;

const makeAudio = (size = 1024) => Buffer.alloc(size, 'x');

const makeWhisperOk = (text: string, language = 'portuguese') => ({
  ok: true,
  json: async () => ({
    text,
    language,
    duration: 3.0,
    segments: [{ avg_logprob: -0.2 }],
  }),
});

const makeTTSOk = () => ({
  ok: true,
  arrayBuffer: async () => new ArrayBuffer(512),
});

// ─── transcribe ──────────────────────────────────────────────────────────────

describe('transcribe', () => {
  let service: VoiceService;
  beforeEach(() => { service = new VoiceService(); });

  it('transcreve áudio em pt com sucesso', async () => {
    mockFetch.mockResolvedValue(makeWhisperOk('Toque Bohemian Rhapsody'));
    const r = await service.transcribe(makeAudio(), 'audio/webm', 'pt');
    expect(r.text).toBe('Toque Bohemian Rhapsody');
    expect(r.confidence).toBeGreaterThan(0);
  });

  it('transcreve áudio em en com sucesso', async () => {
    mockFetch.mockResolvedValue(makeWhisperOk('Play Hotel California', 'english'));
    const r = await service.transcribe(makeAudio(), 'audio/webm', 'en');
    expect(r.text).toBe('Play Hotel California');
    expect(r.language).toBe('english');
  });

  it('lança EMPTY_AUDIO para buffer vazio', async () => {
    const err = await service.transcribe(Buffer.alloc(0), 'audio/webm').catch(e => e);
    expect(err.code).toBe('EMPTY_AUDIO');
  });

  it('lança AUDIO_TOO_LARGE para arquivo > 25 MB', async () => {
    const err = await service.transcribe(Buffer.alloc(26 * 1024 * 1024), 'audio/webm').catch(e => e);
    expect(err.code).toBe('AUDIO_TOO_LARGE');
  });

  it('lança UNSUPPORTED_FORMAT para mimetype inválido', async () => {
    const err = await service.transcribe(makeAudio(), 'audio/amr').catch(e => e);
    expect(err.code).toBe('UNSUPPORTED_FORMAT');
    expect(err.message).toContain('audio/amr');
  });

  it('aceita todos os formatos suportados sem erro de validação', async () => {
    const formats = ['audio/webm', 'audio/mp4', 'audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/flac'];
    for (const fmt of formats) {
      mockFetch.mockResolvedValue(makeWhisperOk('teste'));
      await expect(service.transcribe(makeAudio(), fmt)).resolves.toBeDefined();
    }
  });

  it('lança erro amigável para transcrição vazia', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ text: '  ', language: 'pt', segments: [] }) });
    const err = await service.transcribe(makeAudio(), 'audio/webm').catch(e => e);
    expect(err.code).toBe('EMPTY_TRANSCRIPTION');
  });

  it('lança ExternalAPIError se OPENAI_API_KEY não definida', async () => {
    const original = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    const err = await service.transcribe(makeAudio(), 'audio/webm').catch(e => e);
    expect(err).toBeInstanceOf(ExternalAPIError);
    process.env.OPENAI_API_KEY = original;
  });

  it('lança erro de rate limit para HTTP 429', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 429, json: async () => ({}) });
    const err = await service.transcribe(makeAudio(), 'audio/webm').catch(e => e);
    expect(err.message).toContain('Limite de requisições');
  });
});

// ─── parseCommand — pt-BR ─────────────────────────────────────────────────────

describe('parseCommand — português', () => {
  let service: VoiceService;
  beforeEach(() => { service = new VoiceService(); });

  it.each([
    ['play Bohemian Rhapsody',           'play', 'Bohemian Rhapsody'],
    ['toque Bohemian Rhapsody',          'play', 'Bohemian Rhapsody'],
    ['reproduza Hotel California',       'play', 'Hotel California'],
    ['coloca Back in Black',             'play', 'Back in Black'],
    ['bota Stairway to Heaven',          'play', 'Stairway to Heaven'],
    ['quero ouvir Queen',                'play', 'Queen'],
    ['me coloca uma música do Queen',    'play', 'uma música do Queen'],
    ['ponha Macarena',                   'play', 'Macarena'],
  ])('detecta play: "%s"', (input, cmd, query) => {
    const r = service.parseCommand(input, 'pt');
    expect(r.command).toBe(cmd);
    expect(r.query).toBe(query);
  });

  it.each([
    ['stop'], ['para'], ['parar'], ['pausar'], ['silêncio'], ['chega'], ['desligar'],
  ])('detecta stop: "%s"', (input) => {
    expect(service.parseCommand(input, 'pt').command).toBe('stop');
  });

  it.each([
    ['próxima'], ['pular'], ['avançar'], ['next'], ['skip'], ['outra'],
  ])('detecta next: "%s"', (input) => {
    expect(service.parseCommand(input, 'pt').command).toBe('next');
  });

  it.each([
    ['mais alto'], ['sobe o volume'], ['aumentar o volume'], ['turn up'],
  ])('detecta turnup: "%s"', (input) => {
    expect(service.parseCommand(input, 'pt').command).toBe('turnup');
  });

  it.each([
    ['mais baixo'], ['baixa o volume'], ['diminuir o volume'], ['turn down'],
  ])('detecta turndown: "%s"', (input) => {
    expect(service.parseCommand(input, 'pt').command).toBe('turndown');
  });

  it('trata nome sem prefixo como play implícito (pt)', () => {
    const r = service.parseCommand('Bohemian Rhapsody', 'pt');
    expect(r.command).toBe('play');
    expect(r.query).toBe('Bohemian Rhapsody');
  });
});

// ─── parseCommand — English ───────────────────────────────────────────────────

describe('parseCommand — english', () => {
  let service: VoiceService;
  beforeEach(() => { service = new VoiceService(); });

  it.each([
    ['play Bohemian Rhapsody',         'play', 'Bohemian Rhapsody'],
    ['put on Hotel California',        'play', 'Hotel California'],
    ['i want to hear Queen',           'play', 'Queen'],
    ['play me Stairway to Heaven',     'play', 'Stairway to Heaven'],
    ['can you play Back in Black',     'play', 'Back in Black'],
    ['start playing AC/DC',            'play', 'AC/DC'],
  ])('detecta play: "%s"', (input, cmd, query) => {
    const r = service.parseCommand(input, 'en');
    expect(r.command).toBe(cmd);
    expect(r.query).toBe(query);
  });

  it.each([
    ['stop'], ['pause'], ['quiet'], ['enough'], ['cancel'], ['turn off'],
  ])('detecta stop: "%s"', (input) => {
    expect(service.parseCommand(input, 'en').command).toBe('stop');
  });

  it.each([
    ['next'], ['skip'], ['forward'], ['next song'], ['skip this'],
  ])('detecta next: "%s"', (input) => {
    expect(service.parseCommand(input, 'en').command).toBe('next');
  });

  it.each([
    ['turn up'], ['volume up'], ['louder'], ['increase the volume'], ['make it louder'],
  ])('detecta turnup: "%s"', (input) => {
    expect(service.parseCommand(input, 'en').command).toBe('turnup');
  });

  it.each([
    ['turn down'], ['volume down'], ['quieter'], ['lower the volume'], ['make it quieter'],
  ])('detecta turndown: "%s"', (input) => {
    expect(service.parseCommand(input, 'en').command).toBe('turndown');
  });

  it('trata nome sem prefixo como play implícito (en)', () => {
    const r = service.parseCommand('Hotel California', 'en');
    expect(r.command).toBe('play');
    expect(r.query).toBe('Hotel California');
  });
});

// ─── Fallback cross-language ──────────────────────────────────────────────────

describe('fallback cross-language', () => {
  let service: VoiceService;
  beforeEach(() => { service = new VoiceService(); });

  it('comando en detectado mesmo com language=pt', () => {
    // Usuário fala "play" em inglês mesmo com idioma configurado como pt
    const r = service.parseCommand('play Bohemian Rhapsody', 'pt');
    expect(r.command).toBe('play');
    expect(r.query).toBe('Bohemian Rhapsody');
  });

  it('comando pt detectado mesmo com language=en', () => {
    const r = service.parseCommand('toque Bohemian Rhapsody', 'en');
    expect(r.command).toBe('play');
    expect(r.query).toBe('Bohemian Rhapsody');
  });

  it('retorna null para texto não reconhecido', () => {
    // Texto muito longo — não é um nome de música razoável
    const r = service.parseCommand('a'.repeat(201), 'pt');
    expect(r.command).toBeNull();
  });
});

// ─── processVoiceCommand ──────────────────────────────────────────────────────

describe('processVoiceCommand', () => {
  let service: VoiceService;
  beforeEach(() => { service = new VoiceService(); });

  it('fluxo completo pt: áudio → transcrição → play → TTS', async () => {
    mockFetch
      .mockResolvedValueOnce(makeWhisperOk('Toque Bohemian Rhapsody', 'portuguese'))
      .mockResolvedValueOnce(makeTTSOk());

    vi.mocked(queueService.dispatch).mockResolvedValue({
      action: 'playing',
      message: '▶️ Reproduzindo: Bohemian Rhapsody — Queen',
    } as any);

    const r = await service.processVoiceCommand('user-1', makeAudio(), 'audio/webm', { language: 'pt' });

    expect(r.command).toBe('play');
    expect(r.query).toContain('Bohemian Rhapsody');
    expect(r.response).toContain('Reproduzindo');
    expect(r.audioResponse).toBeInstanceOf(Buffer);
    expect(queueService.dispatch).toHaveBeenCalledWith('user-1', 'play', expect.objectContaining({ query: expect.stringContaining('Bohemian Rhapsody') }));
  });

  it('fluxo completo en: áudio → transcrição → play → TTS', async () => {
    mockFetch
      .mockResolvedValueOnce(makeWhisperOk('Play Hotel California', 'english'))
      .mockResolvedValueOnce(makeTTSOk());

    vi.mocked(queueService.dispatch).mockResolvedValue({
      action: 'playing',
      message: '▶️ Playing: Hotel California — Eagles',
    } as any);

    const r = await service.processVoiceCommand('user-1', makeAudio(), 'audio/webm', { language: 'en' });
    expect(r.command).toBe('play');
    expect(r.response).toContain('Playing');
  });

  it('resposta de "não encontrado" em pt quando música não existe', async () => {
    mockFetch
      .mockResolvedValueOnce(makeWhisperOk('toque xyzinexistente123', 'portuguese'))
      .mockResolvedValueOnce(makeTTSOk());

    vi.mocked(queueService.dispatch).mockRejectedValue(
      Object.assign(new Error('Nenhuma música encontrada'), { code: 'TRACK_NOT_FOUND' })
    );

    const r = await service.processVoiceCommand('user-1', makeAudio(), 'audio/webm', { language: 'pt' });

    expect(r.response).toContain('Não encontrei');
    expect(r.response).toContain('xyzinexistente123');
    expect(r.response).toContain('Tente um nome diferente');
  });

  it('resposta de "não encontrado" em en quando música não existe', async () => {
    mockFetch
      .mockResolvedValueOnce(makeWhisperOk('play xyznotfound456', 'english'))
      .mockResolvedValueOnce(makeTTSOk());

    vi.mocked(queueService.dispatch).mockRejectedValue(
      Object.assign(new Error('Track not found'), { code: 'TRACK_NOT_FOUND' })
    );

    const r = await service.processVoiceCommand('user-1', makeAudio(), 'audio/webm', { language: 'en' });

    expect(r.response).toContain("Couldn't find");
    expect(r.response).toContain('xyznotfound456');
  });

  it('resposta de "não entendi" em pt para comando desconhecido', async () => {
    mockFetch
      .mockResolvedValueOnce(makeWhisperOk('a'.repeat(201), 'portuguese'))
      .mockResolvedValueOnce(makeTTSOk());

    const r = await service.processVoiceCommand('user-1', makeAudio(), 'audio/webm', { language: 'pt' });

    expect(r.command).toBeNull();
    expect(r.response).toContain('Não entendi');
    expect(r.response).toContain('Play');
  });

  it('não gera TTS quando generateAudio=false', async () => {
    mockFetch.mockResolvedValueOnce(makeWhisperOk('stop', 'portuguese'));
    vi.mocked(queueService.dispatch).mockResolvedValue({ message: '⏹ Parado' } as any);

    const r = await service.processVoiceCommand('user-1', makeAudio(), 'audio/webm', {
      language: 'pt', generateAudio: false,
    });

    expect(r.audioResponse).toBeUndefined();
    expect(mockFetch).toHaveBeenCalledTimes(1); // só Whisper, sem TTS
  });

  it('retorna apenas texto quando TTS falha, sem lançar erro', async () => {
    mockFetch
      .mockResolvedValueOnce(makeWhisperOk('parar', 'portuguese'))
      .mockResolvedValueOnce({ ok: false, status: 503 });

    vi.mocked(queueService.dispatch).mockResolvedValue({ message: '⏹ Parado' } as any);

    const r = await service.processVoiceCommand('user-1', makeAudio(), 'audio/webm');

    expect(r.response).toContain('⏹');
    expect(r.audioResponse).toBeUndefined();
  });
});

// ─── synthesize ───────────────────────────────────────────────────────────────

describe('synthesize', () => {
  let service: VoiceService;
  beforeEach(() => { service = new VoiceService(); });

  it('gera áudio MP3 com sucesso', async () => {
    mockFetch.mockResolvedValue(makeTTSOk());
    const audio = await service.synthesize('Reproduzindo sua música.');
    expect(audio).toBeInstanceOf(Buffer);
    expect(audio.length).toBe(512);
  });

  it('lança erro para texto vazio', async () => {
    await expect(service.synthesize('')).rejects.toThrow(AppError);
    await expect(service.synthesize('  ')).rejects.toThrow(AppError);
  });

  it('lança ExternalAPIError para falha da API', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 500 });
    await expect(service.synthesize('texto')).rejects.toThrow(ExternalAPIError);
  });
});
