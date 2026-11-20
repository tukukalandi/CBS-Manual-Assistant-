import type { IncomingMessage, ServerResponse } from 'node:http';
import {
  formatFriendlyApiError,
  getCachedAnswer,
  setCachedAnswer,
  streamGroundedAnswer,
} from '../lib/gemini.ts';
import { normalizeQuery, retrieveContextForAI } from '../lib/retrieval.ts';
import type { ChatTurn, ManualPartFilter } from '../lib/types.ts';

const NOT_VERIFIED_MESSAGE =
  'The requested information could not be verified from the indexed POSB CBS Manual 2026 (Part I and Part II).';

interface ChatRequestBody {
  query?: string;
  history?: ChatTurn[];
  partFilter?: ManualPartFilter;
  bypassCache?: boolean;
}

async function parseJsonBody(req: IncomingMessage): Promise<ChatRequestBody> {
  const existingBody = (req as IncomingMessage & { body?: unknown }).body;
  if (existingBody && typeof existingBody === 'object') {
    return existingBody as ChatRequestBody;
  }

  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8');
        resolve(raw ? (JSON.parse(raw) as ChatRequestBody) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

function sendSse(res: ServerResponse, event: string, data: unknown) {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ error: 'Method not allowed. Use POST.' }));
    return;
  }

  let body: ChatRequestBody;
  try {
    body = await parseJsonBody(req);
  } catch {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ error: 'Invalid JSON request payload.' }));
    return;
  }

  const rawQuery = typeof body.query === 'string' ? body.query.trim() : '';
  if (!rawQuery) {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ error: 'Please enter a question about the POSB CBS Manual 2026.' }));
    return;
  }

  const history: ChatTurn[] = Array.isArray(body.history)
    ? body.history
        .filter(
          (t): t is ChatTurn =>
            t &&
            (t.role === 'user' || t.role === 'assistant') &&
            typeof t.content === 'string' &&
            t.content.trim().length > 0
        )
        .slice(-8)
    : [];

  const partFilter: ManualPartFilter =
    body.partFilter === '1' || body.partFilter === '2' ? body.partFilter : 'all';
  const bypassCache = Boolean(body.bypassCache);

  // Set SSE streaming headers
  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  try {
    const normalized = normalizeQuery(rawQuery).toLowerCase();
    const cacheKey = history.length === 0 ? `${partFilter}::${normalized}` : null;

    if (cacheKey && !bypassCache) {
      const cached = getCachedAnswer(cacheKey);
      if (cached) {
        sendSse(res, 'sources', { citations: cached.citations });
        sendSse(res, 'delta', { text: cached.answer });
        sendSse(res, 'done', { cached: true });
        res.end();
        return;
      }
    }

    const { citations, contextBlock } = retrieveContextForAI(rawQuery, history, partFilter);

    // Strict accuracy guard: never generate an answer without verified manual context
    if (citations.length === 0 || !contextBlock.trim()) {
      sendSse(res, 'sources', { citations: [] });
      sendSse(res, 'delta', { text: NOT_VERIFIED_MESSAGE });
      sendSse(res, 'done', { cached: false });
      res.end();
      return;
    }

    sendSse(res, 'sources', { citations });

    const { fullText, modelUsed } = await streamGroundedAnswer({
      query: rawQuery,
      contextBlock,
      history,
      onChunk: (text) => {
        sendSse(res, 'delta', { text });
      },
    });

    if (cacheKey && fullText.trim()) {
      setCachedAnswer(cacheKey, {
        answer: fullText,
        citations,
        modelUsed,
      });
    }

    sendSse(res, 'done', { cached: false });
    res.end();
  } catch (err) {
    console.error('[api/chat] Error:', err);
    const friendly = formatFriendlyApiError(err);
    sendSse(res, 'error', { message: friendly.message, status: friendly.status });
    res.end();
  }
}
