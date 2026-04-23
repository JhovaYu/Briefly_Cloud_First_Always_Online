import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { GoogleGenerativeAI } from '@google/generative-ai';

const app = express();
const PORT = process.env.PORT || 8083;

// ── Auth ───────────────────────────────────────────────────────────────────
const API_KEY = process.env.API_KEY || 'briefly-secret-key';

function requireApiKey(req: Request, res: Response, next: NextFunction): void {
  if (req.headers['x-api-key'] !== API_KEY) {
    res.status(401).json({ error: 'Unauthorized: invalid or missing x-api-key' });
    return;
  }
  next();
}

// ── Gemini client — lazy init para no crashear si la key no está ──────────
function getGeminiClient(): GoogleGenerativeAI {
  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey) {
    throw new Error('GEMINI_API_KEY environment variable is not set');
  }
  return new GoogleGenerativeAI(geminiKey);
}

// ── Middlewares ────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json({ limit: '256kb' }));

// ── Health ─────────────────────────────────────────────────────────────────
app.get('/health', (_req: Request, res: Response) => {
  const geminiConfigured = !!process.env.GEMINI_API_KEY;
  res.json({
    status: 'ok',
    service: 'ai-summary-service',
    port: PORT,
    gemini: geminiConfigured ? 'configured' : 'missing GEMINI_API_KEY',
  });
});

// ── Tipos ──────────────────────────────────────────────────────────────────
interface SummaryRequest {
  text: string;
  language?: string; // Idioma de salida (default: 'español')
}

interface SummaryResponse {
  summary: string;
  wordCount: number;
}

// ── POST /api/v1/summary ──────────────────────────────────────────────────
app.post(
  '/api/v1/summary',
  requireApiKey,
  async (req: Request<{}, {}, SummaryRequest>, res: Response) => {
    const { text, language = 'español' } = req.body;

    if (typeof text !== 'string' || text.trim().length === 0) {
      res.status(400).json({ error: 'Body must contain a non-empty "text" string field' });
      return;
    }

    if (text.length > 50_000) {
      res.status(400).json({ error: 'Text exceeds maximum length of 50,000 characters' });
      return;
    }

    try {
      const genAI = getGeminiClient();
      const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

      const prompt = `Resume el siguiente texto en 3-5 oraciones concisas en ${language}. 
Responde únicamente con el resumen, sin prefijos ni explicaciones adicionales.

TEXTO:
${text}

RESUMEN:`;

      const result = await model.generateContent(prompt);
      const summary = result.response.text().trim();

      const wordCount = summary.split(/\s+/).filter(w => w.length > 0).length;

      const response: SummaryResponse = { summary, wordCount };
      res.json(response);
    } catch (error: unknown) {
      if (error instanceof Error && error.message.includes('GEMINI_API_KEY')) {
        res.status(503).json({ error: 'AI service not configured: GEMINI_API_KEY is missing' });
        return;
      }
      console.error('[ai-summary-service] Gemini error:', error);
      res.status(500).json({ error: 'Failed to generate summary' });
    }
  }
);

app.listen(PORT, () => {
  console.log(`[ai-summary-service] Listening on port ${PORT}`);
  console.log(`[ai-summary-service] Gemini key: ${process.env.GEMINI_API_KEY ? 'configured' : 'MISSING — set GEMINI_API_KEY'}`);
  console.log(`[ai-summary-service] API key: ${API_KEY === 'briefly-secret-key' ? 'default (set API_KEY in env)' : 'custom'}`);
});
