import { getManualIndex, STOPWORDS, tokenize } from './manual-index.ts';
import type { ChatTurn, CitationRef, LookupResult, ManualPage, ManualPartFilter } from './types.ts';

// Domain synonym & concept expansion tailored for India Post POSB Finacle CBS
const CBS_SYNONYMS: Record<string, string[]> = {
  sb: ['savings', 'saving', 'savings bank', 'casbao', 'casbav'],
  savings: ['sb', 'savings bank'],
  rd: ['recurring', 'recurring deposit', 'crdp', 'crdaco'],
  recurring: ['rd', 'recurring deposit'],
  td: ['time deposit', 'ctdao', 'term deposit'],
  mis: ['monthly income', 'monthly income scheme', 'cmisao'],
  scss: ['senior citizen', 'senior citizens', 'cscsao'],
  ppf: ['public provident fund', 'cppfao', 'cppf'],
  ssa: ['sukanya', 'sukanya samriddhi', 'cssao'],
  nsc: ['national savings certificate', 'cnscao'],
  kvp: ['kisan vikas patra', 'ckvpao'],
  mssc: ['mahila samman', 'cmsscao'],
  cif: ['customer', 'customer id', 'ccif', 'cifm', 'cifi'],
  kyc: ['know your customer', 'identity', 'address proof', 'pan', 'aadhaar'],
  tds: ['tax deducted', '194n', 'income tax', 'deduction', 'htdsip'],
  '194n': ['tds', 'cash withdrawal', 'section 194n', 'income tax'],
  closure: ['close', 'closing', 'closed', 'hcaac', 'hcaactd', 'csbco'],
  premature: ['pre-mature', 'preclosure', 'before maturity', 'closure'],
  deceased: ['death', 'claim', 'nominee', 'legal heir', 'settlement', 'demise'],
  claim: ['deceased', 'nominee', 'settlement', 'heir'],
  duplicate: ['lost', 'spoilt', 'reissue', 'passbook', 'hpbp', 'hpbpr'],
  passbook: ['pass book', 'hpbp', 'hpbpr', 'duplicate', 'printing'],
  transfer: ['inter-sol', 'transferring', 'hacxfrsc', 'hacxfsol', 'migration'],
  maker: ['counter pa', 'counter assistant', 'entry', 'initiation', 'supervisor', 'checker'],
  checker: ['supervisor', 'spm', 'apm', 'verification', 'verify', 'maker'],
  failed: ['failure', 'error', 'reversal', 'pending', 'timeout', 'dispute', 'recon'],
  silent: ['dormant', 'inoperative', 'reactivation', 'revival'],
  dormant: ['silent', 'inoperative', 'reactivation'],
  nomination: ['nominee', 'register', 'cancellation', 'modification'],
  cheque: ['check', 'clearing', 'cts', 'hichb', 'hspp', 'hoctm', 'hictm'],
  atm: ['debit card', 'card', 'hotlist', 'pin'],
  opening: ['open', 'new account', 'casbao', 'crdp'],
  withdrawal: ['withdraw', 'debit', 'ctm', 'htm', 'sb-7'],
  deposit: ['credit', 'ctm', 'htm', 'sb-103'],
  loan: ['advance', 'withdrawal', 'pledge'],
  eod: ['end of day', 'hsolval', 'hisol', 'bod', 'day end'],
  standing: ['si', 'hsi', 'standing instruction', 'auto transfer'],
};

const FOLLOWUP_PATTERNS = [
  /^(?:which|what)\s+(?:menu|form|forms|document|documents|register|rule|section|limit|fee|charge|charges|steps?)\b/i,
  /^(?:and|also|what about|how about|what if|can you|explain more|tell me more|elaborate|give|list)\b/i,
  /\b(?:it|this|that|the same|above|such account|same account|for this|for that|in this case)\b/i,
];

export function normalizeQuery(query: string): string {
  return query
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'");
}

