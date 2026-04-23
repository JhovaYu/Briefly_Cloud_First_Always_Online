import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import * as cheerio from 'cheerio';

const app = express();
const PORT = process.env.PORT || 3001;

// ── Seguridad: API Key ─────────────────────────────────────────────────────
const PREVIEW_API_KEY = process.env.PREVIEW_API_KEY || 'briefly-secret-key';

function requireApiKey(req: Request, res: Response, next: NextFunction): void {
  const providedKey = req.headers['x-api-key'];
  if (providedKey !== PREVIEW_API_KEY) {
    res.status(401).json({ error: 'Unauthorized: missing or invalid x-api-key header' });
    return;
  }
  next();
}

// ── Middlewares globales ───────────────────────────────────────────────────
app.use(cors());
app.use(express.json());

// ── Health check (sin autenticación) ──────────────────────────────────────
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'link-preview-service' });
});

// ── Tipos de respuesta ────────────────────────────────────────────────────
interface LinkPreviewResponse {
  url: string;
  title: string | null;
  description: string | null;
  image: string | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────

/**
 * Valida que la URL sea un string HTTP/HTTPS bien formado.
 */
function isValidHttpUrl(raw: string): boolean {
  try {
    const parsed = new URL(raw);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Resuelve una URL relativa de og:image a absoluta usando el origen de la URL base.
 */
function resolveImageUrl(rawImage: string | undefined, baseUrl: string): string | null {
  if (!rawImage) return null;
  try {
    return new URL(rawImage, baseUrl).toString();
  } catch {
    return null;
  }
}

// ── Endpoint principal ────────────────────────────────────────────────────

/**
 * GET /api/v1/preview?url=https://ejemplo.com
 *
 * Extrae metadatos Open Graph y el <title> de la URL indicada.
 * Devuelve: { url, title, description, image }
 */
app.get(
  '/api/v1/preview',
  requireApiKey,
  async (req: Request, res: Response) => {
    const rawUrl = req.query['url'];

    // ── Validar parámetro ──
    if (typeof rawUrl !== 'string' || !rawUrl.trim()) {
      res.status(400).json({ error: 'Query param "url" is required' });
      return;
    }

    const targetUrl = rawUrl.trim();

    if (!isValidHttpUrl(targetUrl)) {
      res.status(400).json({ error: 'Invalid URL: must start with http:// or https://' });
      return;
    }

    try {
      // ── Fetch de la URL destino ──
      const response = await fetch(targetUrl, {
        headers: {
          // User-agent neutro para que la mayoría de sitios sirvan HTML normal
          'User-Agent': 'Mozilla/5.0 (compatible; BrieflyLinkPreview/1.0)',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
        // Timeout explícito para no bloquear el servicio
        signal: AbortSignal.timeout(8_000),
      });

      if (!response.ok) {
        res.status(502).json({
          error: `Target URL returned HTTP ${response.status}`,
          url: targetUrl,
        });
        return;
      }

      const html = await response.text();
      const $ = cheerio.load(html);

      // ── Extracción de metadatos (prioridad: og: > fallback HTML estándar) ──
      const ogTitle = $('meta[property="og:title"]').attr('content') ?? null;
      const ogDescription = $('meta[property="og:description"]').attr('content') ?? null;
      const ogImage = $('meta[property="og:image"]').attr('content') ?? null;
      const htmlTitle = $('title').text().trim() || null;
      const metaDescription = $('meta[name="description"]').attr('content') ?? null;

      const result: LinkPreviewResponse = {
        url: targetUrl,
        title: ogTitle ?? htmlTitle,
        description: ogDescription ?? metaDescription,
        image: resolveImageUrl(ogImage ?? undefined, targetUrl),
      };

      res.json(result);
    } catch (error: unknown) {
      // AbortError = timeout
      if (error instanceof Error && error.name === 'AbortError') {
        res.status(504).json({ error: 'Request to target URL timed out (8s)', url: targetUrl });
        return;
      }
      console.error('[link-preview-service] Fetch error:', error);
      res.status(500).json({ error: 'Failed to fetch or parse the target URL', url: targetUrl });
    }
  }
);

// ── Iniciar servidor ───────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`[link-preview-service] Listening on port ${PORT}`);
  console.log(`[link-preview-service] API key auth: ${PREVIEW_API_KEY === 'briefly-secret-key' ? 'using default key (set PREVIEW_API_KEY in env)' : 'custom key configured'}`);
});
