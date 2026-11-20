import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { BookOpen } from 'lucide-react';
import type { CitationRef, PdfViewerRequest } from '../types';

interface MarkdownWithCitationsProps {
  content: string;
  citations?: CitationRef[];
  onOpenPdf: (req: PdfViewerRequest) => void;
}

// Matches references like:
// "CBS Manual Part I – Chapter 5, Page 78"
// "CBS Manual Part II - Appendix IV, Page 24"
// "Part I, Page 97"
const CITATION_REGEX =
  /(?:POSB\s+)?(?:CBS\s+Manual\s+)?Part\s+(I{1,2}|1|2)(?:\s*[–\-:,]\s*[^,\n\r()\]]{1,90})?,?\s*(?:PDF\s+)?Page\s*(?:No\.?\s*)?(\d{1,3})/gi;

function parsePart(raw: string): 1 | 2 {
  const up = raw.trim().toUpperCase();
  return up === 'II' || up === '2' ? 2 : 1;
}

export function MarkdownWithCitations({
  content,
  citations = [],
  onOpenPdf,
}: MarkdownWithCitationsProps) {
  const renderTextWithLinks = (text: string): React.ReactNode => {
    const matches = Array.from(text.matchAll(CITATION_REGEX));
    if (matches.length === 0) return text;

    const nodes: React.ReactNode[] = [];
    let lastIndex = 0;

    matches.forEach((m, idx) => {
      const fullMatch = m[0];
      const matchStart = m.index ?? 0;
      if (matchStart > lastIndex) {
        nodes.push(text.slice(lastIndex, matchStart));
      }

      const part = parsePart(m[1]);
      const page = parseInt(m[2], 10);
      const matchedCitation = citations.find((c) => c.part === part && c.pdfPage === page);

      nodes.push(
        <button
          key={`cit-${idx}-${part}-${page}`}
          type="button"
          onClick={() =>
            onOpenPdf({
              part,
              page,
              chapter: matchedCitation?.chapter,
              highlightTerms: matchedCitation?.matchedTerms,
            })
          }
          className="inline-flex items-center gap-1 text-left font-medium text-[#C8102E] dark:text-[#FFCD00] underline decoration-[#C8102E]/40 dark:decoration-[#FFCD00]/40 underline-offset-2 hover:decoration-[#C8102E] dark:hover:decoration-[#FFCD00] cursor-pointer transition-colors"
          title={`Open POSB CBS Manual 2026 Part ${part === 1 ? 'I' : 'II'}, PDF Page ${page}`}
        >
          <BookOpen className="w-3.5 h-3.5 inline shrink-0" />
          <span>{fullMatch}</span>
        </button>
      );

      lastIndex = matchStart + fullMatch.length;
    });

    if (lastIndex < text.length) {
      nodes.push(text.slice(lastIndex));
    }

    return nodes;
  };

  const processChildren = (children: React.ReactNode): React.ReactNode => {
    return React.Children.map(children, (child) => {
      if (typeof child === 'string') {
        return renderTextWithLinks(child);
      }
      return child;
    });
  };

  return (
    <div className="cbs-prose">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => <p>{processChildren(children)}</p>,
          li: ({ children }) => <li>{processChildren(children)}</li>,
          strong: ({ children }) => <strong>{processChildren(children)}</strong>,
          td: ({ children }) => <td>{processChildren(children)}</td>,
          th: ({ children }) => <th>{processChildren(children)}</th>,
          table: ({ children }) => (
            <div className="w-full overflow-x-auto my-3 rounded-lg border border-stone-200 dark:border-stone-800">
              <table className="!my-0">{children}</table>
            </div>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
