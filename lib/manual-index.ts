import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ManualIndexFile, ManualMeta, ManualPage } from './types.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const STOPWORDS = new Set([
  'a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'shall',
  'should', 'can', 'could', 'may', 'might', 'must', 'of', 'in', 'to',
  'for', 'with', 'on', 'at', 'from', 'by', 'about', 'as', 'into', 'like',
  'through', 'after', 'over', 'between', 'out', 'against', 'during',
  'without', 'before', 'under', 'around', 'among', 'what', 'which', 'who',
  'whom', 'this', 'that', 'these', 'those', 'am', 'and', 'but', 'if', 'or',
  'because', 'until', 'while', 'where', 'when', 'why', 'how', 'all', 'any',
  'both', 'each', 'few', 'more', 'most', 'other', 'some', 'such', 'no',
  'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very', 'just',
  'explain', 'tell', 'me', 'give', 'please', 'describe', 'details', 'detail',
  'regarding', 'related', 'applicable', 'required', 'particular', 'used',
]);

export function tokenize(text: string): string[] {
  if (!text) return [];
  const lower = text.toLowerCase();
  // Preserve hyphenated form/code tokens like sb-103, sb-7a, 194n
  const raw = lower.match(/[a-z0-9]+(?:-[a-z0-9]+)*/g) || [];
  const tokens: string[] = [];
  for (const tok of raw) {
    if (tok.length < 2) continue;
    tokens.push(tok);
    // Also index subparts of hyphenated forms so "sb 103" matches "sb-103"
    if (tok.includes('-')) {
      const parts = tok.split('-').filter((p) => p.length >= 2);
      for (const p of parts) tokens.push(p);
      tokens.push(tok.replace(/-/g, ''));
    }
  }
  return tokens;
}

export interface PagePosting {
  pageIdx: number;
  tf: number;
}

export interface SearchEngineState {
  meta: ManualMeta;
  pages: ManualPage[];
  pageById: Map<string, ManualPage>;
  pageByPartAndNum: Map<string, ManualPage>;
  invertedIndex: Map<string, PagePosting[]>;
  menuIndex: Map<string, number[]>;
  formIndex: Map<string, number[]>;
  docLengths: Float32Array;
  avgDocLength: number;
  idf: Map<string, number>;
  isTocPage: Uint8Array;
  lowerTexts: string[];
}

let cachedState: SearchEngineState | null = null;

function resolveIndexPath(): string {
  const candidates = [
    path.resolve(process.cwd(), 'data/cbs-manual-index.json'),
    path.resolve(__dirname, '../data/cbs-manual-index.json'),
    path.resolve(__dirname, '../../data/cbs-manual-index.json'),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  throw new Error(`CBS Manual index file not found. Searched: ${candidates.join(', ')}`);
}

export function getManualIndex(): SearchEngineState {
  if (cachedState) return cachedState;

  const indexPath = resolveIndexPath();
  const raw = fs.readFileSync(indexPath, 'utf8');
  const parsed: ManualIndexFile = JSON.parse(raw);

  const pages = parsed.pages;
  const numDocs = pages.length;
  const pageById = new Map<string, ManualPage>();
  const pageByPartAndNum = new Map<string, ManualPage>();
  const invertedIndex = new Map<string, PagePosting[]>();
  const menuIndex = new Map<string, number[]>();
  const formIndex = new Map<string, number[]>();
  const docLengths = new Float32Array(numDocs);
  const isTocPage = new Uint8Array(numDocs);
  const lowerTexts: string[] = new Array(numDocs);

  let totalLength = 0;

  for (let i = 0; i < numDocs; i++) {
    const pg = pages[i];
    pageById.set(pg.id, pg);
    pageByPartAndNum.set(`${pg.part}:${pg.pdfPage}`, pg);

    const lowerText = pg.text.toLowerCase();
    lowerTexts[i] = lowerText;

    // Detect Table of Contents pages so procedure queries don't get flooded with TOC lines
    const dotLeaders = (pg.text.match(/\.{4,}/g) || []).length;
    if (
      pg.chapter === 'Table of Contents' ||
      dotLeaders >= 5 ||
      (pg.pdfPage <= 18 && /\bcontents\b/i.test(pg.text.slice(0, 300)))
    ) {
      isTocPage[i] = 1;
    }

    // Index text + chapter + headings (chapter/headings weighted slightly by inclusion)
    const combinedText = `${pg.chapter}\n${pg.headings.join('\n')}\n${pg.text}`;
    const tokens = tokenize(combinedText);
    docLengths[i] = tokens.length;
    totalLength += tokens.length;

    const tfMap = new Map<string, number>();
    for (const tok of tokens) {
      tfMap.set(tok, (tfMap.get(tok) || 0) + 1);
    }

    for (const [term, tf] of tfMap.entries()) {
      let postings = invertedIndex.get(term);
      if (!postings) {
        postings = [];
        invertedIndex.set(term, postings);
      }
      postings.push({ pageIdx: i, tf });
    }

    for (const menu of pg.menus) {
      const key = menu.toUpperCase();
      let list = menuIndex.get(key);
      if (!list) {
        list = [];
        menuIndex.set(key, list);
      }
      list.push(i);
    }

    for (const form of pg.forms) {
      const key = form.toLowerCase().replace(/\s+/g, '');
      let list = formIndex.get(key);
      if (!list) {
        list = [];
        formIndex.set(key, list);
      }
      list.push(i);
    }
  }

  const avgDocLength = numDocs > 0 ? totalLength / numDocs : 1;
  const idf = new Map<string, number>();
  for (const [term, postings] of invertedIndex.entries()) {
    const df = postings.length;
    const score = Math.log(1 + (numDocs - df + 0.5) / (df + 0.5));
    idf.set(term, score);
  }

  cachedState = {
    meta: parsed.meta,
    pages,
    pageById,
    pageByPartAndNum,
    invertedIndex,
    menuIndex,
    formIndex,
    docLengths,
    avgDocLength,
    idf,
    isTocPage,
    lowerTexts,
  };

  return cachedState;
}
