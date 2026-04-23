import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';

const app = express();
const PORT = process.env.PORT || 8082;

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
app.use(express.json({ limit: '512kb' }));

// ── Health ─────────────────────────────────────────────────────────────────
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'text-stats-service', port: PORT });
});

// ── Tipos ──────────────────────────────────────────────────────────────────
interface StatsRequest {
  text: string;
}

interface StatsResponse {
  wordCount: number;
  charCount: number;
  charCountNoSpaces: number;
  sentenceCount: number;
  paragraphCount: number;
  readingTimeMinutes: number;
}

// ── POST /api/v1/stats ────────────────────────────────────────────────────
app.post(
  '/api/v1/stats',
  requireApiKey,
  (req: Request<{}, {}, StatsRequest>, res: Response) => {
    const { text } = req.body;

    if (typeof text !== 'string') {
      res.status(400).json({ error: 'Body must be JSON with a "text" string field' });
      return;
    }

    if (text.length > 100_000) {
      res.status(400).json({ error: 'Text exceeds maximum length of 100,000 characters' });
      return;
    }

    // ── Cálculos ─────────────────────────────────────────────────────────
    const trimmed = text.trim();

    // Palabras: split por espacios/saltos, filtrar vacíos
    const words = trimmed.length > 0
      ? trimmed.split(/\s+/).filter(w => w.length > 0)
      : [];
    const wordCount = words.length;

    // Caracteres con y sin espacios
    const charCount = text.length;
    const charCountNoSpaces = text.replace(/\s/g, '').length;

    // Oraciones: terminan en . ! ?
    const sentences = trimmed.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const sentenceCount = sentences.length;

    // Párrafos: bloques separados por líneas dobles
    const paragraphs = trimmed.split(/\n\s*\n/).filter(p => p.trim().length > 0);
    const paragraphCount = paragraphs.length;

    // Tiempo de lectura: 200 palabras/minuto — resultado redondeado a 1 decimal
    const readingTimeMinutes = Math.round((wordCount / 200) * 10) / 10;

    const result: StatsResponse = {
      wordCount,
      charCount,
      charCountNoSpaces,
      sentenceCount,
      paragraphCount,
      readingTimeMinutes,
    };

    res.json(result);
  }
);

app.listen(PORT, () => {
  console.log(`[text-stats-service] Listening on port ${PORT}`);
  console.log(`[text-stats-service] API key: ${API_KEY === 'briefly-secret-key' ? 'default (set API_KEY in env)' : 'custom'}`);
});
