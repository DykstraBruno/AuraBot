import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { loadModel } from './services/whisper';
import { requireApiKey } from './middleware/auth';
import transcribeRouter from './routes/transcribe';

const app  = express();
const PORT = Number(process.env.PORT ?? 3003);

const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? '')
  .split(',')
  .map(o => o.trim())
  .filter(Boolean);

app.use(cors({
  origin: allowedOrigins.length ? allowedOrigins : false,
  methods: ['POST'],
}));

app.use(express.json());

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

app.use('/api/transcribe', requireApiKey, transcribeRouter);

loadModel()
  .then(() => {
    app.listen(PORT, () => console.log(`[STT] Listening on port ${PORT}`));
  })
  .catch(err => {
    console.error('[STT] Failed to load model:', err);
    process.exit(1);
  });
