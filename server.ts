import 'dotenv/config';
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import metaHandler from './api/meta.ts';
import searchHandler from './api/search.ts';
import pageHandler from './api/page.ts';
import chatHandler from './api/chat.ts';
import { getManualIndex } from './lib/manual-index.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  // Preload the 748-page POSB CBS Manual 2026 index on server startup
  try {
    const idx = getManualIndex();
    console.log(
      `[CBS Manual Index] Preloaded ${idx.meta.totalPages} pages (${idx.meta.manuals
        .map((m) => `${m.partLabel}: ${m.totalPages}p`)
        .join(', ')})`
    );
  } catch (err) {
    console.error('[CBS Manual Index] Failed to preload index:', err);
  }

  app.use(express.json({ limit: '1mb' }));

  // Serve hosted PDF manuals with byte-range support for fast page-level viewing
  const manualsDir = path.resolve(__dirname, 'public/manuals');
  app.use(
    '/manuals',
    express.static(manualsDir, {
      acceptRanges: true,
      maxAge: '7d',
      setHeaders: (res, filePath) => {
        if (filePath.endsWith('.pdf')) {
          res.setHeader('Content-Type', 'application/pdf');
          res.setHeader('Content-Disposition', 'inline');
        }
      },
    })
  );

  // API endpoints (shared 1:1 with Vercel serverless handlers in /api/*)
  app.get('/api/meta', (req, res) => metaHandler(req, res));
  app.get('/api/search', (req, res) => searchHandler(req, res));
  app.get('/api/page', (req, res) => pageHandler(req, res));
  app.post('/api/chat', (req, res) => {
    void chatHandler(req, res);
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api/') || req.path.startsWith('/manuals/')) {
        return next();
      }
      const indexHtml = path.join(distDir, 'index.html');
      if (fs.existsSync(indexHtml)) {
        res.sendFile(indexHtml);
      } else {
        res.status(404).send('Application build not found.');
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`CBS Manual AI Assistant running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