export function buildEffectiveQuery(query: string, history: ChatTurn[] = []): string {
  const clean = normalizeQuery(query);
  if (!history.length) return clean;

  const words = tokenize(clean).filter((w) => !STOPWORDS.has(w));
  const looksLikeFollowup =
    words.length <= 5 || FOLLOWUP_PATTERNS.some((re) => re.test(clean));

  if (!looksLikeFollowup) return clean;

  // Gather recent user questions (up to last 2 user turns) for topic continuity
  const recentUserTurns = history
    .filter((t) => t.role === 'user')
    .slice(-2)
    .map((t) => t.content);

  if (!recentUserTurns.length) return clean;

  // Also grab any Finacle menu codes mentioned in the immediately preceding assistant answer
  const lastAssistant = [...history].reverse().find((t) => t.role === 'assistant');
  const prevMenus = lastAssistant
    ? Array.from(new Set((lastAssistant.content.match(/\b[A-Z][A-Z0-9]{3,10}\b/g) || []).slice(0, 4)))
    : [];

  return `${recentUserTurns.join(' ')} ${prevMenus.join(' ')} ${clean}`.trim();
}

function getPdfUrl(part: 1 | 2): string {
  return part === 1
    ? '/manuals/POSB_CBS_Manual_2026_Part_1.pdf'
    : '/manuals/POSB_CBS_Manual_2026_Part_2.pdf';
}

function extractQuerySignals(rawQuery: string) {
  const normalized = normalizeQuery(rawQuery);
  const allTokens = tokenize(normalized);
  const coreTokens = allTokens.filter((t) => !STOPWORDS.has(t));
  const effectiveTokens = coreTokens.length > 0 ? coreTokens : allTokens;

  // Detect explicit Finacle menu codes (either typed in uppercase or matching known menu index)
  const index = getManualIndex();
  const menuCodes = new Set<string>();
  const rawUpperMatches = normalized.match(/\b[A-Za-z][A-Za-z0-9]{2,11}\b/g) || [];
  for (const tok of rawUpperMatches) {
    const up = tok.toUpperCase();
    if (index.menuIndex.has(up)) {
      menuCodes.add(up);
    }
  }

  // Detect form numbers like SB-103, SB 103, SB-7A, Form 15G, etc.
  const formKeys = new Set<string>();
  const formRegex = /\b(?:SB|RD|TD|MIS|PPF|SCSS|SSA|NSC|KVP|NC|ACG|MS|TR|BO|SO|HO)[\s-]?\d+[A-Za-z0-9()/-]*\b/gi;
  for (const m of normalized.match(formRegex) || []) {
    formKeys.add(m.toLowerCase().replace(/\s+/g, '-'));
    formKeys.add(m.toLowerCase().replace(/[\s-]+/g, ''));
  }

  // Detect chapter / appendix / rule / section numbers
  const chapterMatch = normalized.match(/\bchapter\s*[-–:]?\s*([0-9IVX]+)\b/i);
  const appendixMatch = normalized.match(/\b(?:appendix|annexure)\s*[-–:]?\s*([0-9A-Z]+)\b/i);
  const ruleMatches = normalized.match(/\b(?:rule|section|sec\.?|para)\s+(\d+[A-Za-z0-9().-]*)\b/gi) || [];
  const sectionCodes = normalized.match(/\b194[A-Z]\b|\b269(?:SS|ST|T)\b|\b80C\b/gi) || [];
  const pageMatch = normalized.match(/\bpage\s*(?:no\.?|number)?\s*(\d{1,3})\b/i);

  // Build weighted expansion terms (semantic concept expansion)
  const expandedTerms = new Map<string, number>();
  for (const tok of effectiveTokens) {
    expandedTerms.set(tok, Math.max(expandedTerms.get(tok) || 0, 1.0));
    const syns = CBS_SYNONYMS[tok];
    if (syns) {
      for (const syn of syns) {
        const synToks = tokenize(syn).filter((t) => !STOPWORDS.has(t));
        for (const st of synToks) {
          if (!expandedTerms.has(st)) {
            expandedTerms.set(st, 0.35);
          }
        }
      }
    }
  }

  // Bigrams from effective tokens for phrase matching
  const bigrams: string[] = [];
  for (let i = 0; i < effectiveTokens.length - 1; i++) {
    bigrams.push(`${effectiveTokens[i]} ${effectiveTokens[i + 1]}`);
  }

  return {
    normalized,
    lowerQuery: normalized.toLowerCase(),
    effectiveTokens: Array.from(new Set(effectiveTokens)),
    expandedTerms,
    bigrams,
    menuCodes: Array.from(menuCodes),
    formKeys: Array.from(formKeys),
    chapterTarget: chapterMatch ? chapterMatch[1].toUpperCase() : null,
    appendixTarget: appendixMatch ? appendixMatch[1].toUpperCase() : null,
    ruleTargets: ruleMatches.map((r) => r.toLowerCase().replace(/\s+/g, ' ')),
    sectionCodes: sectionCodes.map((s) => s.toLowerCase()),
    pageTarget: pageMatch ? parseInt(pageMatch[1], 10) : null,
  };
}

