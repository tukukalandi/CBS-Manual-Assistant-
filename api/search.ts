import type { IncomingMessage, ServerResponse } from 'node:http';
import { searchManualPages } from '../lib/retrieval.ts';
import type { ManualPartFilter } from '../lib/types.ts';

export default function handler(req: IncomingMessage, res: ServerResponse) {
  try {
    const url = new URL(req.url || '/api/search', 'http://localhost');
    const q = (url.searchParams.get('q') || '').trim();
    const partParam = url.searchParams.get('part') || 'all';
    const partFilter: ManualPartFilter =
      partParam === '1' || partParam === '2' ? partParam : 'all';
    const limitParam = parseInt(url.searchParams.get('limit') || '24', 10);
    const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 60) : 24;

    if (!q) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ error: 'Please enter a search keyword, Finacle menu code, rule, or form number.' }));
      return;
    }

    const results = searchManualPages(q, {
      partFilter,
      limit,
      includeAdjacent: false,
      forLookup: true,
    });

    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(
      JSON.stringify({
        query: q,
        partFilter,
        total: results.length,
        results,
      })
    );
  } catch (err) {
    console.error('[api/search] Error:', err);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ error: 'Manual search failed. Please try again.' }));
  }
}
