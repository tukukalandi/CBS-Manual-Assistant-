export type ManualPartFilter = 'all' | '1' | '2';

export interface ManualInfo {
  part: 1 | 2;
  partLabel: 'Part I' | 'Part II';
  title: string;
  totalPages: number;
  publicUrl: string;
  fileName: string;
}

export interface ChapterEntry {
  part: 1 | 2;
  partLabel: 'Part I' | 'Part II';
  chapter: string;
  startPage: number;
  endPage: number;
}

export interface MenuFrequency {
  code: string;
  count: number;
}

export interface ManualPage {
  id: string;
  part: 1 | 2;
  partLabel: 'Part I' | 'Part II';
  pdfPage: number;
  printedPage: string;
  chapter: string;
  headings: string[];
  menus: string[];
  rules: string[];
  forms: string[];
  text: string;
}

export interface ManualMeta {
  generatedAt: string;
  manuals: ManualInfo[];
  totalPages: number;
  topMenuCodes: MenuFrequency[];
  chapters: ChapterEntry[];
}

export interface ManualIndexFile {
  meta: ManualMeta;
  pages: ManualPage[];
}

export interface CitationRef {
  id: string;
  part: 1 | 2;
  partLabel: 'Part I' | 'Part II';
  pdfPage: number;
  printedPage: string;
  chapter: string;
  excerpt: string;
  matchedTerms: string[];
  menus: string[];
  forms: string[];
  score: number;
  pdfUrl: string;
}

export interface LookupResult {
  id: string;
  part: 1 | 2;
  partLabel: 'Part I' | 'Part II';
  pdfPage: number;
  printedPage: string;
  chapter: string;
  headings: string[];
  snippet: string;
  matchedTerms: string[];
  menus: string[];
  rules: string[];
  forms: string[];
  score: number;
  pdfUrl: string;
}

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  citations?: CitationRef[];
  timestamp: number;
  isStreaming?: boolean;
  error?: string;
  failedQuery?: string;
  cached?: boolean;
  partFilter?: ManualPartFilter;
}

export interface ChatSession {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: ChatMessage[];
}
