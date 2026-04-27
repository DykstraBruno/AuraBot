import { Router, Request, Response } from 'express';
import multer from 'multer';
import { transcribeAudio } from '../services/whisper';
import { matchCommand, normalizeLanguage } from '../services/commands';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

router.post('/', upload.single('audio'), async (req: Request, res: Response): Promise<void> => {
  if (!req.file) {
    res.status(400).json({ success: false, error: 'No audio file provided' });
    return;
  }

  const langHint = normalizeLanguage((req.body.language as string | undefined) ?? 'pt');
  const mimeType = req.file.mimetype || 'audio/webm';

  try {
    const transcription = await transcribeAudio(req.file.buffer, mimeType, langHint);

    if (!transcription) {
      res.status(422).json({ success: false, error: 'Could not transcribe audio' });
      return;
    }

    const result = matchCommand(transcription, langHint);

    if (result.command === null) {
      res.json({ success: true, transcription, command: null, query: null, action: 'ask again', language: result.language });
      return;
    }

    res.json({
      success:       true,
      transcription,
      command:       result.command,
      query:         result.query,
      action:        result.action,
      language:      result.language,
    });
  } catch (err) {
    console.error('[transcribe] Error:', err);
    res.status(500).json({ success: false, error: 'Transcription failed' });
  }
});

export default router;
