export type {
  ManualPartFilter,
  ManualInfo,
  ChapterEntry,
  MenuFrequency,
  ManualPage,
  ManualMeta,
  CitationRef,
  LookupResult,
  ChatTurn,
  ChatMessage,
  ChatSession,
} from '../lib/types';

export type WorkspaceTab = 'assistant' | 'lookup' | 'menus';

export interface PdfViewerRequest {
  part: 1 | 2;
  page: number;
  chapter?: string;
  highlightTerms?: string[];
  initialMode?: 'pdf' | 'text';
}
