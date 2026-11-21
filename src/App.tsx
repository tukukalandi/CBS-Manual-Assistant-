import { useCallback, useEffect, useRef, useState } from 'react';
import { BookOpen, Menu, Plus } from 'lucide-react';
import { Sidebar } from './components/Sidebar';
import { ChatWorkspace } from './components/ChatWorkspace';
import { ManualLookupView } from './components/ManualLookupView';
import { FinacleMenuDirectory } from './components/FinacleMenuDirectory';
import { PdfViewerModal } from './components/PdfViewerModal';
import { IndiaPostLogo } from './components/IndiaPostLogo';
import type {
  ChatMessage,
  ChatSession,
  ChatTurn,
  CitationRef,
  ManualMeta,
  ManualPartFilter,
  PdfViewerRequest,
  WorkspaceTab,
} from './types';

const STORAGE_KEYS = {
  sessions: 'cbs_manual_sessions_v1',
  recentQuestions: 'cbs_manual_recent_questions_v1',
  searchHistory: 'cbs_manual_search_history_v1',
  theme: 'cbs_manual_theme_v1',
};

function createEmptySession(): ChatSession {
  const now = Date.now();
  return {
    id: `sess_${now}_${Math.random().toString(36).slice(2, 7)}`,
    title: 'New Conversation',
    createdAt: now,
    updatedAt: now,
    messages: [],
  };
}

function loadJsonStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export default function App() {
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.theme);
      if (saved === 'dark') return true;
      if (saved === 'light') return false;
      return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
    } catch {
      return false;
    }
  });

  const [activeTab, setActiveTab] = useState<WorkspaceTab>('assistant');
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [manualMeta, setManualMeta] = useState<ManualMeta | null>(null);
  const [partFilter, setPartFilter] = useState<ManualPartFilter>('all');
  const [pdfRequest, setPdfRequest] = useState<PdfViewerRequest | null>(null);
  const [pendingLookupQuery, setPendingLookupQuery] = useState<string>('');

  const [sessions, setSessions] = useState<ChatSession[]>(() => {
    const saved = loadJsonStorage<ChatSession[]>(STORAGE_KEYS.sessions, []);
    if (saved.length > 0) {
      return saved.map((s) => ({
        ...s,
        messages: s.messages.map((m) => ({ ...m, isStreaming: false })),
      }));
    }
    return [createEmptySession()];
  });

  const [activeSessionId, setActiveSessionId] = useState<string>(() => {
    const saved = loadJsonStorage<ChatSession[]>(STORAGE_KEYS.sessions, []);
    return saved[0]?.id ?? '';
  });

  const [recentQuestions, setRecentQuestions] = useState<string[]>(() =>
    loadJsonStorage<string[]>(STORAGE_KEYS.recentQuestions, [])
  );

  const [searchHistory, setSearchHistory] = useState<string[]>(() =>
    loadJsonStorage<string[]>(STORAGE_KEYS.searchHistory, [])
  );

  const [isGenerating, setIsGenerating] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  // Ensure activeSessionId always points to a valid session
  useEffect(() => {
    if (!sessions.some((s) => s.id === activeSessionId)) {
      if (sessions.length > 0) {
        setActiveSessionId(sessions[0].id);
      } else {
        const fresh = createEmptySession();
        setSessions([fresh]);
        setActiveSessionId(fresh.id);
      }
    }
  }, [sessions, activeSessionId]);

  // Sync dark mode class on <html>
  useEffect(() => {
    const root = document.documentElement;
    if (darkMode) root.classList.add('dark');
    else root.classList.remove('dark');
    try {
      localStorage.setItem(STORAGE_KEYS.theme, darkMode ? 'dark' : 'light');
    } catch {
      // ignore
    }
  }, [darkMode]);

  // Persist sessions, recent questions, search history
  useEffect(() => {
    try {
      const toSave = sessions
        .slice(0, 20)
        .map((s) => ({
          ...s,
          messages: s.messages.map((m) => ({ ...m, isStreaming: false })),
        }));
      localStorage.setItem(STORAGE_KEYS.sessions, JSON.stringify(toSave));
    } catch {
      // ignore quota errors
    }
  }, [sessions]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.recentQuestions, JSON.stringify(recentQuestions.slice(0, 15)));
    } catch {
      // ignore
    }
  }, [recentQuestions]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.searchHistory, JSON.stringify(searchHistory.slice(0, 15)));
    } catch {
      // ignore
    }
  }, [searchHistory]);

  // Fetch indexed manual metadata on mount
  useEffect(() => {
    fetch('/api/meta')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && Array.isArray(data.manuals)) {
          setManualMeta(data as ManualMeta);
        }
      })
      .catch(() => {
        // Fallback counts already handled gracefully
      });
  }, []);

  const activeSession =
    sessions.find((s) => s.id === activeSessionId) || sessions[0] || createEmptySession();

  const updateSessionMessages = useCallback(
    (sessionId: string, updater: (prev: ChatMessage[]) => ChatMessage[], newTitle?: string) => {
      setSessions((prev) =>
        prev.map((s) => {
          if (s.id !== sessionId) return s;
          const nextMessages = updater(s.messages);
          return {
            ...s,
            title: newTitle ?? s.title,
            updatedAt: Date.now(),
            messages: nextMessages,
          };
        })
      );
    },
    []
  );

  const streamAnswer = useCallback(
    async (params: {
      sessionId: string;
      assistantMsgId: string;
      query: string;
      history: ChatTurn[];
      filter: ManualPartFilter;
      bypassCache?: boolean;
    }) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setIsGenerating(true);

      try {
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: params.query,
            history: params.history,
            partFilter: params.filter,
            bypassCache: Boolean(params.bypassCache),
          }),
          signal: controller.signal,
        });

        if (!response.ok) {
          let errMsg = 'Unable to reach the assistant service. Please click Retry.';
          try {
            const errJson = await response.json();
            if (errJson?.error) errMsg = errJson.error;
          } catch {
            // ignore
          }
          throw new Error(errMsg);
        }

        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error('Streaming connection unavailable. Please try again.');
        }

        const decoder = new TextDecoder();
        let buffer = '';
        let accumulated = '';
        let receivedCitations: CitationRef[] = [];

        const processEventBlock = (block: string) => {
          const lines = block.split('\n');
          let eventName = 'message';
          let dataStr = '';
          for (const line of lines) {
            if (line.startsWith('event:')) {
              eventName = line.slice(6).trim();
            } else if (line.startsWith('data:')) {
              dataStr += line.slice(5).trim();
            }
          }
          if (!dataStr) return;

          let parsed: Record<string, unknown>;
          try {
            parsed = JSON.parse(dataStr);
          } catch {
            return;
          }

          if (eventName === 'sources') {
            receivedCitations = Array.isArray(parsed.citations)
              ? (parsed.citations as CitationRef[])
              : [];
            updateSessionMessages(params.sessionId, (msgs) =>
              msgs.map((m) =>
                m.id === params.assistantMsgId ? { ...m, citations: receivedCitations } : m
              )
            );
          } else if (eventName === 'delta') {
            const piece = typeof parsed.text === 'string' ? parsed.text : '';
            if (piece) {
              accumulated += piece;
              updateSessionMessages(params.sessionId, (msgs) =>
                msgs.map((m) =>
                  m.id === params.assistantMsgId ? { ...m, content: accumulated } : m
                )
              );
            }
          } else if (eventName === 'error') {
            const msg =
              typeof parsed.message === 'string'
                ? parsed.message
                : 'An error occurred while generating the answer. Please click Retry.';
            updateSessionMessages(params.sessionId, (msgs) =>
              msgs.map((m) =>
                m.id === params.assistantMsgId
                  ? { ...m, isStreaming: false, error: msg, failedQuery: params.query }
                  : m
              )
            );
          } else if (eventName === 'done') {
            updateSessionMessages(params.sessionId, (msgs) =>
              msgs.map((m) =>
                m.id === params.assistantMsgId
                  ? {
                      ...m,
                      isStreaming: false,
                      cached: Boolean(parsed.cached),
                    }
                  : m
              )
            );
          }
        };

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const blocks = buffer.split('\n\n');
          buffer = blocks.pop() || '';
          for (const block of blocks) {
            if (block.trim()) processEventBlock(block);
          }
        }
        if (buffer.trim()) {
          processEventBlock(buffer);
        }

        // Ensure streaming flag is cleared when stream ends normally
        updateSessionMessages(params.sessionId, (msgs) =>
          msgs.map((m) =>
            m.id === params.assistantMsgId ? { ...m, isStreaming: false } : m
          )
        );
      } catch (err) {
        if ((err as { name?: string })?.name === 'AbortError') return;
        const message =
          err instanceof Error && err.message
            ? err.message
            : 'Network connection interrupted. Please check your connection and click Retry.';
        updateSessionMessages(params.sessionId, (msgs) =>
          msgs.map((m) =>
            m.id === params.assistantMsgId
              ? { ...m, isStreaming: false, error: message, failedQuery: params.query }
              : m
          )
        );
      } finally {
        setIsGenerating(false);
      }
    },
    [updateSessionMessages]
  );

  const handleSendMessage = useCallback(
    (rawQuery: string) => {
      const clean = rawQuery.trim();
      if (!clean || isGenerating) return;

      const sessionId = activeSession.id;
      const existingMessages = activeSession.messages;

      // Build clean prior history for follow-up continuity
      const history: ChatTurn[] = existingMessages
        .filter((m) => !m.error && m.content.trim().length > 0)
        .slice(-8)
        .map((m) => ({ role: m.role, content: m.content }));

      const userMsg: ChatMessage = {
        id: `u_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        role: 'user',
        content: clean,
        timestamp: Date.now(),
        partFilter,
      };

      const assistantMsgId = `a_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      const assistantPlaceholder: ChatMessage = {
        id: assistantMsgId,
        role: 'assistant',
        content: '',
        citations: [],
        timestamp: Date.now(),
        isStreaming: true,
        partFilter,
      };

      const nextTitle =
        existingMessages.length === 0
          ? clean.length > 52
            ? `${clean.slice(0, 52)}…`
            : clean
          : undefined;

      updateSessionMessages(
        sessionId,
        (prev) => [...prev, userMsg, assistantPlaceholder],
        nextTitle
      );

      setRecentQuestions((prev) => [clean, ...prev.filter((q) => q !== clean)].slice(0, 12));

      void streamAnswer({
        sessionId,
        assistantMsgId,
        query: clean,
        history,
        filter: partFilter,
        bypassCache: false,
      });
    },
    [activeSession, isGenerating, partFilter, streamAnswer, updateSessionMessages]
  );

  const handleRegenerateOrRetry = useCallback(
    (assistantMsgId: string, bypassCache: boolean) => {
      if (isGenerating) return;
      const sessionId = activeSession.id;
      const idx = activeSession.messages.findIndex((m) => m.id === assistantMsgId);
      if (idx === -1) return;

      // Find the corresponding user question just before this assistant message
      let userMsgIndex = -1;
      for (let i = idx - 1; i >= 0; i--) {
        if (activeSession.messages[i].role === 'user') {
          userMsgIndex = i;
          break;
        }
      }
      if (userMsgIndex === -1) return;

      const query = activeSession.messages[userMsgIndex].content;
      const history: ChatTurn[] = activeSession.messages
        .slice(0, userMsgIndex)
        .filter((m) => !m.error && m.content.trim().length > 0)
        .slice(-8)
        .map((m) => ({ role: m.role, content: m.content }));

      updateSessionMessages(sessionId, (msgs) =>
        msgs.map((m) =>
          m.id === assistantMsgId
            ? { ...m, content: '', error: undefined, isStreaming: true, citations: [] }
            : m
        )
      );

      void streamAnswer({
        sessionId,
        assistantMsgId,
        query,
        history,
        filter: partFilter,
        bypassCache,
      });
    },
    [activeSession, isGenerating, partFilter, streamAnswer, updateSessionMessages]
  );

  const handleNewChat = () => {
    abortRef.current?.abort();
    setIsGenerating(false);
    // Reuse current session if already empty
    if (activeSession.messages.length === 0) return;
    const fresh = createEmptySession();
    setSessions((prev) => [fresh, ...prev]);
    setActiveSessionId(fresh.id);
  };

  const handleClearConversation = () => {
    abortRef.current?.abort();
    setIsGenerating(false);
    updateSessionMessages(activeSession.id, () => [], 'New Conversation');
  };

  const handleDeleteSession = (id: string) => {
    setSessions((prev) => {
      const remaining = prev.filter((s) => s.id !== id);
      if (remaining.length === 0) {
        const fresh = createEmptySession();
        setActiveSessionId(fresh.id);
        return [fresh];
      }
      if (id === activeSessionId) {
        setActiveSessionId(remaining[0].id);
      }
      return remaining;
    });
  };

  const handleClearAllHistory = () => {
    abortRef.current?.abort();
    setIsGenerating(false);
    const fresh = createEmptySession();
    setSessions([fresh]);
    setActiveSessionId(fresh.id);
  };

  const handleRecordSearch = useCallback((term: string) => {
    setSearchHistory((prev) => [term, ...prev.filter((x) => x.toLowerCase() !== term.toLowerCase())].slice(0, 12));
  }, []);

  const handleJumpToLookup = (term: string) => {
    setPendingLookupQuery(term);
    setActiveTab('lookup');
  };

  const handleAskFromOtherTab = (question: string) => {
    setActiveTab('assistant');
    // Start a fresh conversation if current one already has messages, or ask in current
    if (activeSession.messages.length === 0) {
      handleSendMessage(question);
    } else {
      const fresh = createEmptySession();
      setSessions((prev) => [fresh, ...prev]);
      setActiveSessionId(fresh.id);
      // Defer slightly so active session state settles
      setTimeout(() => {
        const userMsg: ChatMessage = {
          id: `u_${Date.now()}`,
          role: 'user',
          content: question,
          timestamp: Date.now(),
          partFilter,
        };
        const assistantMsgId = `a_${Date.now()}`;
        const assistantPlaceholder: ChatMessage = {
          id: assistantMsgId,
          role: 'assistant',
          content: '',
          citations: [],
          timestamp: Date.now(),
          isStreaming: true,
          partFilter,
        };
        setSessions((prev) =>
          prev.map((s) =>
            s.id === fresh.id
              ? {
                  ...s,
                  title: question.length > 52 ? `${question.slice(0, 52)}…` : question,
                  updatedAt: Date.now(),
                  messages: [userMsg, assistantPlaceholder],
                }
              : s
          )
        );
        setRecentQuestions((prev) => [question, ...prev.filter((q) => q !== question)].slice(0, 12));
        void streamAnswer({
          sessionId: fresh.id,
          assistantMsgId,
          query: question,
          history: [],
          filter: partFilter,
          bypassCache: false,
        });
      }, 20);
    }
  };

  return (
    <div className="flex h-[100dvh] w-full overflow-hidden bg-[#FAF7F2] dark:bg-[#141312] text-stone-900 dark:text-stone-100">
      {/* Sidebar */}
      <Sidebar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        sessions={sessions}
        activeSessionId={activeSession.id}
        onSelectSession={setActiveSessionId}
        onNewChat={handleNewChat}
        onDeleteSession={handleDeleteSession}
        onClearAllHistory={handleClearAllHistory}
        recentQuestions={recentQuestions}
        onAskQuestion={handleAskFromOtherTab}
        onOpenPdf={setPdfRequest}
        manualMeta={manualMeta}
        darkMode={darkMode}
        onToggleDarkMode={() => setDarkMode((d) => !d)}
        mobileOpen={mobileSidebarOpen}
        onCloseMobile={() => setMobileSidebarOpen(false)}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {/* India Post Postal Red Header */}
        <header className="shrink-0 min-h-16 py-2 px-4 sm:px-6 bg-[#C8102E] text-white border-b-[3px] border-[#FFCD00] flex items-center justify-between gap-4 no-print">
          {/* Zone 1: Mobile menu button + Brand / Section Title + Attribution */}
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              type="button"
              onClick={() => setMobileSidebarOpen(true)}
              className="lg:hidden p-2 -ml-2 rounded-lg text-white hover:bg-white/15 cursor-pointer shrink-0"
              aria-label="Open navigation menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="lg:hidden shrink-0 rounded-lg ring-1 ring-white/30">
                <IndiaPostLogo className="w-8 h-8" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-display font-bold text-sm sm:text-[15px] leading-tight text-white truncate">
                    <span className="lg:hidden">CBS Manual AI Assistant</span>
                    <span className="hidden lg:inline">
                      {activeTab === 'assistant'
                        ? 'CBS Manual AI Assistant'
                        : activeTab === 'lookup'
                          ? 'Manual Lookup — POSB CBS Manual 2026'
                          : 'Finacle Menu Codes — POSB CBS Manual 2026'}
                    </span>
                  </span>
                </div>
                <div className="text-[11px] sm:text-xs font-medium text-[#FFCD00] leading-snug truncate mt-0.5">
                  Prepared by Kalandi Charan Sahoo, PA, Dhenkanal RS SO
                </div>
              </div>
            </div>
          </div>

          {/* Zone 2: Quick Workspace Links on desktop */}
          <nav className="hidden md:flex items-center gap-5 xl:gap-6 text-sm font-medium text-white/90">
            <button
              type="button"
              onClick={() => setActiveTab('assistant')}
              className={`py-1 transition-colors whitespace-nowrap cursor-pointer ${
                activeTab === 'assistant'
                  ? 'text-[#FFCD00] font-semibold underline decoration-[#FFCD00] decoration-2 underline-offset-8'
                  : 'hover:text-white'
              }`}
            >
              Assistant
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('lookup')}
              className={`py-1 transition-colors whitespace-nowrap cursor-pointer ${
                activeTab === 'lookup'
                  ? 'text-[#FFCD00] font-semibold underline decoration-[#FFCD00] decoration-2 underline-offset-8'
                  : 'hover:text-white'
              }`}
            >
              Manual Lookup
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('menus')}
              className={`py-1 transition-colors whitespace-nowrap cursor-pointer ${
                activeTab === 'menus'
                  ? 'text-[#FFCD00] font-semibold underline decoration-[#FFCD00] decoration-2 underline-offset-8'
                  : 'hover:text-white'
              }`}
            >
              Finacle Menus
            </button>
            <button
              type="button"
              onClick={() => setPdfRequest({ part: 1, page: 1 })}
              className="py-1 hover:text-[#FFCD00] transition-colors whitespace-nowrap cursor-pointer"
            >
              Part I PDF
            </button>
            <button
              type="button"
              onClick={() => setPdfRequest({ part: 2, page: 1 })}
              className="py-1 hover:text-[#FFCD00] transition-colors whitespace-nowrap cursor-pointer"
            >
              Part II PDF
            </button>
          </nav>

          {/* Zone 3: Single Primary Action */}
          <div className="flex items-center gap-2 shrink-0">
            {activeTab === 'assistant' ? (
              <button
                type="button"
                onClick={handleNewChat}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#FFCD00] hover:bg-[#f0be00] text-stone-950 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New Chat</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setPdfRequest({ part: 1, page: 1 })}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#FFCD00] hover:bg-[#f0be00] text-stone-950 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shadow-xs"
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>Open Manual</span>
              </button>
            )}
          </div>
        </header>

        {/* Workspace View */}
        {activeTab === 'assistant' && (
          <ChatWorkspace
            messages={activeSession.messages}
            isGenerating={isGenerating}
            partFilter={partFilter}
            onChangePartFilter={setPartFilter}
            onSendMessage={handleSendMessage}
            onRegenerate={(id) => handleRegenerateOrRetry(id, true)}
            onRetryFailed={(id) => handleRegenerateOrRetry(id, true)}
            onClearConversation={handleClearConversation}
            onOpenPdf={setPdfRequest}
            onJumpToLookup={handleJumpToLookup}
            manualMeta={manualMeta}
          />
        )}

        {activeTab === 'lookup' && (
          <ManualLookupView
            initialQuery={pendingLookupQuery}
            onConsumeInitialQuery={() => setPendingLookupQuery('')}
            searchHistory={searchHistory}
            onRecordSearch={handleRecordSearch}
            onClearSearchHistory={() => setSearchHistory([])}
            onOpenPdf={setPdfRequest}
            onAskAboutTopic={handleAskFromOtherTab}
            manualMeta={manualMeta}
          />
        )}

        {activeTab === 'menus' && (
          <FinacleMenuDirectory
            onLookupMenu={handleJumpToLookup}
            onAskMenu={handleAskFromOtherTab}
          />
        )}
      </div>

      {/* Interactive Page-Level PDF Viewer & Source Preview Drawer */}
      <PdfViewerModal
        request={pdfRequest}
        onClose={() => setPdfRequest(null)}
        onNavigate={setPdfRequest}
      />
    </div>
  );
}
