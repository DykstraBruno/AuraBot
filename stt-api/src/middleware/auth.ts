import { Request, Response, NextFunction } from 'express';

const API_KEY = process.env.STT_API_KEY ?? '';

export function requireApiKey(req: Request, res: Response, next: NextFunction): void {
  if (!API_KEY) {
    res.status(500).json({ success: false, error: 'STT_API_KEY not configured' });
    return;
  }

  const provided = req.headers['x-api-key'];
  if (provided !== API_KEY) {
    res.status(401).json({ success: false, error: 'Unauthorized' });
    return;
  }

  next();
}