function buildSnippet(page: ManualPage, matchedTerms: string[], rawQuery: string, maxLen = 340): string {
  const text = page.text.replace(/\s+/g, ' ').trim();
  if (!text) return 'No extractable text on this page.';
  if (text.length <= maxLen) return text;

  const lower = text.toLowerCase();
  const termsToFind = [
    rawQuery.toLowerCase().trim(),
    ...matchedTerms.map((t) => t.toLowerCase()),
  ].filter((t) => t.length >= 2);

  let bestPos = -1;
  for (const t of termsToFind) {
    const pos = lower.indexOf(t);
    if (pos !== -1) {
      bestPos = pos;
      break;
    }
  }

  if (bestPos === -1) {
    return text.slice(0, maxLen).trim() + '…';
  }

  const start = Math.max(0, bestPos - 90);
  const end = Math.min(text.length, start + maxLen);
  let slice = text.slice(start, end).trim();
  if (start > 0) slice = '…' + slice;
  if (end < text.length) slice = slice + '…';
  return slice;
}

export interface RetrievalOptions {
  partFilter?: ManualPartFilter;
  limit?: number;
  includeAdjacent?: boolean;
  forLookup?: boolean;
}

export function searchManualPages(
  rawQuery: string,
  options: RetrievalOptions = {}
): LookupResult[] {
  const { partFilter = 'all', limit = 12, includeAdjacent = false, forLookup = false } = options;
  const index = getManualIndex();
  const signals = extractQuerySignals(rawQuery);

  if (
    signals.effectiveTokens.length === 0 &&
    signals.menuCodes.length === 0 &&
    signals.formKeys.length === 0 &&
    !signals.chapterTarget &&
    !signals.appendixTarget &&
    !signals.pageTarget
  ) {
    return [];
  }

  const k1 = 1.4;
  const b = 0.72;
  const scores = new Float64Array(index.pages.length);
  const matchedPerPage = new Map<number, Set<string>>();

  const addMatch = (pageIdx: number, term: string, boost: number) => {
    scores[pageIdx] += boost;
    let set = matchedPerPage.get(pageIdx);
    if (!set) {
      set = new Set();
      matchedPerPage.set(pageIdx, set);
    }
    set.add(term);
  };

  // 1. BM25 lexical + semantic concept expansion scoring
  for (const [term, weight] of signals.expandedTerms.entries()) {
    const postings = index.invertedIndex.get(term);
    if (!postings) continue;
    const idf = index.idf.get(term) || 0.5;
    for (const { pageIdx, tf } of postings) {
      const dl = index.docLengths[pageIdx] || 1;
      const denom = tf + k1 * (1 - b + (b * dl) / index.avgDocLength);
      const bm25 = idf * ((tf * (k1 + 1)) / denom) * weight;
      addMatch(pageIdx, term, bm25);
    }
  }

  // 2. Exact Finacle menu-code boost
  for (const code of signals.menuCodes) {
    const pageIndices = index.menuIndex.get(code) || [];
    for (const pageIdx of pageIndices) {
      addMatch(pageIdx, code, 18.0);
    }
  }

  // 3. Exact Form number boost
  for (const fk of signals.formKeys) {
    const pageIndices = index.formIndex.get(fk) || [];
    for (const pageIdx of pageIndices) {
      addMatch(pageIdx, fk.toUpperCase(), 15.0);
    }
  }

  // 4. Phrase, heading, chapter, appendix, rule, section, and page boosts
  const wantToc = /\b(?:table of contents|contents|index)\b/i.test(signals.normalized);
  const queryHasExactPhrase = signals.lowerQuery.length >= 4 && signals.lowerQuery.length <= 64;

  for (let i = 0; i < index.pages.length; i++) {
    const pg = index.pages[i];
    if (partFilter === '1' && pg.part !== 1) {
      scores[i] = 0;
      continue;
    }
    if (partFilter === '2' && pg.part !== 2) {
      scores[i] = 0;
      continue;
    }

    const lowerText = index.lowerTexts[i];
    const lowerChapter = pg.chapter.toLowerCase();
    const lowerHeadings = pg.headings.join(' ').toLowerCase();

    // Direct page target match
    if (signals.pageTarget !== null && pg.pdfPage === signals.pageTarget) {
      addMatch(i, `Page ${signals.pageTarget}`, 14.0);
    }

    // Chapter target match
    if (signals.chapterTarget) {
      const chapRe = new RegExp(`\\bchapter\\s*[-–:]?\\s*${signals.chapterTarget}\\b`, 'i');
      if (chapRe.test(pg.chapter)) {
        addMatch(i, `Chapter ${signals.chapterTarget}`, 12.0);
      }
    }

    // Appendix target match
    if (signals.appendixTarget) {
      const appRe = new RegExp(`\\b(?:appendix|annexure)\\s*[-–:]?\\s*${signals.appendixTarget}\\b`, 'i');
      if (appRe.test(pg.chapter) || appRe.test(lowerText.slice(0, 400))) {
        addMatch(i, `Appendix ${signals.appendixTarget}`, 16.0);
      }
    }

    if (scores[i] <= 0 && !signals.ruleTargets.length && !signals.sectionCodes.length) {
      continue;
    }

    // Exact phrase match
    if (queryHasExactPhrase && lowerText.includes(signals.lowerQuery)) {
      addMatch(i, signals.normalized, 12.0);
    }

    // Bigram matches
    for (const bg of signals.bigrams) {
      if (lowerText.includes(bg)) {
        addMatch(i, bg, 4.5);
      }
      if (lowerChapter.includes(bg) || lowerHeadings.includes(bg)) {
        addMatch(i, bg, 6.0);
      }
    }

    // Heading & chapter matches for core query terms
    let coreTermsMatched = 0;
    for (const tok of signals.effectiveTokens) {
      if (lowerText.includes(tok)) {
        coreTermsMatched++;
      }
      if (lowerChapter.includes(tok)) {
        scores[i] += 2.2;
      }
      if (lowerHeadings.includes(tok)) {
        scores[i] += 2.8;
      }
    }

    // Coverage bonus: reward pages containing a high fraction of the user's distinct query terms
    if (signals.effectiveTokens.length >= 2 && coreTermsMatched > 0) {
      const coverage = coreTermsMatched / signals.effectiveTokens.length;
      scores[i] *= 0.65 + 0.75 * coverage;
    }

    // Exact Rule/Section number boost
    for (const r of signals.ruleTargets) {
      if (lowerText.includes(r)) {
        addMatch(i, r, 14.0);
      }
    }
    for (const sc of signals.sectionCodes) {
      if (lowerText.includes(sc)) {
        addMatch(i, sc.toUpperCase(), 16.0);
      }
    }

    // Deprioritize Table of Contents pages unless explicitly asked
    if (index.isTocPage[i] && !wantToc) {
      scores[i] *= forLookup ? 0.45 : 0.22;
    }

    // Penalize nearly empty pages
    if (pg.text.length < 40) {
      scores[i] *= 0.25;
    }
  }

  // Collect ranked candidates
  const ranked: Array<{ pageIdx: number; score: number }> = [];
  for (let i = 0; i < scores.length; i++) {
    if (scores[i] > 0.6) {
      ranked.push({ pageIdx: i, score: scores[i] });
    }
  }

  ranked.sort((a, b) => b.score - a.score);

  // Filter out weak noise relative to the top score so irrelevant pages aren't stuffed into context
  const topScore = ranked[0]?.score || 0;
  const minThreshold = forLookup ? Math.max(0.8, topScore * 0.14) : Math.max(1.8, topScore * 0.26);

  const selectedIndices: number[] = [];
  const selectedSet = new Set<number>();

  for (const item of ranked) {
    if (selectedIndices.length >= limit) break;
    if (item.score < minThreshold && selectedIndices.length >= 2) break;
    selectedIndices.push(item.pageIdx);
    selectedSet.add(item.pageIdx);
  }

  // Optionally include the immediately following continuation page for the top 2 hits
  // (procedures in CBS Manuals frequently spill onto the very next page!)
  if (includeAdjacent && selectedIndices.length > 0) {
    const seeds = selectedIndices.slice(0, 2);
    for (const seedIdx of seeds) {
      if (selectedIndices.length >= limit + 2) break;
      const pg = index.pages[seedIdx];
      const nextPg = index.pageByPartAndNum.get(`${pg.part}:${pg.pdfPage + 1}`);
      if (nextPg && nextPg.chapter === pg.chapter) {
        const nextIdx = seedIdx + 1;
        if (
          nextIdx < index.pages.length &&
          index.pages[nextIdx].id === nextPg.id &&
          !selectedSet.has(nextIdx) &&
          !index.isTocPage[nextIdx]
        ) {
          selectedIndices.push(nextIdx);
          selectedSet.add(nextIdx);
          if (scores[nextIdx] < 1) {
            scores[nextIdx] = Math.max(scores[nextIdx], scores[seedIdx] * 0.45);
          }
        }
      }
    }
  }

  return selectedIndices.map((idx) => {
    const pg = index.pages[idx];
    const matchedTerms = Array.from(matchedPerPage.get(idx) || []).slice(0, 8);
    return {
      id: pg.id,
      part: pg.part,
      partLabel: pg.partLabel,
      pdfPage: pg.pdfPage,
      printedPage: pg.printedPage,
      chapter: pg.chapter,
      headings: pg.headings,
      snippet: buildSnippet(pg, matchedTerms, signals.normalized),
      matchedTerms,
      menus: pg.menus,
      rules: pg.rules,
      forms: pg.forms,
      score: Number(scores[idx].toFixed(2)),
      pdfUrl: getPdfUrl(pg.part),
    };
  });
}

