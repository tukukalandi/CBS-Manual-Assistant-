import { GoogleGenAI, ThinkingLevel } from '@google/genai';
import type { ChatTurn, CitationRef } from './types.ts';

let aiSingleton: GoogleGenAI | null = null;

export function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured on the server.');
  }
  if (!aiSingleton) {
    aiSingleton = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return aiSingleton;
}

export function getConfiguredModels(): { primary: string; fallback: string } {
  const primary = process.env.GEMINI_PRIMARY_MODEL?.trim() || 'gemini-3.1-flash-lite';
  const fallback = process.env.GEMINI_FALLBACK_MODEL?.trim() || 'gemini-4-hydrogen';
  return { primary, fallback };
}

export const SYSTEM_INSTRUCTION = `You are the CBS Manual AI Assistant for the Department of Posts, India (India Post), specializing in Finacle Core Banking Solution (CBS) procedures strictly based on the official POSB CBS Manual 2026 (Part I and Part II).

STRICT ACCURACY & GROUNDING POLICY:
1. Answer STRICTLY and EXCLUSIVELY from the provided POSB CBS Manual 2026 source excerpts.
2. NEVER invent, guess, or hallucinate Finacle menu codes, rule numbers, form numbers, transaction limits, charges, timelines, procedures, or page numbers.
3. If the provided manual excerpts do NOT contain sufficient information to verify and answer the user's question, you MUST clearly state:
"The requested information could not be verified from the indexed POSB CBS Manual 2026 (Part I and Part II)."
Do not fill gaps with assumptions or external knowledge.
4. If two sections or parts of the manual provide different or conflicting instructions, explicitly cite BOTH references and explain the difference without silently reconciling them.
5. If you add any brief clarifying note for operational readability that is not verbatim in the manual, clearly label it under a separate heading "**General Operational Note (Not from Manual)**" — never blend assumptions with official instructions.
6. NEVER fabricate page numbers or citations. Use ONLY the exact PDF Page numbers and Part/Chapter names shown in the "=== SOURCE: ... ===" headers provided below.

RESPONSE FORMAT:
Present answers in a clear, structured, government-manual style using clean Markdown. Adapt sections to the user's question and omit any section that is not relevant (do not produce empty placeholder sections):
- **Topic**: Concise subject title
- **1. Purpose** (brief overview when applicable)
- **2. Applicable Procedure** (clear sequential numbered steps)
- **3. Finacle Menu** (exact menu codes in inline code like \`CASBAO\`, \`CASBAV\`, with their exact function)
- **4. Maker and Checker Responsibilities** (separate clearly into Maker / Counter PA and Checker / Supervisor / SPM wherever specified in the manual; use a clean Markdown table when helpful)
- **5. Required Documents / Forms** (exact form numbers, KYC documents, registers mentioned in the manual)
- **6. Important Instructions** (restrictions, exceptions, transaction limits, precautions)
- **7. Source References**

CRITICAL CITATION FORMAT:
In the "Source References" section (and inline when helpful), format EVERY manual reference using this EXACT pattern so the interface can make it clickable to open the PDF at that exact page:
- CBS Manual Part I – Chapter X, Page Y
- CBS Manual Part II – Appendix IV, Page Z
Always use the exact PDF Page number (the number right after ", Page " in the SOURCE header).`;

// Simple bounded in-memory LRU response cache for fast repeated standalone lookups
interface CacheEntry {
  answer: string;
  citations: CitationRef[];
  modelUsed: string;
  createdAt: number;
}

const responseCache = new Map<string, CacheEntry>();
const MAX_CACHE_ENTRIES = 120;
const CACHE_TTL_MS = 1000 * 60 * 30; // 30 minutes

export function getCachedAnswer(key: string): CacheEntry | null {
  const entry = responseCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.createdAt > CACHE_TTL_MS) {
    responseCache.delete(key);
    return null;
  }
  // Refresh LRU order
  responseCache.delete(key);
  responseCache.set(key, entry);
  return entry;
}

export function setCachedAnswer(key: string, entry: Omit<CacheEntry, 'createdAt'>) {
  if (responseCache.size >= MAX_CACHE_ENTRIES) {
    const oldestKey = responseCache.keys().next().value;
    if (oldestKey) responseCache.delete(oldestKey);
  }
  responseCache.set(key, { ...entry, createdAt: Date.now() });
}

function isRetryableError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  const status = (err as { status?: number; code?: number })?.status ?? (err as { code?: number })?.code;
  if (status === 429 || status === 503 || status === 500 || status === 502 || status === 504) {
    return true;
  }
  return /\b(429|503|502|504|RESOURCE_EXHAUSTED|UNAVAILABLE|overloaded|rate limit|temporarily|ECONNRESET|ETIMEDOUT)\b/i.test(
    msg
  );
}

