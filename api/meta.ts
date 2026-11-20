import type { IncomingMessage, ServerResponse } from 'node:http';
import { getManualIndex } from '../lib/manual-index.ts';

export default function handler(_req: IncomingMessage, res: ServerResponse) {
  try {
    const index = getManualIndex();
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=86400');
    res.end(JSON.stringify(index.meta));
  } catch (err) {
    console.error('[api/meta] Error:', err);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ error: 'Unable to load indexed manual metadata.' }));
  }
}
