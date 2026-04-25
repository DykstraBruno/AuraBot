import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { authenticate } from '../middleware/authenticate';
import { botAuth } from '../middleware/botAuth';
import { apiKeyAuth } from '../middleware/apiKeyAuth';
import { voiceService, SUPPORTED_LANGUAGES } from '../voice/voice.service';
import { AppError } from '../utils/errors';

export const voiceRouter = Router();

// GET /api/voice/languages — lista idiomas suportados (público, sem auth)
voiceRouter.get('/languages', (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      languages: SUPPORTED_LANGUAGES,
      default: 'pt',
    },
  });
});

// Autenticação para todas as demais rotas
voiceRouter.use((req, res, next) => {
  const platform = req.headers['x-platform'];
  if (platform === 'discord' || platform === 'desktop') {
    return botAuth(req, res, next);
  }
  if (req.headers['x-api-key']) {
    return apiKeyAuth(req, res, next);
  }
  return authenticate(req, res, next);
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['audio/webm', 'audio/mp4', 'audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/flac'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new AppError(`Formato não suportado: ${file.mimetype}`, 415, 'UNSUPPORTED_FORMAT'));
    }
  },
});

// POST /api/voice/command — upload de áudio + processa comando
voiceRouter.post(
  '/command',
  upload.single('audio'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.file) {
        throw new AppError('Arquivo de áudio é obrigatório', 400, 'MISSING_AUDIO');
      }

      const rawLang = req.body.language ?? 'pt';
      const language = rawLang === 'en' ? 'en' : 'pt'; // só pt ou en
      const source = req.body.source;
      const generateAudio = req.body.generateAudio ?? 'true';

      const result = await voiceService.processVoiceCommand(
        req.user!.userId,
        req.file.buffer,
        req.file.mimetype,
        {
          language,
          source,
          generateAudio: generateAudio !== 'false',
        }
      );

      // Se gerou áudio TTS, retorna como binário com metadados no header
      if (result.audioResponse) {
        res.set({
          'Content-Type': 'audio/mpeg',
          'X-Command': result.command ?? '',
          'X-Response-Text': encodeURIComponent(result.response),
          'X-Transcription': encodeURIComponent(result.transcription.text),
        });
        return res.send(result.audioResponse);
      }

      // Sem áudio: retorna JSON
      res.json({
        success: true,
        data: {
          transcription: result.transcription,
          command: result.command,
          query: result.query,
          response: result.response,
          queueResult: result.queueResult,
        },
      });
    } catch (err) { next(err); }
  }
);

// POST /api/voice/synthesize — converte texto em áudio
voiceRouter.post('/synthesize', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { text, voice } = req.body;
    if (!text) throw new AppError('Texto é obrigatório', 400);

    const audio = await voiceService.synthesize(text, voice);
    res.set('Content-Type', 'audio/mpeg');
    res.send(audio);
  } catch (err) { next(err); }
});

// POST /api/voice/transcribe — apenas transcreve sem executar comando
voiceRouter.post(
  '/transcribe',
  upload.single('audio'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.file) throw new AppError('Arquivo de áudio é obrigatório', 400);
      const rawLang = req.body.language ?? 'pt';
      const language = rawLang === 'en' ? 'en' : 'pt';
      const result = await voiceService.transcribe(req.file.buffer, req.file.mimetype, language);
      res.json({ success: true, data: result });
    } catch (err) { next(err); }
  }
);
