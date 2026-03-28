import { Router, Request, Response, NextFunction } from 'express';
import { spotifyOAuthService } from './spotify.service';
import { authenticate } from '../middleware/authenticate';
import { AppError } from '../utils/errors';

export const spotifyRouter = Router();

// ─── GET /api/spotify/player-token ───────────────────────────────────────────
// Retorna o access token do usuário para o Web Playback SDK
// (o SDK precisa do token do usuário Spotify, não do app)

spotifyRouter.get('/player-token', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const accessToken = await spotifyOAuthService.getValidToken(req.user!.userId);
    res.json({ success: true, data: { accessToken } });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/spotify/auth-url ────────────────────────────────────────────────
// Retorna a URL para o usuário autorizar o AuraBot no Spotify

spotifyRouter.get('/auth-url', authenticate, (req: Request, res: Response, next: NextFunction) => {
  try {
    const url = spotifyOAuthService.getAuthUrl(req.user!.userId);
    res.json({ success: true, data: { url } });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/spotify/callback ────────────────────────────────────────────────
// Spotify redireciona aqui após o usuário autorizar

spotifyRouter.get('/callback', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { code, state, error } = req.query;

    const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:5173';

    if (error) {
      // Usuário cancelou a autorização
      return res.redirect(`${frontendUrl}/app?spotify=cancelled`);
    }

    if (!code || !state || typeof code !== 'string' || typeof state !== 'string') {
      return res.redirect(`${frontendUrl}/app?spotify=error&msg=invalid_params`);
    }

    await spotifyOAuthService.exchangeCode(code, state);

    // Redireciona de volta ao frontend com sucesso
    res.redirect(`${frontendUrl}/app?spotify=connected`);
  } catch (err: any) {
    const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:5173';
    const msg = encodeURIComponent(err.message ?? 'Erro ao conectar Spotify');
    res.redirect(`${frontendUrl}/app?spotify=error&msg=${msg}`);
  }
});

// ─── GET /api/spotify/status ──────────────────────────────────────────────────
// Retorna status da vinculação + se a conta é Premium

spotifyRouter.get('/status', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const status = await spotifyOAuthService.getStatus(req.user!.userId);
    res.json({ success: true, data: status });
  } catch (err) {
    next(err);
  }
});

// ─── DELETE /api/spotify/disconnect ───────────────────────────────────────────

spotifyRouter.delete('/disconnect', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    await spotifyOAuthService.disconnect(req.user!.userId);
    res.json({ success: true, message: 'Spotify desvinculado com sucesso.' });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/spotify/devices ─────────────────────────────────────────────────
// Lista dispositivos Spotify ativos do usuário

spotifyRouter.get('/devices', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const devices = await spotifyOAuthService.getDevices(req.user!.userId);
    res.json({ success: true, data: { devices } });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/spotify/play ───────────────────────────────────────────────────
// Reproduz via Spotify Connect (Premium + app Spotify aberto)

spotifyRouter.post('/play', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { spotifyUri, deviceId } = req.body;
    if (!spotifyUri) throw new AppError('spotifyUri é obrigatório', 400);

    await spotifyOAuthService.play(req.user!.userId, spotifyUri, deviceId);
    res.json({ success: true, message: 'Reproduzindo no Spotify.' });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/spotify/pause ──────────────────────────────────────────────────

spotifyRouter.post('/pause', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    await spotifyOAuthService.pause(req.user!.userId);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/spotify/volume ─────────────────────────────────────────────────

spotifyRouter.post('/volume', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { volume } = req.body;
    if (typeof volume !== 'number') throw new AppError('volume deve ser um número 0–100', 400);
    await spotifyOAuthService.setVolume(req.user!.userId, volume);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});
