import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  BookOpen,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  FileText,
  History,
  Loader2,
  MessageSquare,
  Search,
  X,
} from 'lucide-react';
import { EXAMPLE_LOOKUP_TERMS } from '../data/cbsQuickData';
import type {
  LookupResult,
  ManualMeta,
  ManualPartFilter,
  PdfViewerRequest,
} from '../types';

interface ManualLookupViewProps {
  initialQuery?: string;
  onConsumeInitialQuery?: () => void;
  searchHistory: string[];
  onRecordSearch: (term: string) => void;
  onClearSearchHistory: () => void;
  onOpenPdf: (req: PdfViewerRequest) => void;
  onAskAboutTopic: (question: string) => void;
  manualMeta: ManualMeta | null;
}

export function ManualLookupView({
  initialQuery,
  onConsumeInitialQuery,
  searchHistory,
  onRecordSearch,
  onClearSearchHistory,
  onOpenPdf,
  onAskAboutTopic,
  manualMeta,
}: ManualLookupViewProps) {
  const [query, setQuery] = useState('');
  const [partFilter, setPartFilter] = useState<ManualPartFilter>('all');
  const [results, setResults] = useState<LookupResult[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showChapters, setShowChapters] = useState(true);
  const [chapterPartTab, setChapterPartTab] = useState<1 | 2>(1);

  const runSearch = useCallback(
    async (term: string, part: ManualPartFilter, record = true) => {
      const clean = term.trim();
      if (!clean) {
        setError('Enter a keyword, Finacle menu code, rule, chapter, appendix, or form number.');
        return;
      }

      setLoading(true);
      setError(null);
      setHasSearched(true);
      setShowChapters(false);
      if (record) onRecordSearch(clean);

      try {
        const res = await fetch(
          `/api/search?q=${encodeURIComponent(clean)}&part=${encodeURIComponent(part)}&limit=30`
        );
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'Search request failed.');
        }
        setResults(Array.isArray(data.results) ? data.results : []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to search the manuals right now.');
        setResults([]);
      } finally {
        setLoading(false);
      }
    },
    [onRecordSearch]
  );

  // Support deep-link jump from Assistant or Finacle Menus tab
  useEffect(() => {
    if (initialQuery && initialQuery.trim()) {
      setQuery(initialQuery);
      void runSearch(initialQuery, partFilter, true);
      onConsumeInitialQuery?.();
    }
  }, [initialQuery, onConsumeInitialQuery, partFilter, runSearch]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void runSearch(query, partFilter, true);
  };

  const handleFilterChange = (nextPart: ManualPartFilter) => {
    setPartFilter(nextPart);
    if (query.trim() && hasSearched) {
      void runSearch(query, nextPart, false);
    }
  };

  const handleCopyCitation = async (item: LookupResult) => {
    const text = `CBS Manual ${item.partLabel} – ${item.chapter}, Page ${item.pdfPage}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(item.id);
      setTimeout(() => setCopiedId(null), 1800);
    } catch {
      // ignore
    }
  };

  const highlightSnippet = (snippet: string, terms: string[]) => {
    const cleanTerms = Array.from(
      new Set([query.trim(), ...terms].filter((t) => t.trim().length >= 2))
    );
    if (!cleanTerms.length) return snippet;
    const escaped = cleanTerms
      .slice(0, 8)
      .map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    const re = new RegExp(`(${escaped.join('|')})`, 'gi');
    const parts = snippet.split(re);
    return parts.map((seg, i) =>
      re.test(seg) ? (
        <mark
          key={i}
          className="bg-[#FFCD00]/55 dark:bg-[#FFCD00]/30 text-stone-950 dark:text-stone-100 px-0.5 rounded-xs"
        >
          {seg}
        </mark>
      ) : (
        <React.Fragment key={i}>{seg}</React.Fragment>
      )
    );
  };

  const filteredChapters = (manualMeta?.chapters || []).filter(
    (c) => c.part === chapterPartTab && !/^(Cover|Front Matter|Table of Contents|Foreword|Preface)/i.test(c.chapter)
  );

  return (
    <div className="flex-1 overflow-y-auto bg-[#FAF7F2] dark:bg-[#141312] px-4 sm:px-6 lg:px-8 py-6">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="font-display text-2xl font-bold text-stone-900 dark:text-stone-100">
            Manual Lookup
          </h1>
          <p className="text-sm text-stone-600 dark:text-stone-400 mt-1">
            Search across all 748 indexed pages of POSB CBS Manual 2026 (Part I &amp; Part II) by
            keyword, Finacle menu code, rule, chapter, appendix, or form number.
          </p>
        </div>

        {/* Search Controls Card */}
        <div className="rounded-xl bg-white dark:bg-[#1C1B19] border border-stone-200 dark:border-stone-800 p-4 sm:p-5 space-y-4">
          <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-2.5">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search CASBAO, CRDP, CASBAV, SB-103, 194N, deceased claim, Appendix IV…"
                aria-label="Manual lookup query"
                className="w-full pl-10 pr-9 py-2.5 rounded-lg border border-stone-300 dark:border-stone-700 bg-[#FAF7F2] dark:bg-[#22201D] text-sm text-stone-900 dark:text-stone-100 placeholder:text-stone-400 focus:outline-none focus:border-[#C8102E] dark:focus:border-[#FFCD00]"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => {
                    setQuery('');
                    setResults([]);
                    setHasSearched(false);
                    setError(null);
                    setShowChapters(true);
                  }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 cursor-pointer"
                  aria-label="Clear search"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-[#C8102E] hover:bg-[#A00D24] text-white text-sm font-medium transition-colors cursor-pointer whitespace-nowrap disabled:opacity-60"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              Search Manuals
            </button>
          </form>

          {/* Part Filter + Example Searches */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div
              className="inline-flex p-0.5 rounded-lg bg-stone-100 dark:bg-stone-900 border border-stone-200 dark:border-stone-800"
              role="group"
              aria-label="Filter manual part"
            >
              {(
                [
                  { value: 'all', label: 'Both Parts' },
                  { value: '1', label: 'Part I (389p)' },
                  { value: '2', label: 'Part II (359p)' },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => handleFilterChange(opt.value)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                    partFilter === opt.value
                      ? 'bg-white dark:bg-stone-800 text-[#C8102E] dark:text-[#FFCD00] shadow-xs'
                      : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs text-stone-500 dark:text-stone-400 mr-1">Examples:</span>
              {EXAMPLE_LOOKUP_TERMS.slice(0, 7).map((term) => (
                <button
                  key={term}
                  type="button"
                  onClick={() => {
                    setQuery(term);
                    void runSearch(term, partFilter, true);
                  }}
                  className="px-2 py-1 rounded-md font-mono text-xs bg-[#FAF7F2] dark:bg-stone-900 border border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-300 hover:border-[#C8102E] dark:hover:border-[#FFCD00] hover:text-[#C8102E] dark:hover:text-[#FFCD00] transition-colors cursor-pointer"
                >
                  {term}
                </button>
              ))}
            </div>
          </div>

          {/* Search History */}
          {searchHistory.length > 0 && (
            <div className="pt-3 border-t border-stone-100 dark:border-stone-800 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 text-xs text-stone-500 dark:text-stone-400">
                <History className="w-3.5 h-3.5" />
                Recent:
              </span>
              {searchHistory.slice(0, 8).map((term) => (
                <button
                  key={term}
                  type="button"
                  onClick={() => {
                    setQuery(term);
                    void runSearch(term, partFilter, false);
                  }}
                  className="px-2.5 py-1 rounded-md text-xs bg-stone-100 dark:bg-stone-800/80 text-stone-700 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-700 transition-colors cursor-pointer"
                >
                  {term}
                </button>
              ))}
              <button
                type="button"
                onClick={onClearSearchHistory}
                className="ml-auto text-xs text-stone-400 hover:text-[#C8102E] dark:hover:text-[#FFCD00] cursor-pointer"
              >
                Clear history
              </button>
            </div>
          )}
        </div>

        {/* Error state */}
        {error && (
          <div className="rounded-xl border border-red-200 dark:border-red-900/60 bg-red-50/70 dark:bg-red-950/30 p-4 flex items-center gap-2.5 text-sm text-red-800 dark:text-red-300">
            <AlertCircle className="w-4 h-4 shrink-0 text-[#C8102E]" />
            <span>{error}</span>
          </div>
        )}

        {/* Loading state */}
        {loading && (
          <div className="flex items-center justify-center gap-2.5 py-12 text-sm text-stone-500 dark:text-stone-400">
            <Loader2 className="w-5 h-5 animate-spin text-[#C8102E]" />
            <span>Searching POSB CBS Manual 2026 index…</span>
          </div>
        )}

        {/* Results list */}
        {!loading && hasSearched && !error && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-stone-900 dark:text-stone-100 tabular-nums">
                {results.length === 0
                  ? `No matching pages found for "${query}"`
                  : `Showing ${results.length} matching page${results.length === 1 ? '' : 's'} for "${query}"`}
              </h2>
              {results.length > 0 && (
                <button
                  type="button"
                  onClick={() =>
                    onAskAboutTopic(`Explain the official POSB CBS Manual procedure and rules regarding "${query}".`)
                  }
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-[#1C1B19] text-xs font-medium text-stone-800 dark:text-stone-200 hover:border-[#C8102E] dark:hover:border-[#FFCD00] transition-colors cursor-pointer"
                >
                  <MessageSquare className="w-3.5 h-3.5 text-[#C8102E] dark:text-[#FFCD00]" />
                  Ask AI Assistant about "{query}"
                </button>
              )}
            </div>

            {results.length === 0 ? (
              <div className="rounded-xl bg-white dark:bg-[#1C1B19] border border-stone-200 dark:border-stone-800 p-8 text-center space-y-2">
                <p className="text-sm font-medium text-stone-800 dark:text-stone-200">
                  No pages matched your query in the selected manual part.
                </p>
                <p className="text-xs text-stone-500 dark:text-stone-400">
                  Try switching to &ldquo;Both Parts&rdquo;, checking spelling, or searching by a
                  scheme name (e.g., SB, RD, TD, PPF, SCSS) or Finacle menu code.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {results.map((item) => (
                  <article
                    key={item.id}
                    className="rounded-xl bg-white dark:bg-[#1C1B19] border border-stone-200 dark:border-stone-800 p-4 sm:p-5 space-y-3"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2 text-xs text-stone-500 dark:text-stone-400">
                          <span className="font-semibold text-[#C8102E] dark:text-[#FFCD00]">
                            CBS Manual {item.partLabel}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono font-medium text-stone-800 dark:text-stone-200 tabular-nums">
                            PDF Page {item.pdfPage}
                          </span>
                          {item.printedPage && item.printedPage !== String(item.pdfPage) && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="tabular-nums">Printed p. {item.printedPage}</span>
                            </>
                          )}
                        </div>
                        <h3 className="font-display font-semibold text-base text-stone-900 dark:text-stone-100 mt-1">
                          {item.chapter}
                        </h3>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() =>
                            onOpenPdf({
                              part: item.part,
                              page: item.pdfPage,
                              chapter: item.chapter,
                              highlightTerms: [query, ...item.matchedTerms],
                              initialMode: 'pdf',
                            })
                          }
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#C8102E] hover:bg-[#A00D24] text-white text-xs font-medium transition-colors cursor-pointer whitespace-nowrap"
                        >
                          <BookOpen className="w-3.5 h-3.5" />
                          Open PDF
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            onOpenPdf({
                              part: item.part,
                              page: item.pdfPage,
                              chapter: item.chapter,
                              highlightTerms: [query, ...item.matchedTerms],
                              initialMode: 'text',
                            })
                          }
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-stone-200 dark:border-stone-700 text-xs font-medium text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors cursor-pointer whitespace-nowrap"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          Preview
                        </button>
                        <button
                          type="button"
                          onClick={() => handleCopyCitation(item)}
                          className="p-1.5 rounded-lg border border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors cursor-pointer"
                          title="Copy citation"
                          aria-label="Copy citation"
                        >
                          {copiedId === item.id ? (
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </div>

                    <p className="text-sm text-stone-700 dark:text-stone-300 leading-relaxed">
                      {highlightSnippet(item.snippet, item.matchedTerms)}
                    </p>

                    {(item.menus.length > 0 || item.forms.length > 0 || item.rules.length > 0) && (
                      <div className="pt-2 border-t border-stone-100 dark:border-stone-800/80 flex flex-wrap gap-x-5 gap-y-1 text-xs text-stone-500 dark:text-stone-400">
                        {item.menus.length > 0 && (
                          <span>
                            <strong className="text-stone-700 dark:text-stone-300">Menus:</strong>{' '}
                            <span className="font-mono">{item.menus.slice(0, 6).join(', ')}</span>
                          </span>
                        )}
                        {item.forms.length > 0 && (
                          <span>
                            <strong className="text-stone-700 dark:text-stone-300">Forms:</strong>{' '}
                            <span className="font-mono">{item.forms.slice(0, 5).join(', ')}</span>
                          </span>
                        )}
                        {item.rules.length > 0 && (
                          <span>
                            <strong className="text-stone-700 dark:text-stone-300">Rules:</strong>{' '}
                            {item.rules.slice(0, 4).join(', ')}
                          </span>
                        )}
                      </div>
                    )}
                  </article>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Browsable Chapter & Appendix Directory */}
        {manualMeta && (
          <div className="rounded-xl bg-white dark:bg-[#1C1B19] border border-stone-200 dark:border-stone-800 overflow-hidden">
            <button
              type="button"
              onClick={() => setShowChapters((prev) => !prev)}
              className="w-full px-5 py-3.5 flex items-center justify-between text-left hover:bg-stone-50 dark:hover:bg-stone-800/40 transition-colors cursor-pointer"
            >
              <div>
                <h2 className="font-display font-semibold text-sm text-stone-900 dark:text-stone-100">
                  Browse Chapters &amp; Appendices (POSB CBS Manual 2026)
                </h2>
                <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
                  Jump directly to any Chapter in Part I or Appendix in Part II
                </p>
              </div>
              {showChapters ? (
                <ChevronUp className="w-4 h-4 text-stone-500" />
              ) : (
                <ChevronDown className="w-4 h-4 text-stone-500" />
              )}
            </button>

            {showChapters && (
              <div className="px-5 pb-5 pt-2 border-t border-stone-100 dark:border-stone-800 space-y-3">
                <div className="inline-flex p-0.5 rounded-lg bg-stone-100 dark:bg-stone-900 border border-stone-200 dark:border-stone-800">
                  <button
                    type="button"
                    onClick={() => setChapterPartTab(1)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                      chapterPartTab === 1
                        ? 'bg-white dark:bg-stone-800 text-[#C8102E] dark:text-[#FFCD00] shadow-xs'
                        : 'text-stone-600 dark:text-stone-400'
                    }`}
                  >
                    Part I — Chapters (389p)
                  </button>
                  <button
                    type="button"
                    onClick={() => setChapterPartTab(2)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                      chapterPartTab === 2
                        ? 'bg-white dark:bg-stone-800 text-[#C8102E] dark:text-[#FFCD00] shadow-xs'
                        : 'text-stone-600 dark:text-stone-400'
                    }`}
                  >
                    Part II — Appendices (359p)
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {filteredChapters.map((ch) => (
                    <button
                      key={`${ch.part}-${ch.startPage}-${ch.chapter}`}
                      type="button"
                      onClick={() =>
                        onOpenPdf({
                          part: ch.part,
                          page: ch.startPage,
                          chapter: ch.chapter,
                          initialMode: 'pdf',
                        })
                      }
                      className="flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-lg border border-stone-200 dark:border-stone-800 bg-[#FAF7F2] dark:bg-[#23211E] hover:border-[#C8102E]/60 dark:hover:border-[#FFCD00]/60 text-left transition-colors cursor-pointer group"
                    >
                      <span className="text-xs font-medium text-stone-800 dark:text-stone-200 group-hover:text-[#C8102E] dark:group-hover:text-[#FFCD00] truncate">
                        {ch.chapter}
                      </span>
                      <span className="text-[11px] font-mono text-stone-500 dark:text-stone-400 tabular-nums whitespace-nowrap shrink-0">
                        p. {ch.startPage}–{ch.endPage}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
