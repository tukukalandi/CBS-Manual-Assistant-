import React, { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowUp,
  BookOpen,
  Check,
  Copy,
  Download,
  ExternalLink,
  FileText,
  Loader2,
  Printer,
  RefreshCw,
  RotateCcw,
  Trash2,
} from 'lucide-react';
import { MarkdownWithCitations } from './MarkdownWithCitations';
import { WhatsAppIcon } from './WhatsAppIcon';
import { SUGGESTED_CBS_QUERIES } from '../data/cbsQuickData';
import {
  downloadAnswerAsDoc,
  downloadAnswerAsPdf,
  printAnswerContent,
  shareAnswerPdfViaWhatsApp,
  shareManualPdfViaWhatsApp,
} from '../utils/exportPdf';
import type {
  ChatMessage,
  CitationRef,
  ManualMeta,
  ManualPartFilter,
  PdfViewerRequest,
} from '../types';

interface ChatWorkspaceProps {
  messages: ChatMessage[];
  isGenerating: boolean;
  partFilter: ManualPartFilter;
  onChangePartFilter: (filter: ManualPartFilter) => void;
  onSendMessage: (query: string) => void;
  onRegenerate: (assistantMessageId: string) => void;
  onRetryFailed: (assistantMessageId: string) => void;
  onClearConversation: () => void;
  onOpenPdf: (req: PdfViewerRequest) => void;
  onJumpToLookup: (term: string) => void;
  manualMeta: ManualMeta | null;
}

