import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import PDFDocument from 'pdfkit';

const app = express();
const PORT = process.env.PORT || 3000;

// ── Seguridad: API Key ─────────────────────────────────────────────────────
const EXPORT_API_KEY = process.env.EXPORT_API_KEY || 'briefly-secret-key';

function requireApiKey(req: Request, res: Response, next: NextFunction): void {
  const providedKey = req.headers['x-api-key'];
  if (providedKey !== EXPORT_API_KEY) {
    res.status(401).json({ error: 'Unauthorized: missing or invalid x-api-key header' });
    return;
  }
  next();
}

// ── Middlewares globales ───────────────────────────────────────────────────
app.use(cors());
app.use(express.json({ limit: '512kb' })); // Previene payloads gigantes

// ── Health check (sin autenticación) ──────────────────────────────────────
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'export-service' });
});

// ── Endpoints protegidos ──────────────────────────────────────────────────
interface ExportPdfRequest {
  title: string;
  content: string;
}

app.post(
  '/api/v1/export/pdf',
  requireApiKey,
  (req: Request<{}, {}, ExportPdfRequest>, res: Response) => {
    try {
      const { title, content } = req.body;

      if (!title || !content) {
        res.status(400).json({ error: 'Title and content are required' });
        return;
      }

      const doc = new PDFDocument();

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(title)}.pdf"`);

      doc.pipe(res);

      doc.fontSize(24).text(title, { align: 'center' });
      doc.moveDown(2);
      doc.fontSize(12).text(content);

      doc.end();
    } catch (error) {
      console.error('[export-service] Error generating PDF:', error);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Internal server error while generating PDF' });
      }
    }
  }
);

app.listen(PORT, () => {
  console.log(`[export-service] Listening on port ${PORT}`);
  console.log(`[export-service] API key auth: ${EXPORT_API_KEY === 'briefly-secret-key' ? 'using default key (set EXPORT_API_KEY in env)' : 'custom key configured'}`);
});
