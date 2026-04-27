import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { authenticate } from '../middleware/authenticate';
import { botAuth } from '../middleware/botAuth';
import { apiKeyAuth } from '../middleware/apiKeyAuth';
import { voiceService, SUPPORTED_LANGUAGES } from '../voice/voice.service';
import { AppError } from '../utils/errors';

export const voiceRouter = Router();

// GET /api/voice/languages
voiceRouter.get('/languages', (_req: Request, res: Response) => {
  res.json({ success: true, data: { languages: SUPPORTED_LANGUAGES, default: 'pt' } });
});

// Auth para demais rotas
voiceRouter.use((req, res, next) => {
  const platform = req.headers['x-platform'];
  if (platform === 'discord' || platform === 'desktop') return botAuth(req, res, next);
  if (req.headers['x-api-key'])                         return apiKeyAuth(req, res, next);
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

// POST /api/voice/command
voiceRouter.post(
  '/command',
  upload.single('audio'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.file) throw new AppError('Arquivo de áudio é obrigatório', 400, 'MISSING_AUDIO');

      const language = req.body.language === 'en' ? 'en' : 'pt';
      const source   = req.body.source;

      const result = await voiceService.processVoiceCommand(
        req.user!.userId,
        req.file.buffer,
        req.file.mimetype,
        { language, source }
      );

      res.json({
        success: true,
        data: {
          transcription: result.transcription,
          command:       result.command,
          query:         result.query,
          response:      result.response,
          language:      result.language,
          queueResult:   result.queueResult,
        },
      });
    } catch (err) { next(err); }
  }
);

// POST /api/voice/transcribe — transcreve sem executar comando
voiceRouter.post(
  '/transcribe',
  upload.single('audio'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.file) throw new AppError('Arquivo de áudio é obrigatório', 400, 'MISSING_AUDIO');

      const language = req.body.language === 'en' ? 'en' : 'pt';
      const result   = await voiceService.transcribe(req.file.buffer, req.file.mimetype, language);

      res.json({ success: true, data: result });
    } catch (err) { next(err); }
  }
);
