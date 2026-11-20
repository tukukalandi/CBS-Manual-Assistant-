import React, { useCallback, useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import {
  AlertCircle,
  BookOpen,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  ExternalLink,
  FileText,
  Loader2,
  RefreshCw,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { WhatsAppIcon } from './WhatsAppIcon';
import { downloadManualPageAsDoc, shareManualPdfViaWhatsApp } from '../utils/exportPdf';
import type { ManualPage, PdfViewerRequest } from '../types';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

interface PdfViewerModalProps {
  request: PdfViewerRequest | null;
  onClose: () => void;
  onNavigate: (next: PdfViewerRequest) => void;
}

const PART_CONFIG: Record<1 | 2, { title: string; label: string; totalPages: number; url: string }> = {
  1: {
    title: 'POSB CBS Manual 2026 – Part I',
    label: 'Part I',
    totalPages: 389,
    url: '/manuals/POSB_CBS_Manual_2026_Part_1.pdf',
  },
  2: {
    title: 'POSB CBS Manual 2026 – Part II',
    label: 'Part II',
    totalPages: 359,
    url: '/manuals/POSB_CBS_Manual_2026_Part_2.pdf',
  },
};

export function PdfViewerModal({ request, onClose, onNavigate }: PdfViewerModalProps) {
  const [viewMode, setViewMode] = useState<'pdf' | 'text'>('pdf');
  const [zoom, setZoom] = useState<number>(1.15);
  const [pageInput, setPageInput] = useState<string>('1');
  const [pdfLoading, setPdfLoading] = useState<boolean>(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [totalPages, setTotalPages] = useState<number>(389);
  const [highlightCount, setHighlightCount] = useState<number>(0);
  const [copiedCitation, setCopiedCitation] = useState<boolean>(false);
  const [sharingPdf, setSharingPdf] = useState<boolean>(false);

  const [pageRecord, setPageRecord] = useState<(ManualPage & { pdfUrl?: string }) | null>(null);
  const [textLoading, setTextLoading] = useState<boolean>(false);
  const [textError, setTextError] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const highlightCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const pdfDocCacheRef = useRef<Map<1 | 2, pdfjsLib.PDFDocumentProxy>>(new Map());
  const renderTaskRef = useRef<pdfjsLib.RenderTask | null>(null);

  const part = request?.part ?? 1;
  const partMeta = PART_CONFIG[part];
  const clampedPage = request ? Math.max(1, Math.min(request.page, partMeta.totalPages)) : 1;

  useEffect(() => {
    if (!request) return;
    setViewMode(request.initialMode || 'pdf');
    setPageInput(String(Math.max(1, Math.min(request.page, PART_CONFIG[request.part].totalPages))));
    setTotalPages(PART_CONFIG[request.part].totalPages);
  }, [request]);

  // Close on Escape key
  useEffect(() => {
    if (!request) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [request, onClose]);

  // Load indexed page text preview metadata
  useEffect(() => {
    if (!request) return;
    let cancelled = false;
    setTextLoading(true);
    setTextError(null);

    fetch(`/api/page?part=${part}&page=${clampedPage}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Unable to load page preview.');
        return data;
      })
      .then((data) => {
        if (!cancelled) setPageRecord(data);
      })
      .catch((err) => {
        if (!cancelled) {
          setTextError(err instanceof Error ? err.message : 'Unable to load page preview.');
          setPageRecord(null);
        }
      })
      .finally(() => {
        if (!cancelled) setTextLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [request, part, clampedPage]);

  const renderPdfPage = useCallback(async () => {
    if (!request || viewMode !== 'pdf') return;
    setPdfLoading(true);
    setPdfError(null);
    setHighlightCount(0);

    try {
      let pdfDoc = pdfDocCacheRef.current.get(part);
      if (!pdfDoc) {
        const loadingTask = pdfjsLib.getDocument({
          url: partMeta.url,
          rangeChunkSize: 65536,
          disableAutoFetch: false,
        });
        pdfDoc = await loadingTask.promise;
        pdfDocCacheRef.current.set(part, pdfDoc);
      }

      setTotalPages(pdfDoc.numPages);
      const safePage = Math.max(1, Math.min(clampedPage, pdfDoc.numPages));
      const page = await pdfDoc.getPage(safePage);

      const containerWidth = containerRef.current
        ? Math.max(280, containerRef.current.clientWidth - 32)
        : 760;

      const baseViewport = page.getViewport({ scale: 1 });
      const fitScale = Math.min(1.6, containerWidth / baseViewport.width);
      const effectiveScale = Math.max(0.55, Math.min(2.6, fitScale * zoom));
      const dpr = Math.min(window.devicePixelRatio || 1, 2);

      const viewport = page.getViewport({ scale: effectiveScale });
      const canvas = canvasRef.current;
      const hlCanvas = highlightCanvasRef.current;
      if (!canvas || !hlCanvas) return;

      if (renderTaskRef.current) {
        try {
          renderTaskRef.current.cancel();
        } catch {
          // ignore
        }
      }

      canvas.width = Math.floor(viewport.width * dpr);
      canvas.height = Math.floor(viewport.height * dpr);
      canvas.style.width = `${Math.floor(viewport.width)}px`;
      canvas.style.height = `${Math.floor(viewport.height)}px`;

      hlCanvas.width = canvas.width;
      hlCanvas.height = canvas.height;
      hlCanvas.style.width = canvas.style.width;
      hlCanvas.style.height = canvas.style.height;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const renderTask = page.render({
        canvasContext: ctx,
        viewport,
        canvas,
      });
      renderTaskRef.current = renderTask;
      await renderTask.promise;

      // Draw visual highlights over matching search/citation terms
      const hlCtx = hlCanvas.getContext('2d');
      if (hlCtx) {
        hlCtx.clearRect(0, 0, hlCanvas.width, hlCanvas.height);
        const terms = (request.highlightTerms || [])
          .map((t) => t.trim().toLowerCase())
          .filter((t) => t.length >= 2);

        if (terms.length > 0) {
          const textContent = await page.getTextContent();
          hlCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
          let matches = 0;

          for (const rawItem of textContent.items) {
            if (!('str' in rawItem) || !rawItem.str) continue;
            const itemLower = rawItem.str.toLowerCase();
            const isMatch = terms.some((term) => itemLower.includes(term));
            if (!isMatch) continue;

            const tx = pdfjsLib.Util.transform(viewport.transform, rawItem.transform);
            const fontHeight = Math.hypot(tx[2], tx[3]) || 12;
            const width = (rawItem.width || 0) * effectiveScale;
            const x = tx[4];
            const y = tx[5] - fontHeight * 0.85;

            if (width > 1 && fontHeight > 1) {
              hlCtx.fillStyle = 'rgba(255, 205, 0, 0.42)';
              hlCtx.strokeStyle = 'rgba(200, 16, 46, 0.55)';
              hlCtx.lineWidth = 1;
              hlCtx.fillRect(x - 2, y - 1, width + 4, fontHeight + 3);
              hlCtx.strokeRect(x - 2, y - 1, width + 4, fontHeight + 3);
              matches++;
            }
          }
          setHighlightCount(matches);
        }
      }
    } catch (err) {
      if ((err as { name?: string })?.name === 'RenderingCancelledException') return;
      console.error('PDF rendering error:', err);
      setPdfError(
        'Could not render this PDF page in the inline viewer. You can open the complete PDF in a new tab or switch to Text Preview.'
      );
    } finally {
      setPdfLoading(false);
    }
  }, [request, viewMode, part, partMeta.url, clampedPage, zoom]);

  useEffect(() => {
    void renderPdfPage();
  }, [renderPdfPage]);

  if (!request) return null;

  const currentChapter = pageRecord?.chapter || request.chapter || partMeta.title;
  const citationString = `CBS Manual ${partMeta.label} – ${currentChapter}, Page ${clampedPage}`;

  const goToPage = (target: number) => {
    const safe = Math.max(1, Math.min(target, totalPages));
    setPageInput(String(safe));
    onNavigate({
      ...request,
      page: safe,
      highlightTerms: safe === request.page ? request.highlightTerms : [],
    });
  };

  const handleJumpSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseInt(pageInput, 10);
    if (Number.isFinite(parsed)) {
      goToPage(parsed);
    }
  };

  const handleCopyCitation = async () => {
    try {
      await navigator.clipboard.writeText(citationString);
      setCopiedCitation(true);
      setTimeout(() => setCopiedCitation(false), 1800);
    } catch {
      // ignore clipboard restriction
    }
  };

  const handleDownloadPageDoc = () => {
    downloadManualPageAsDoc({
      part,
      page: clampedPage,
      chapter: currentChapter,
      printedPage: pageRecord?.printedPage,
      text: pageRecord?.text || 'No extractable text on this page.',
      menus: pageRecord?.menus,
      forms: pageRecord?.forms,
    });
  };

  const handleShareWhatsApp = async () => {
    if (sharingPdf) return;
    setSharingPdf(true);
    try {
      await shareManualPdfViaWhatsApp({
        part,
        page: clampedPage,
        chapter: currentChapter,
      });
    } finally {
      setSharingPdf(false);
    }
  };

  const highlightTextPreview = (text: string) => {
    const terms = (request.highlightTerms || []).filter((t) => t.trim().length >= 2);
    if (!terms.length) return text;
    const escaped = terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    const re = new RegExp(`(${escaped.join('|')})`, 'gi');
    const parts = text.split(re);
    return parts.map((segment, i) =>
      re.test(segment) ? (
        <mark
          key={i}
          className="bg-[#FFCD00]/60 dark:bg-[#FFCD00]/35 text-stone-950 dark:text-stone-100 px-0.5 rounded-xs"
        >
          {segment}
        </mark>
      ) : (
        <React.Fragment key={i}>{segment}</React.Fragment>
      )
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-stone-950/60 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-label={`${partMeta.title}, Page ${clampedPage}`}
      onClick={onClose}
    >
      <div
        className="relative flex flex-col w-full max-w-4xl h-full bg-white dark:bg-[#181715] text-stone-900 dark:text-stone-100 border-l border-stone-200 dark:border-stone-800 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top bar */}
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-stone-200 dark:border-stone-800 bg-[#FAF7F2] dark:bg-[#1E1C1A]">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs text-stone-500 dark:text-stone-400">
              <span className="font-semibold text-[#C8102E] dark:text-[#FFCD00]">{partMeta.label}</span>
              <span aria-hidden="true">·</span>
              <span className="tabular-nums">PDF Page {clampedPage} of {totalPages}</span>
              {pageRecord?.printedPage && pageRecord.printedPage !== String(clampedPage) && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="tabular-nums">Printed p. {pageRecord.printedPage}</span>
                </>
              )}
            </div>
            <h2 className="text-sm sm:text-base font-semibold truncate text-stone-900 dark:text-stone-100 mt-0.5">
              {currentChapter}
            </h2>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <a
              href={partMeta.url}
              download={`POSB_CBS_Manual_2026_Part_${part}.pdf`}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors whitespace-nowrap"
              title={`Download ${partMeta.title} PDF`}
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden md:inline">PDF</span>
            </a>

            <button
              type="button"
              onClick={handleDownloadPageDoc}
              disabled={!pageRecord}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 hover:bg-stone-100 dark:hover:bg-stone-800 disabled:opacity-50 transition-colors whitespace-nowrap cursor-pointer"
              title="Download this page as a Word DOC file"
            >
              <FileText className="w-3.5 h-3.5" />
              <span className="hidden md:inline">DOC</span>
            </button>

            <button
              type="button"
              onClick={() => void handleShareWhatsApp()}
              disabled={sharingPdf}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md bg-[#15803D] hover:bg-[#166534] text-white transition-colors whitespace-nowrap cursor-pointer disabled:opacity-60"
              title="Send PDF via WhatsApp"
            >
              {sharingPdf ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <WhatsAppIcon className="w-3.5 h-3.5" />
              )}
              <span className="hidden sm:inline">WhatsApp</span>
            </button>

            <button
              type="button"
              onClick={handleCopyCitation}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors whitespace-nowrap cursor-pointer"
              title="Copy citation"
            >
              {copiedCitation ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span className="hidden lg:inline">{copiedCitation ? 'Copied' : 'Cite'}</span>
            </button>

            <a
              href={`${partMeta.url}#page=${clampedPage}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md bg-[#C8102E] text-white hover:bg-[#A00D24] transition-colors whitespace-nowrap"
              title="Open complete PDF in new browser tab"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span className="hidden lg:inline">Full PDF</span>
            </a>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-md text-stone-500 hover:text-stone-900 dark:hover:text-stone-100 hover:bg-stone-200/70 dark:hover:bg-stone-800 transition-colors cursor-pointer"
              aria-label="Close PDF viewer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Control toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 border-b border-stone-200 dark:border-stone-800 bg-white dark:bg-[#181715]">
          {/* Left: View mode + Part switcher */}
          <div className="flex items-center gap-2">
            <div className="inline-flex p-0.5 rounded-lg bg-stone-100 dark:bg-stone-900 border border-stone-200 dark:border-stone-800">
              <button
                type="button"
                onClick={() => setViewMode('pdf')}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  viewMode === 'pdf'
                    ? 'bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 shadow-xs'
                    : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
                }`}
              >
                <BookOpen className="w-3.5 h-3.5" />
                PDF View
              </button>
              <button
                type="button"
                onClick={() => setViewMode('text')}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  viewMode === 'text'
                    ? 'bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 shadow-xs'
                    : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                Text Preview
              </button>
            </div>

            <div className="hidden sm:inline-flex p-0.5 rounded-lg bg-stone-100 dark:bg-stone-900 border border-stone-200 dark:border-stone-800">
              <button
                type="button"
                onClick={() => onNavigate({ part: 1, page: 1 })}
                className={`px-2 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  part === 1
                    ? 'bg-[#C8102E] text-white'
                    : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
                }`}
              >
                Part I
              </button>
              <button
                type="button"
                onClick={() => onNavigate({ part: 2, page: 1 })}
                className={`px-2 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  part === 2
                    ? 'bg-[#C8102E] text-white'
                    : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
                }`}
              >
                Part II
              </button>
            </div>
          </div>

          {/* Right: Page navigation & zoom */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => goToPage(clampedPage - 1)}
              disabled={clampedPage <= 1}
              className="p-1.5 rounded-md border border-stone-200 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-800 disabled:opacity-40 transition-colors"
              aria-label="Previous page"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <form onSubmit={handleJumpSubmit} className="inline-flex items-center gap-1 text-xs">
              <span className="text-stone-500 dark:text-stone-400 hidden sm:inline">Page</span>
              <input
                type="number"
                min={1}
                max={totalPages}
                value={pageInput}
                onChange={(e) => setPageInput(e.target.value)}
                onBlur={() => {
                  const n = parseInt(pageInput, 10);
                  if (Number.isFinite(n) && n !== clampedPage) goToPage(n);
                  else setPageInput(String(clampedPage));
                }}
                aria-label="Go to PDF page number"
                className="w-14 px-2 py-1 text-center font-mono tabular-nums rounded-md border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 focus:outline-none focus:ring-2 focus:ring-[#C8102E]/40"
              />
              <span className="text-stone-500 dark:text-stone-400 font-mono tabular-nums">/ {totalPages}</span>
            </form>

            <button
              type="button"
              onClick={() => goToPage(clampedPage + 1)}
              disabled={clampedPage >= totalPages}
              className="p-1.5 rounded-md border border-stone-200 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-800 disabled:opacity-40 transition-colors"
              aria-label="Next page"
            >
              <ChevronRight className="w-4 h-4" />
            </button>

            {viewMode === 'pdf' && (
              <div className="hidden sm:flex items-center gap-1 ml-2 pl-2 border-l border-stone-200 dark:border-stone-800">
                <button
                  type="button"
                  onClick={() => setZoom((z) => Math.max(0.7, Number((z - 0.15).toFixed(2))))}
                  className="p-1.5 rounded-md border border-stone-200 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
                  aria-label="Zoom out"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <span className="text-xs font-mono tabular-nums w-11 text-center text-stone-600 dark:text-stone-400">
                  {Math.round(zoom * 100)}%
                </span>
                <button
                  type="button"
                  onClick={() => setZoom((z) => Math.min(2.2, Number((z + 0.15).toFixed(2))))}
                  className="p-1.5 rounded-md border border-stone-200 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
                  aria-label="Zoom in"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Highlight notice strip if matches highlighted */}
        {viewMode === 'pdf' && highlightCount > 0 && (
          <div className="px-4 py-1.5 text-xs bg-[#FFCD00]/20 dark:bg-[#FFCD00]/10 border-b border-[#FFCD00]/40 text-stone-800 dark:text-stone-200">
            Highlighted {highlightCount} relevant reference match{highlightCount === 1 ? '' : 'es'} on Page {clampedPage}.
          </div>
        )}

        {/* Main Viewport */}
        <div
          ref={containerRef}
          className="flex-1 overflow-auto bg-stone-100 dark:bg-[#121110] p-4 flex flex-col items-center"
        >
          {viewMode === 'pdf' ? (
            <>
              {pdfError ? (
                <div className="max-w-md w-full my-10 p-6 rounded-xl bg-white dark:bg-[#1E1C1A] border border-stone-200 dark:border-stone-800 text-center">
                  <AlertCircle className="w-8 h-8 text-[#C8102E] mx-auto mb-3" />
                  <p className="text-sm text-stone-700 dark:text-stone-300 mb-4">{pdfError}</p>
                  <div className="flex flex-wrap justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => void renderPdfPage()}
                      className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-stone-300 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-800"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      Retry Render
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewMode('text')}
                      className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      View Text Preview
                    </button>
                    <a
                      href={`${partMeta.url}#page=${clampedPage}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg bg-[#C8102E] text-white"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      Open Full PDF
                    </a>
                  </div>
                </div>
              ) : (
                <div className="relative bg-white shadow-md rounded-sm overflow-hidden">
                  {pdfLoading && (
                    <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/80 dark:bg-stone-950/70">
                      <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 text-xs font-medium text-stone-700 dark:text-stone-200 shadow-sm">
                        <Loader2 className="w-4 h-4 animate-spin text-[#C8102E]" />
                        Loading {partMeta.label}, Page {clampedPage}…
                      </div>
                    </div>
                  )}
                  <canvas ref={canvasRef} className="block" />
                  <canvas
                    ref={highlightCanvasRef}
                    className="pointer-events-none absolute inset-0"
                  />
                </div>
              )}
            </>
          ) : (
            <div className="max-w-3xl w-full bg-white dark:bg-[#1C1B19] border border-stone-200 dark:border-stone-800 rounded-xl p-5 sm:p-6">
              {textLoading ? (
                <div className="flex items-center gap-2 text-sm text-stone-500 py-8 justify-center">
                  <Loader2 className="w-4 h-4 animate-spin text-[#C8102E]" />
                  Loading indexed page text…
                </div>
              ) : textError ? (
                <div className="text-sm text-[#C8102E] dark:text-red-400 py-4">{textError}</div>
              ) : pageRecord ? (
                <div className="space-y-4">
                  <div className="pb-3 border-b border-stone-200 dark:border-stone-800">
                    <div className="text-xs text-stone-500 dark:text-stone-400">
                      {partMeta.title} · PDF Page {pageRecord.pdfPage}
                      {pageRecord.printedPage !== String(pageRecord.pdfPage)
                        ? ` · Printed Page ${pageRecord.printedPage}`
                        : ''}
                    </div>
                    <h3 className="text-base font-semibold mt-1 text-stone-900 dark:text-stone-100">
                      {pageRecord.chapter}
                    </h3>
                    {(pageRecord.menus.length > 0 || pageRecord.forms.length > 0) && (
                      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-stone-600 dark:text-stone-400">
                        {pageRecord.menus.length > 0 && (
                          <span>
                            <strong className="text-stone-800 dark:text-stone-200">Finacle Menus:</strong>{' '}
                            <span className="font-mono">{pageRecord.menus.join(', ')}</span>
                          </span>
                        )}
                        {pageRecord.forms.length > 0 && (
                          <span>
                            <strong className="text-stone-800 dark:text-stone-200">Forms:</strong>{' '}
                            <span className="font-mono">{pageRecord.forms.join(', ')}</span>
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-stone-800 dark:text-stone-200">
                    {highlightTextPreview(pageRecord.text || 'No extractable text on this page.')}
                  </pre>
                </div>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
