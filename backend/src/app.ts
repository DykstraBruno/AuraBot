import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';

import { authRouter } from './auth/auth.router';
import { musicRouter } from './music/music.router';
import { voiceRouter } from './voice/voice.router';
import { spotifyRouter } from './spotify/spotify.router';
import { errorHandler, notFound } from './middleware/errorHandler';
import { generateCsrfToken } from './middleware/csrfProtection';
import { logger } from './utils/logger';

const app = express();

// ─── Segurança ────────────────────────────────────────────────────────────────
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

app.use(cors({
  origin: (origin, callback) => {
    const allowed = process.env.ALLOWED_ORIGINS?.split(',') ?? ['http://localhost:5173'];
    if (!origin || allowed.includes(origin)) return callback(null, true);
    callback(new Error('CORS: origem não permitida'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token', 'X-Platform'],
}));

// Rate limit global: 200 req / 15min por IP
app.use('/api/', rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: { code: 'TOO_MANY_REQUESTS', message: 'Muitas requisições. Aguarde 15 minutos.' },
  },
}));

// ─── Parsing ──────────────────────────────────────────────────────────────────
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

// ─── Logging HTTP ─────────────────────────────────────────────────────────────
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('combined', {
    stream: { write: msg => logger.http(msg.trim()) },
  }));
}

// ─── Health check ─────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'aurabot-api',
    version: process.env.npm_package_version ?? '1.0.0',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
  });
});

// ─── CSRF token endpoint ──────────────────────────────────────────────────────
// Clientes web fazem GET /api/auth/csrf-token antes de operações de mutação.
// O token é gerado na sessão e retornado para uso em X-CSRF-Token.
app.get('/api/auth/csrf-token', (req, res) => {
  const token = generateCsrfToken(req);
  res.json({ success: true, data: { csrfToken: token } });
});

// ─── Rotas ────────────────────────────────────────────────────────────────────
app.use('/api/auth',    authRouter);
app.use('/api/music',   musicRouter);
app.use('/api/voice',   voiceRouter);
app.use('/api/spotify', spotifyRouter);

// ─── Erros ────────────────────────────────────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

export default app;