export function retrieveContextForAI(
  query: string,
  history: ChatTurn[] = [],
  partFilter: ManualPartFilter = 'all'
): {
  effectiveQuery: string;
  citations: CitationRef[];
  contextBlock: string;
} {
  const effectiveQuery = buildEffectiveQuery(query, history);
  const results = searchManualPages(effectiveQuery, {
    partFilter,
    limit: 8,
    includeAdjacent: true,
    forLookup: false,
  });

  const index = getManualIndex();
  const citations: CitationRef[] = results.map((r) => ({
    id: r.id,
    part: r.part,
    partLabel: r.partLabel,
    pdfPage: r.pdfPage,
    printedPage: r.printedPage,
    chapter: r.chapter,
    excerpt: r.snippet,
    matchedTerms: r.matchedTerms,
    menus: r.menus,
    forms: r.forms,
    score: r.score,
    pdfUrl: r.pdfUrl,
  }));

  // Build compact, structured context with exact Part, Chapter, and PDF Page identifiers
  const MAX_CHARS_PER_PAGE = 3400;
  const blocks = results.map((r) => {
    const fullPage = index.pageById.get(r.id);
    const pageText = fullPage ? fullPage.text.slice(0, MAX_CHARS_PER_PAGE) : r.snippet;
    const menuLine = r.menus.length ? `Finacle Menus on Page: ${r.menus.join(', ')}` : '';
    const formLine = r.forms.length ? `Forms on Page: ${r.forms.join(', ')}` : '';
    const metaLines = [menuLine, formLine].filter(Boolean).join(' | ');
    return [
      `=== SOURCE: CBS Manual ${r.partLabel} – ${r.chapter}, Page ${r.pdfPage} (PDF Page ${r.pdfPage}${r.printedPage && r.printedPage !== String(r.pdfPage) ? `, Printed Page ${r.printedPage}` : ''}) ===`,
      metaLines,
      pageText,
    ]
      .filter(Boolean)
      .join('\n');
  });

  return {
    effectiveQuery,
    citations,
    contextBlock: blocks.join('\n\n'),
  };
}
