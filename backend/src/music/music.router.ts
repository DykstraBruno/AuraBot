import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/authenticate';
import { botAuth } from '../middleware/botAuth';
import { musicService } from '../music/music.service';
import { queueService } from '../queue/queue.service';
import { AppError } from '../utils/errors';

export const musicRouter = Router();

// Aceita tanto JWT de usuário normal quanto JWT de serviço do bot
musicRouter.use((req, res, next) => {
  const platform = req.headers['x-platform'];
  if (platform === 'discord' || platform === 'desktop') {
    return botAuth(req, res, next);
  }
  return authenticate(req, res, next);
});

// GET /api/music/search?q=&source=&limit=
musicRouter.get('/search', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { q, source = 'all', limit = '10' } = req.query;

    if (!q || typeof q !== 'string') {
      throw new AppError('Parâmetro "q" é obrigatório', 400, 'MISSING_QUERY');
    }

    const results = await musicService.search(q, source as any, Number(limit));
    res.json({ success: true, data: { results, total: results.length } });
  } catch (err) { next(err); }
});

// POST /api/music/play
musicRouter.post('/play', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { query, source } = req.body;
    const result = await queueService.play(req.user!.userId, query, source);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
});

// POST /api/music/stop
musicRouter.post('/stop', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await queueService.stop(req.user!.userId);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
});

// POST /api/music/next
musicRouter.post('/next', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await queueService.next(req.user!.userId);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
});

// POST /api/music/volume { direction: 'up' | 'down' }
musicRouter.post('/volume', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { direction } = req.body;
    if (direction !== 'up' && direction !== 'down') {
      throw new AppError('direction deve ser "up" ou "down"', 400);
    }
    const result = direction === 'up'
      ? await queueService.turnUp(req.user!.userId)
      : await queueService.turnDown(req.user!.userId);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
});

// GET /api/music/queue
musicRouter.get('/queue', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const state = await queueService.getState(req.user!.userId);
    res.json({ success: true, data: state });
  } catch (err) { next(err); }
});

// GET /api/music/history
musicRouter.get('/history', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { limit = '20' } = req.query;
    const history = await musicService.getHistory(req.user!.userId, Number(limit));
    res.json({ success: true, data: { history } });
  } catch (err) { next(err); }
});
