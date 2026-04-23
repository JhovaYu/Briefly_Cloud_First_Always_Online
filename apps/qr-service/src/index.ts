import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import QRCode from 'qrcode';

const app = express();
const PORT = process.env.PORT || 8081;

// ── Auth ───────────────────────────────────────────────────────────────────
const API_KEY = process.env.API_KEY || 'briefly-secret-key';

function requireApiKey(req: Request, res: Response, next: NextFunction): void {
  if (req.headers['x-api-key'] !== API_KEY) {
    res.status(401).json({ error: 'Unauthorized: invalid or missing x-api-key' });
    return;
  }
  next();
}

// ── Middlewares ────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json({ limit: '64kb' }));

// ── Health ─────────────────────────────────────────────────────────────────
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'qr-service', port: PORT });
});

// ── GET /api/v1/qr?text=... ───────────────────────────────────────────────
app.get('/api/v1/qr', requireApiKey, async (req: Request, res: Response) => {
  const text = typeof req.query['text'] === 'string' ? req.query['text'].trim() : '';

  if (!text) {
    res.status(400).json({ error: 'Query param "text" is required and cannot be empty' });
    return;
  }

  if (text.length > 2048) {
    res.status(400).json({ error: 'Query param "text" exceeds maximum length of 2048 characters' });
    return;
  }

  try {
    // Genera el QR como buffer PNG directamente en memoria (sin disco)
    const pngBuffer: Buffer = await QRCode.toBuffer(text, {
      type: 'png',
      errorCorrectionLevel: 'M',
      margin: 2,
      width: 300,
      color: {
        dark: '#000000',
        light: '#ffffff',
      },
    });

    res.type('png');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.setHeader('Content-Length', pngBuffer.length);
    res.send(pngBuffer);
  } catch (error) {
    console.error('[qr-service] QR generation error:', error);
    res.status(500).json({ error: 'Failed to generate QR code' });
  }
});

app.listen(PORT, () => {
  console.log(`[qr-service] Listening on port ${PORT}`);
  console.log(`[qr-service] API key: ${API_KEY === 'briefly-secret-key' ? 'default (set API_KEY in env)' : 'custom'}`);
});
