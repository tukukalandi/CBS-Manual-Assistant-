import type { IncomingMessage, ServerResponse } from 'node:http';
import { getManualIndex } from '../lib/manual-index.ts';

export default function handler(req: IncomingMessage, res: ServerResponse) {
  try {
    const url = new URL(req.url || '/api/page', 'http://localhost');
    const part = parseInt(url.searchParams.get('part') || '', 10);
    const page = parseInt(url.searchParams.get('page') || '', 10);

    if ((part !== 1 && part !== 2) || !Number.isFinite(page) || page < 1) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ error: 'Invalid manual part or page reference.' }));
      return;
    }

    const index = getManualIndex();
    const record = index.pageByPartAndNum.get(`${part}:${page}`);
    if (!record) {
      const manualMeta = index.meta.manuals.find((m) => m.part === part);
      res.statusCode = 404;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(
        JSON.stringify({
          error: `Page ${page} does not exist in CBS Manual Part ${part === 1 ? 'I' : 'II'} (total ${manualMeta?.totalPages ?? 'unknown'} pages).`,
        })
      );
      return;
    }

    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=86400');
    res.end(
      JSON.stringify({
        ...record,
        pdfUrl:
          part === 1
            ? '/manuals/POSB_CBS_Manual_2026_Part_1.pdf'
            : '/manuals/POSB_CBS_Manual_2026_Part_2.pdf',
      })
    );
  } catch (err) {
    console.error('[api/page] Error:', err);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ error: 'Unable to load the requested manual page.' }));
  }
}