function isModelUnavailableError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  const status = (err as { status?: number })?.status;
  return status === 404 || /\b(404|NOT_FOUND|not found|unsupported model)\b/i.test(msg);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildConfigForModel(model: string) {
  // gemini-3.1-flash-lite supports ThinkingLevel.MINIMAL; gemini-4-hydrogen supports ThinkingLevel.LOW
  const isLite = model.includes('3.1-flash-lite');
  const isGemini4 = model.includes('gemini-4');
  return {
    systemInstruction: SYSTEM_INSTRUCTION,
    thinkingConfig: {
      thinkingLevel: isLite
        ? ThinkingLevel.MINIMAL
        : isGemini4
          ? ThinkingLevel.LOW
          : ThinkingLevel.LOW,
    },
  };
}

export function buildUserContents(
  query: string,
  contextBlock: string,
  history: ChatTurn[] = []
) {
  const recentHistory = history.slice(-6);
  const contents: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> = [];

  for (const turn of recentHistory) {
    contents.push({
      role: turn.role === 'user' ? 'user' : 'model',
      parts: [{ text: turn.content.slice(0, 1800) }],
    });
  }

  const promptText = `OFFICIAL POSB CBS MANUAL 2026 RETRIEVED EXCERPTS:
${contextBlock}

USER QUESTION:
${query}

Provide a clear, accurate, strictly grounded answer based ONLY on the retrieved excerpts above. Include clickable source references using the exact Part, Chapter/Appendix, and PDF Page numbers shown in the SOURCE headers.`;

  contents.push({
    role: 'user',
    parts: [{ text: promptText }],
  });

  return contents;
}

export async function streamGroundedAnswer(params: {
  query: string;
  contextBlock: string;
  history: ChatTurn[];
  onChunk: (text: string) => void;
}): Promise<{ fullText: string; modelUsed: string }> {
  const ai = getGeminiClient();
  const { primary, fallback } = getConfiguredModels();
  const modelsToTry = primary === fallback ? [primary] : [primary, fallback];
  const contents = buildUserContents(params.query, params.contextBlock, params.history);

  let lastError: unknown = null;

  for (let mIdx = 0; mIdx < modelsToTry.length; mIdx++) {
    const model = modelsToTry[mIdx];
    const maxAttempts = mIdx === 0 ? 2 : 2;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      let emittedAny = false;
      try {
        const stream = await ai.models.generateContentStream({
          model,
          contents,
          config: buildConfigForModel(model),
        });

        let fullText = '';
        for await (const chunk of stream) {
          const piece = chunk.text;
          if (piece) {
            emittedAny = true;
            fullText += piece;
            params.onChunk(piece);
          }
        }

        if (!fullText.trim()) {
          throw new Error('Model returned an empty response.');
        }

        return { fullText, modelUsed: model };
      } catch (err) {
        lastError = err;
        // If we already streamed tokens to the client, do not silently concatenate a second response
        if (emittedAny) {
          throw err;
        }
        // If model is 404/unsupported, skip retries and move immediately to fallback model
        if (isModelUnavailableError(err)) {
          break;
        }
        if (isRetryableError(err) && attempt < maxAttempts) {
          await sleep(450 * Math.pow(2, attempt - 1));
          continue;
        }
        if (!isRetryableError(err)) {
          // Move to fallback if primary failed due to config/model issue, else throw
          if (mIdx < modelsToTry.length - 1) break;
          throw err;
        }
      }
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error('AI service is temporarily unavailable. Please try again.');
}

export function formatFriendlyApiError(err: unknown): { status: number; message: string } {
  const raw = err instanceof Error ? err.message : String(err);
  if (/GEMINI_API_KEY/i.test(raw)) {
    return {
      status: 503,
      message: 'The AI service is not configured yet. Please ensure GEMINI_API_KEY is set on the server.',
    };
  }
  if (/429|RESOURCE_EXHAUSTED|rate limit/i.test(raw)) {
    return {
      status: 429,
      message: 'The AI service is currently experiencing high demand (rate limit reached). Please wait a moment and click Retry.',
    };
  }
  if (/503|UNAVAILABLE|overloaded/i.test(raw)) {
    return {
      status: 503,
      message: 'The AI service is temporarily unavailable. Please click Retry in a few seconds.',
    };
  }
  if (/403|401|PERMISSION_DENIED|API_KEY_INVALID/i.test(raw)) {
    return {
      status: 403,
      message: 'AI service authentication failed. Please verify the configured Gemini API key.',
    };
  }
  return {
    status: 500,
    message: 'Unable to complete the response right now. Please click Retry.',
  };
}