export function ChatWorkspace({
  messages,
  isGenerating,
  partFilter,
  onChangePartFilter,
  onSendMessage,
  onRegenerate,
  onRetryFailed,
  onClearConversation,
  onOpenPdf,
  onJumpToLookup,
  manualMeta,
}: ChatWorkspaceProps) {
  const [input, setInput] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedCitationKey, setCopiedCitationKey] = useState<string | null>(null);
  const [sharingKey, setSharingKey] = useState<string | null>(null);
  const [shareNotice, setShareNotice] = useState<{ key: string; text: string } | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const part1Pages = manualMeta?.manuals.find((m) => m.part === 1)?.totalPages ?? 389;
  const part2Pages = manualMeta?.manuals.find((m) => m.part === 2)?.totalPages ?? 359;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages.length, messages[messages.length - 1]?.content]);

  // Auto-resize textarea cleanly up to 140px
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
  }, [input]);

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isGenerating) return;
    setInput('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    onSendMessage(trimmed);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleCopyText = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1800);
    } catch {
      // ignore
    }
  };

  const handleCopySingleCitation = async (key: string, c: CitationRef) => {
    const text = `CBS Manual ${c.partLabel} – ${c.chapter}, Page ${c.pdfPage}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedCitationKey(key);
      setTimeout(() => setCopiedCitationKey(null), 1800);
    } catch {
      // ignore
    }
  };

  const getPrecedingQuestion = (index: number): string | undefined => {
    for (let i = index - 1; i >= 0; i--) {
      if (messages[i].role === 'user') return messages[i].content;
    }
    return undefined;
  };

  const showTempNotice = (key: string, text: string) => {
    setShareNotice({ key, text });
    setTimeout(() => {
      setShareNotice((curr) => (curr?.key === key ? null : curr));
    }, 4500);
  };

  const handleWhatsAppAnswerShare = async (msg: ChatMessage, question?: string) => {
    if (sharingKey) return;
    setSharingKey(msg.id);
    try {
      const res = await shareAnswerPdfViaWhatsApp({
        question,
        answer: msg.content,
        citations: msg.citations,
        timestamp: msg.timestamp,
      });
      if (res.mode === 'download-and-wa') {
        showTempNotice(
          msg.id,
          `Saved "${res.filename}" — attach this PDF file in the WhatsApp chat that opened.`
        );
      } else if (res.mode === 'native-share') {
        showTempNotice(msg.id, 'PDF shared successfully.');
      }
    } finally {
      setSharingKey(null);
    }
  };

  const handleWhatsAppManualShare = async (part: 1 | 2) => {
    const key = `manual-${part}`;
    if (sharingKey) return;
    setSharingKey(key);
    try {
      const res = await shareManualPdfViaWhatsApp({ part });
      if (res.mode === 'link-and-wa') {
        showTempNotice(key, `Opened WhatsApp with POSB CBS Manual 2026 Part ${part === 1 ? 'I' : 'II'} PDF link.`);
      }
    } finally {
      setSharingKey(null);
    }
  };

  const isEmpty = messages.length === 0;

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-[#FAF7F2] dark:bg-[#141312]">
      {/* Scrollable conversation / welcome area */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-7">
        <div className="max-w-4xl mx-auto">
          {isEmpty ? (
            <div className="space-y-8 py-2">
              {/* Hero introduction */}
              <div className="space-y-3">
                <div className="text-xs font-medium text-[#C8102E] dark:text-[#FFCD00]">
                  Department of Posts, India · Finacle Core Banking Solution
                </div>
                <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-stone-900 dark:text-stone-100 text-balance max-w-2xl">
                  Official POSB CBS Manual 2026 Reference Assistant
                </h1>
                <p className="text-sm sm:text-base text-stone-600 dark:text-stone-400 max-w-2xl leading-relaxed">
                  Ask Finacle procedural questions, verify Maker and Checker responsibilities, check
                  prescribed forms and menu codes, and open the exact source page in POSB CBS Manual
                  2026 Part I or Part II.
                </p>
              </div>

              {/* Two Official Hosted Manual Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="rounded-xl bg-white dark:bg-[#1C1B19] border border-stone-200 dark:border-stone-800 p-4 flex flex-col justify-between gap-3">
                  <div>
                    <div className="text-xs text-stone-500 dark:text-stone-400 tabular-nums">
                      Official PDF · {part1Pages} Pages · Indexed
                    </div>
                    <h2 className="font-display font-semibold text-base text-stone-900 dark:text-stone-100 mt-1">
                      View CBS Manual 2026 – Part I
                    </h2>
                    <p className="text-xs text-stone-600 dark:text-stone-400 mt-1 leading-relaxed">
                      General rules, SB, RD, TD, MIS, SCSS, PPF, SSA, NSC, KVP, Branch Office CBS
                      procedures, deceased claims, and eKYC operations.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => onOpenPdf({ part: 1, page: 1 })}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#C8102E] hover:bg-[#A00D24] text-white text-xs font-medium transition-colors cursor-pointer whitespace-nowrap"
                    >
                      <BookOpen className="w-3.5 h-3.5" />
                      Open Viewer
                    </button>
                    <a
                      href="/manuals/POSB_CBS_Manual_2026_Part_1.pdf"
                      download="POSB_CBS_Manual_2026_Part_1.pdf"
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-stone-200 dark:border-stone-700 text-xs font-medium text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors whitespace-nowrap"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Download PDF
                    </a>
                    <button
                      type="button"
                      onClick={() => void handleWhatsAppManualShare(1)}
                      disabled={sharingKey === 'manual-1'}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#15803D] hover:bg-[#166534] text-white text-xs font-medium transition-colors cursor-pointer whitespace-nowrap disabled:opacity-60"
                      title="Send Part I PDF via WhatsApp"
                    >
                      {sharingKey === 'manual-1' ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <WhatsAppIcon className="w-3.5 h-3.5" />
                      )}
                      WhatsApp
                    </button>
                    <a
                      href="/manuals/POSB_CBS_Manual_2026_Part_1.pdf"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center p-2 rounded-lg border border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
                      title="Open Part I PDF in new browser tab"
                      aria-label="Open Part I PDF in new tab"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                  {shareNotice?.key === 'manual-1' && (
                    <div className="text-[11px] text-emerald-700 dark:text-emerald-400">
                      {shareNotice.text}
                    </div>
                  )}
                </div>

                <div className="rounded-xl bg-white dark:bg-[#1C1B19] border border-stone-200 dark:border-stone-800 p-4 flex flex-col justify-between gap-3">
                  <div>
                    <div className="text-xs text-stone-500 dark:text-stone-400 tabular-nums">
                      Official PDF · {part2Pages} Pages · Indexed
                    </div>
                    <h2 className="font-display font-semibold text-base text-stone-900 dark:text-stone-100 mt-1">
                      View CBS Manual 2026 – Part II
                    </h2>
                    <p className="text-xs text-stone-600 dark:text-stone-400 mt-1 leading-relaxed">
                      Appendices covering KYC/AML norms, Cheque &amp; CTS clearing, ECS, Internet &amp;
                      Mobile Banking, ATM cards, NEFT/RTGS, and online SOPs.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => onOpenPdf({ part: 2, page: 1 })}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#C8102E] hover:bg-[#A00D24] text-white text-xs font-medium transition-colors cursor-pointer whitespace-nowrap"
                    >
                      <BookOpen className="w-3.5 h-3.5" />
                      Open Viewer
                    </button>
                    <a
                      href="/manuals/POSB_CBS_Manual_2026_Part_2.pdf"
                      download="POSB_CBS_Manual_2026_Part_2.pdf"
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-stone-200 dark:border-stone-700 text-xs font-medium text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors whitespace-nowrap"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Download PDF
                    </a>
                    <button
                      type="button"
                      onClick={() => void handleWhatsAppManualShare(2)}
                      disabled={sharingKey === 'manual-2'}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#15803D] hover:bg-[#166534] text-white text-xs font-medium transition-colors cursor-pointer whitespace-nowrap disabled:opacity-60"
                      title="Send Part II PDF via WhatsApp"
                    >
                      {sharingKey === 'manual-2' ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <WhatsAppIcon className="w-3.5 h-3.5" />
                      )}
                      WhatsApp
                    </button>
                    <a
                      href="/manuals/POSB_CBS_Manual_2026_Part_2.pdf"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center p-2 rounded-lg border border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
                      title="Open Part II PDF in new browser tab"
                      aria-label="Open Part II PDF in new tab"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                  {shareNotice?.key === 'manual-2' && (
                    <div className="text-[11px] text-emerald-700 dark:text-emerald-400">
                      {shareNotice.text}
                    </div>
                  )}
                </div>
              </div>

              {/* Suggested CBS Queries */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="font-display text-sm font-semibold text-stone-900 dark:text-stone-100">
                    Suggested CBS Queries
                  </h2>
                  <span className="text-xs text-stone-500 dark:text-stone-400">
                    Select any question to begin
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {SUGGESTED_CBS_QUERIES.map((item) => (
                    <button
                      key={item.question}
                      type="button"
                      onClick={() => onSendMessage(item.question)}
                      className="text-left p-3.5 rounded-xl bg-white dark:bg-[#1C1B19] border border-stone-200 dark:border-stone-800 hover:border-[#C8102E]/60 dark:hover:border-[#FFCD00]/60 transition-colors cursor-pointer group"
                    >
                      <div className="text-xs text-stone-500 dark:text-stone-400 mb-0.5">
                        {item.category}
                      </div>
                      <div className="text-sm font-medium text-stone-900 dark:text-stone-100 group-hover:text-[#C8102E] dark:group-hover:text-[#FFCD00] transition-colors">
                        {item.question}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Quick Finacle Menu Jump */}
              <div className="pt-1 border-t border-stone-200/80 dark:border-stone-800/80">
                <div className="flex flex-wrap items-center gap-2 text-xs text-stone-600 dark:text-stone-400">
                  <span className="font-medium text-stone-700 dark:text-stone-300">
                    Quick Menu Lookup:
                  </span>
                  {['CASBAO', 'CASBAV', 'CRDP', 'HCAAC', 'HCAACTD', 'CTM', 'HPBP', 'HACXFSOL'].map(
                    (code) => (
                      <button
                        key={code}
                        type="button"
                        onClick={() => onJumpToLookup(code)}
                        className="px-2 py-1 rounded-md font-mono text-xs font-medium bg-white dark:bg-[#1C1B19] border border-stone-200 dark:border-stone-700 text-stone-800 dark:text-stone-200 hover:border-[#C8102E] dark:hover:border-[#FFCD00] hover:text-[#C8102E] dark:hover:text-[#FFCD00] transition-colors cursor-pointer"
                      >
                        {code}
                      </button>
                    )
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-6 pb-4">
              {/* Conversation top action row */}
              <div className="flex items-center justify-between gap-2 pb-2 border-b border-stone-200/80 dark:border-stone-800/80">
                <span className="text-xs text-stone-500 dark:text-stone-400 tabular-nums">
                  {messages.filter((m) => m.role === 'user').length} question
                  {messages.filter((m) => m.role === 'user').length === 1 ? '' : 's'} in this
                  conversation · Follow-up context active
                </span>
                <button
                  type="button"
                  onClick={onClearConversation}
                  disabled={isGenerating}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs text-stone-500 hover:text-[#C8102E] dark:hover:text-[#FFCD00] hover:bg-stone-200/60 dark:hover:bg-stone-800 disabled:opacity-40 transition-colors cursor-pointer whitespace-nowrap"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Clear Conversation
                </button>
              </div>

              {/* Message thread */}
              {messages.map((msg, idx) => {
                if (msg.role === 'user') {
                  return (
                    <div key={msg.id} className="flex justify-end">
                      <div className="max-w-[88%] sm:max-w-[78%] rounded-2xl rounded-tr-sm bg-[#C8102E] text-white px-4 py-3 text-sm sm:text-[15px] leading-relaxed shadow-xs">
                        {msg.content}
                      </div>
                    </div>
                  );
                }

                const questionForExport = getPrecedingQuestion(idx);

                return (
                  <article
                    key={msg.id}
                    className="rounded-xl bg-white dark:bg-[#1C1B19] border border-stone-200 dark:border-stone-800 p-4 sm:p-6 space-y-4"
                  >
                    {/* Assistant header row with instant PDF / DOC / WhatsApp actions */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-stone-100 dark:border-stone-800/80">
                      <div className="text-xs font-semibold text-stone-800 dark:text-stone-200">
                        CBS Manual AI Assistant
                        <span className="font-normal text-stone-500 dark:text-stone-400">
                          {' '}
                          · POSB CBS Manual 2026
                        </span>
                      </div>

                      {msg.isStreaming ? (
                        <div className="inline-flex items-center gap-1.5 text-xs text-[#C8102E] dark:text-[#FFCD00]">
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Generating verified answer…</span>
                        </div>
                      ) : !msg.error && msg.content ? (
                        <div className="flex flex-wrap items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() =>
                              downloadAnswerAsPdf({
                                question: questionForExport,
                                answer: msg.content,
                                citations: msg.citations,
                                timestamp: msg.timestamp,
                              })
                            }
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-stone-300 dark:border-stone-700 bg-[#FAF7F2] dark:bg-stone-900 text-xs font-medium text-stone-800 dark:text-stone-200 hover:border-[#C8102E] dark:hover:border-[#FFCD00] hover:text-[#C8102E] dark:hover:text-[#FFCD00] transition-colors cursor-pointer whitespace-nowrap"
                            title="Download this answer as PDF"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>PDF</span>
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              downloadAnswerAsDoc({
                                question: questionForExport,
                                answer: msg.content,
                                citations: msg.citations,
                                timestamp: msg.timestamp,
                              })
                            }
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-stone-300 dark:border-stone-700 bg-[#FAF7F2] dark:bg-stone-900 text-xs font-medium text-stone-800 dark:text-stone-200 hover:border-[#C8102E] dark:hover:border-[#FFCD00] hover:text-[#C8102E] dark:hover:text-[#FFCD00] transition-colors cursor-pointer whitespace-nowrap"
                            title="Download this answer as Word DOC"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            <span>DOC</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => void handleWhatsAppAnswerShare(msg, questionForExport)}
                            disabled={sharingKey === msg.id}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-[#15803D] hover:bg-[#166534] text-white text-xs font-medium transition-colors cursor-pointer whitespace-nowrap disabled:opacity-60"
                            title="Send this answer PDF on WhatsApp"
                          >
                            {sharingKey === msg.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <WhatsAppIcon className="w-3.5 h-3.5" />
                            )}
                            <span>WhatsApp PDF</span>
                          </button>
                        </div>
                      ) : null}
                    </div>

                    {shareNotice?.key === msg.id && (
                      <div className="rounded-lg border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/70 dark:bg-emerald-950/30 px-3 py-2 text-xs text-emerald-800 dark:text-emerald-300">
                        {shareNotice.text}
                      </div>
                    )}

                    {/* Body or Error */}
                    {msg.error ? (
                      <div className="rounded-lg border border-red-200 dark:border-red-900/60 bg-red-50/70 dark:bg-red-950/30 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-start gap-2.5 text-sm text-red-800 dark:text-red-300">
                          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-[#C8102E] dark:text-red-400" />
                          <span>{msg.error}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => onRetryFailed(msg.id)}
                          disabled={isGenerating}
                          className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#C8102E] hover:bg-[#A00D24] text-white text-xs font-medium transition-colors cursor-pointer shrink-0 disabled:opacity-50"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          Retry
                        </button>
                      </div>
                    ) : msg.isStreaming && !msg.content ? (
                      <div className="flex items-center gap-2.5 py-3 text-sm text-stone-500 dark:text-stone-400">
                        <Loader2 className="w-4 h-4 animate-spin text-[#C8102E] dark:text-[#FFCD00]" />
                        <span>Searching all 748 pages of POSB CBS Manual 2026…</span>
                      </div>
                    ) : (
                      <MarkdownWithCitations
                        content={msg.content}
                        citations={msg.citations}
                        onOpenPdf={onOpenPdf}
                      />
                    )}

                    {/* Source References Cards */}
                    {!msg.error && msg.citations && msg.citations.length > 0 && (
                      <div className="pt-3 border-t border-stone-100 dark:border-stone-800/80 space-y-2.5">
                        <div className="flex items-center justify-between">
                          <h3 className="text-xs font-semibold text-stone-700 dark:text-stone-300">
                            Source Pages in POSB CBS Manual 2026 ({msg.citations.length})
                          </h3>
                          <span className="text-[11px] text-stone-500 dark:text-stone-400">
                            Click any page to view in PDF
                          </span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          {msg.citations.slice(0, 6).map((c) => {
                            const citKey = `${msg.id}-${c.id}`;
                            return (
                              <div
                                key={citKey}
                                className="rounded-lg border border-stone-200 dark:border-stone-800 bg-[#FAF7F2] dark:bg-[#23211E] p-3 flex flex-col justify-between gap-2"
                              >
                                <div className="min-w-0">
                                  <div className="flex items-center justify-between gap-2 text-xs">
                                    <span className="font-semibold text-[#C8102E] dark:text-[#FFCD00] whitespace-nowrap">
                                      CBS Manual {c.partLabel}
                                    </span>
                                    <span className="font-mono text-[11px] text-stone-600 dark:text-stone-400 tabular-nums whitespace-nowrap">
                                      Page {c.pdfPage}
                                    </span>
                                  </div>
                                  <div className="text-xs font-medium text-stone-900 dark:text-stone-100 truncate mt-0.5" title={c.chapter}>
                                    {c.chapter}
                                  </div>
                                  <p className="text-[11px] text-stone-600 dark:text-stone-400 line-clamp-2 mt-1 leading-relaxed">
                                    {c.excerpt}
                                  </p>
                                </div>

                                <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-stone-200/70 dark:border-stone-700/60">
                                  <div className="flex items-center gap-1.5">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        onOpenPdf({
                                          part: c.part,
                                          page: c.pdfPage,
                                          chapter: c.chapter,
                                          highlightTerms: c.matchedTerms,
                                          initialMode: 'pdf',
                                        })
                                      }
                                      className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-[#C8102E] hover:bg-[#A00D24] text-white text-[11px] font-medium transition-colors cursor-pointer whitespace-nowrap"
                                    >
                                      <BookOpen className="w-3 h-3" />
                                      Open PDF
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        onOpenPdf({
                                          part: c.part,
                                          page: c.pdfPage,
                                          chapter: c.chapter,
                                          highlightTerms: c.matchedTerms,
                                          initialMode: 'text',
                                        })
                                      }
                                      className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-stone-300 dark:border-stone-700 text-[11px] font-medium text-stone-700 dark:text-stone-300 hover:bg-stone-200/60 dark:hover:bg-stone-800 transition-colors cursor-pointer whitespace-nowrap"
                                    >
                                      <FileText className="w-3 h-3" />
                                      Preview
                                    </button>
                                  </div>

                                  <button
                                    type="button"
                                    onClick={() => handleCopySingleCitation(citKey, c)}
                                    className="inline-flex items-center gap-1 text-[11px] text-stone-500 hover:text-stone-900 dark:hover:text-stone-200 transition-colors cursor-pointer whitespace-nowrap"
                                    title="Copy citation"
                                  >
                                    {copiedCitationKey === citKey ? (
                                      <>
                                        <Check className="w-3 h-3 text-emerald-600" />
                                        Copied
                                      </>
                                    ) : (
                                      <>
                                        <Copy className="w-3 h-3" />
                                        Cite
                                      </>
                                    )}
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Answer action toolbar */}
                    {!msg.isStreaming && !msg.error && msg.content && (
                      <div className="pt-3 border-t border-stone-100 dark:border-stone-800/80 space-y-2">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() =>
                              downloadAnswerAsPdf({
                                question: questionForExport,
                                answer: msg.content,
                                citations: msg.citations,
                                timestamp: msg.timestamp,
                              })
                            }
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-stone-300 dark:border-stone-700 bg-[#FAF7F2] dark:bg-stone-900 text-xs font-medium text-stone-800 dark:text-stone-200 hover:border-[#C8102E] dark:hover:border-[#FFCD00] hover:text-[#C8102E] dark:hover:text-[#FFCD00] transition-colors cursor-pointer whitespace-nowrap"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>Download PDF</span>
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              downloadAnswerAsDoc({
                                question: questionForExport,
                                answer: msg.content,
                                citations: msg.citations,
                                timestamp: msg.timestamp,
                              })
                            }
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-stone-300 dark:border-stone-700 bg-[#FAF7F2] dark:bg-stone-900 text-xs font-medium text-stone-800 dark:text-stone-200 hover:border-[#C8102E] dark:hover:border-[#FFCD00] hover:text-[#C8102E] dark:hover:text-[#FFCD00] transition-colors cursor-pointer whitespace-nowrap"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            <span>Download DOC</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => void handleWhatsAppAnswerShare(msg, questionForExport)}
                            disabled={sharingKey === msg.id}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#15803D] hover:bg-[#166534] text-white text-xs font-medium transition-colors cursor-pointer whitespace-nowrap disabled:opacity-60"
                            title="Send this answer as a PDF via WhatsApp"
                          >
                            {sharingKey === msg.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <WhatsAppIcon className="w-3.5 h-3.5" />
                            )}
                            <span>WhatsApp PDF</span>
                          </button>

                          <div className="h-4 w-px bg-stone-200 dark:bg-stone-800 mx-0.5 hidden sm:block" />

                          <button
                            type="button"
                            onClick={() => handleCopyText(msg.id, msg.content)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800 hover:text-stone-900 dark:hover:text-stone-100 transition-colors cursor-pointer whitespace-nowrap"
                          >
                            {copiedId === msg.id ? (
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                            <span>{copiedId === msg.id ? 'Copied' : 'Copy'}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => onRegenerate(msg.id)}
                            disabled={isGenerating}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800 hover:text-stone-900 dark:hover:text-stone-100 disabled:opacity-40 transition-colors cursor-pointer whitespace-nowrap"
                          >
                            <RefreshCw className="w-3.5 h-3.5" />
                            <span>Regenerate</span>
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              printAnswerContent({
                                question: questionForExport,
                                answer: msg.content,
                                citations: msg.citations,
                              })
                            }
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800 hover:text-stone-900 dark:hover:text-stone-100 transition-colors cursor-pointer whitespace-nowrap"
                          >
                            <Printer className="w-3.5 h-3.5" />
                            <span>Print</span>
                          </button>
                        </div>

                        {shareNotice?.key === msg.id && (
                          <div className="text-xs text-emerald-700 dark:text-emerald-400">
                            {shareNotice.text}
                          </div>
                        )}
                      </div>
                    )}
                  </article>
                );
              })}

              <div ref={bottomRef} />
            </div>
          )}
        </div>
      </div>

      {/* Fixed bottom input area (mobile keyboard & safe-area friendly) */}
      <div className="shrink-0 border-t border-stone-200 dark:border-stone-800 bg-white dark:bg-[#191816] px-3 sm:px-6 pt-2.5 pb-safe no-print">
        <div className="max-w-4xl mx-auto space-y-2">
          {/* Manual Part Filter bar */}
          <div className="flex items-center justify-between gap-2">
            <div
              className="inline-flex items-center p-0.5 rounded-lg bg-stone-100 dark:bg-stone-900 border border-stone-200 dark:border-stone-800"
              role="group"
              aria-label="Filter manual part"
            >
              {(
                [
                  { value: 'all', label: 'Both Parts' },
                  { value: '1', label: 'Part I' },
                  { value: '2', label: 'Part II' },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => onChangePartFilter(opt.value)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                    partFilter === opt.value
                      ? 'bg-white dark:bg-stone-800 text-[#C8102E] dark:text-[#FFCD00] shadow-xs'
                      : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <span className="hidden sm:inline text-[11px] text-stone-500 dark:text-stone-400">
              Answers strictly grounded in POSB CBS Manual 2026
            </span>
          </div>

          {/* Composer form */}
          <form
            onSubmit={handleSubmit}
            className="flex items-end gap-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-[#FAF7F2] dark:bg-[#22201D] px-3 py-2 focus-within:border-[#C8102E] dark:focus-within:border-[#FFCD00] transition-colors"
          >
            <textarea
              ref={textareaRef}
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about CBS procedures, Finacle menus (e.g. CASBAO, HCAAC), forms, or rules…"
              aria-label="Ask a question about POSB CBS Manual 2026"
              className="flex-1 resize-none bg-transparent text-sm sm:text-[15px] text-stone-900 dark:text-stone-100 placeholder:text-stone-400 dark:placeholder:text-stone-500 focus:outline-none py-1 max-h-36"
            />
            <button
              type="submit"
              disabled={!input.trim() || isGenerating}
              className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-[#C8102E] hover:bg-[#A00D24] disabled:bg-stone-300 dark:disabled:bg-stone-700 text-white transition-colors shrink-0 cursor-pointer disabled:cursor-not-allowed"
              aria-label="Send question"
            >
              {isGenerating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <ArrowUp className="w-4 h-4" />
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
