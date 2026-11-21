import {
  BookOpen,
  ExternalLink,
  History,
  MessageSquare,
  Moon,
  Plus,
  Search,
  Sun,
  Terminal,
  Trash2,
  X,
} from 'lucide-react';
import { IndiaPostLogo } from './IndiaPostLogo';
import type { ChatSession, ManualMeta, PdfViewerRequest, WorkspaceTab } from '../types';

interface SidebarProps {
  activeTab: WorkspaceTab;
  onSelectTab: (tab: WorkspaceTab) => void;
  sessions: ChatSession[];
  activeSessionId: string;
  onSelectSession: (id: string) => void;
  onNewChat: () => void;
  onDeleteSession: (id: string) => void;
  onClearAllHistory: () => void;
  recentQuestions: string[];
  onAskQuestion: (q: string) => void;
  onOpenPdf: (req: PdfViewerRequest) => void;
  manualMeta: ManualMeta | null;
  darkMode: boolean;
  onToggleDarkMode: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

export function Sidebar({
  activeTab,
  onSelectTab,
  sessions,
  activeSessionId,
  onSelectSession,
  onNewChat,
  onDeleteSession,
  onClearAllHistory,
  recentQuestions,
  onAskQuestion,
  onOpenPdf,
  manualMeta,
  darkMode,
  onToggleDarkMode,
  mobileOpen,
  onCloseMobile,
}: SidebarProps) {
  const part1Pages = manualMeta?.manuals.find((m) => m.part === 1)?.totalPages ?? 389;
  const part2Pages = manualMeta?.manuals.find((m) => m.part === 2)?.totalPages ?? 359;

  const navItems: Array<{ id: WorkspaceTab; label: string; icon: typeof MessageSquare }> = [
    { id: 'assistant', label: 'AI Assistant', icon: MessageSquare },
    { id: 'lookup', label: 'Manual Lookup', icon: Search },
    { id: 'menus', label: 'Finacle Menus', icon: Terminal },
  ];

  const sidebarContent = (
    <aside className="flex flex-col h-full w-72 bg-white dark:bg-[#191816] border-r border-stone-200 dark:border-stone-800 select-none">
      {/* Brand header — seamless India Post Postal Red bar */}
      <div className="min-h-16 py-2 px-4 bg-[#C8102E] text-white border-b-[3px] border-[#FFCD00] flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="shrink-0 rounded-lg ring-1 ring-white/30">
            <IndiaPostLogo className="w-8 h-8" />
          </div>
          <div className="min-w-0">
            <div className="font-display font-bold text-sm leading-tight text-white truncate">
              India Post CBS
            </div>
            <div className="text-[11px] text-[#FFCD00] font-medium truncate mt-0.5">
              Department of Posts, India
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={onCloseMobile}
          className="lg:hidden p-1.5 rounded-md text-white/90 hover:bg-white/15 cursor-pointer"
          aria-label="Close navigation menu"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Primary Action: New Chat */}
      <div className="p-3">
        <button
          type="button"
          onClick={() => {
            onNewChat();
            onSelectTab('assistant');
            onCloseMobile();
          }}
          className="w-full flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-lg bg-[#C8102E] hover:bg-[#A00D24] text-white text-sm font-medium transition-colors cursor-pointer whitespace-nowrap"
        >
          <Plus className="w-4 h-4" />
          New Chat
        </button>
      </div>

      {/* Workspace Navigation */}
      <nav className="px-3 pb-3 border-b border-stone-200 dark:border-stone-800 space-y-0.5" aria-label="Primary workspace navigation">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                onSelectTab(item.id);
                onCloseMobile();
              }}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer whitespace-nowrap ${
                active
                  ? 'bg-[#FAF7F2] dark:bg-stone-800/90 text-[#C8102E] dark:text-[#FFCD00]'
                  : 'text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800/50'
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Scrollable Middle: Official Manuals + Chat History + Recent Questions */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-5">
        {/* Official POSB CBS Manuals */}
        <div>
          <div className="px-1.5 mb-2 text-xs font-semibold text-stone-500 dark:text-stone-400">
            Official Reference Manuals
          </div>
          <div className="space-y-2">
            <div className="rounded-lg border border-stone-200 dark:border-stone-800 bg-[#FAF7F2] dark:bg-[#22201D] p-2.5">
              <div className="flex items-start justify-between gap-2">
                <button
                  type="button"
                  onClick={() => {
                    onOpenPdf({ part: 1, page: 1 });
                    onCloseMobile();
                  }}
                  className="text-left flex-1 min-w-0 group cursor-pointer"
                >
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-stone-900 dark:text-stone-100 group-hover:text-[#C8102E] dark:group-hover:text-[#FFCD00] transition-colors">
                    <BookOpen className="w-3.5 h-3.5 text-[#C8102E] dark:text-[#FFCD00] shrink-0" />
                    <span className="truncate">View CBS Manual 2026 – Part I</span>
                  </div>
                  <div className="text-[11px] text-stone-500 dark:text-stone-400 mt-0.5 tabular-nums">
                    {part1Pages} pages · Schemes &amp; Operations
                  </div>
                </button>
                <a
                  href="/manuals/POSB_CBS_Manual_2026_Part_1.pdf"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1.5 rounded-md text-stone-500 hover:text-[#C8102E] dark:hover:text-[#FFCD00] hover:bg-stone-200/60 dark:hover:bg-stone-800 shrink-0"
                  title="Open Part I PDF in new browser tab"
                  aria-label="Open CBS Manual 2026 Part I in new tab"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>

            <div className="rounded-lg border border-stone-200 dark:border-stone-800 bg-[#FAF7F2] dark:bg-[#22201D] p-2.5">
              <div className="flex items-start justify-between gap-2">
                <button
                  type="button"
                  onClick={() => {
                    onOpenPdf({ part: 2, page: 1 });
                    onCloseMobile();
                  }}
                  className="text-left flex-1 min-w-0 group cursor-pointer"
                >
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-stone-900 dark:text-stone-100 group-hover:text-[#C8102E] dark:group-hover:text-[#FFCD00] transition-colors">
                    <BookOpen className="w-3.5 h-3.5 text-[#C8102E] dark:text-[#FFCD00] shrink-0" />
                    <span className="truncate">View CBS Manual 2026 – Part II</span>
                  </div>
                  <div className="text-[11px] text-stone-500 dark:text-stone-400 mt-0.5 tabular-nums">
                    {part2Pages} pages · Appendices &amp; SOPs
                  </div>
                </button>
                <a
                  href="/manuals/POSB_CBS_Manual_2026_Part_2.pdf"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1.5 rounded-md text-stone-500 hover:text-[#C8102E] dark:hover:text-[#FFCD00] hover:bg-stone-200/60 dark:hover:bg-stone-800 shrink-0"
                  title="Open Part II PDF in new browser tab"
                  aria-label="Open CBS Manual 2026 Part II in new tab"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Chat History */}
        <div>
          <div className="px-1.5 mb-2 flex items-center justify-between">
            <span className="text-xs font-semibold text-stone-500 dark:text-stone-400">
              Chat History
            </span>
            {sessions.some((s) => s.messages.length > 0) && (
              <button
                type="button"
                onClick={onClearAllHistory}
                className="text-[11px] text-stone-400 hover:text-[#C8102E] dark:hover:text-[#FFCD00] transition-colors cursor-pointer"
              >
                Clear all
              </button>
            )}
          </div>

          {sessions.filter((s) => s.messages.length > 0).length === 0 ? (
            <p className="px-2 py-2 text-xs text-stone-400 dark:text-stone-500">
              No saved conversations yet.
            </p>
          ) : (
            <div className="space-y-0.5">
              {sessions
                .filter((s) => s.messages.length > 0)
                .slice(0, 15)
                .map((session) => {
                  const isActive = session.id === activeSessionId && activeTab === 'assistant';
                  return (
                    <div
                      key={session.id}
                      className={`group flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs transition-colors ${
                        isActive
                          ? 'bg-stone-100 dark:bg-stone-800 text-stone-900 dark:text-stone-100 font-medium'
                          : 'text-stone-600 dark:text-stone-400 hover:bg-stone-100/70 dark:hover:bg-stone-800/50'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          onSelectSession(session.id);
                          onSelectTab('assistant');
                          onCloseMobile();
                        }}
                        className="flex-1 text-left truncate py-0.5 cursor-pointer"
                        title={session.title}
                      >
                        {session.title}
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteSession(session.id);
                        }}
                        className="opacity-0 group-hover:opacity-100 focus:opacity-100 p-1 rounded text-stone-400 hover:text-[#C8102E] transition-opacity cursor-pointer"
                        aria-label={`Delete conversation ${session.title}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
            </div>
          )}
        </div>

        {/* Recent Questions */}
        {recentQuestions.length > 0 && (
          <div>
            <div className="px-1.5 mb-2 flex items-center gap-1.5 text-xs font-semibold text-stone-500 dark:text-stone-400">
              <History className="w-3.5 h-3.5" />
              <span>Recent Questions</span>
            </div>
            <div className="space-y-1">
              {recentQuestions.slice(0, 5).map((q, idx) => (
                <button
                  key={`${q}-${idx}`}
                  type="button"
                  onClick={() => {
                    onSelectTab('assistant');
                    onAskQuestion(q);
                    onCloseMobile();
                  }}
                  className="w-full text-left px-2 py-1.5 rounded-md text-xs text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800/60 hover:text-stone-900 dark:hover:text-stone-100 truncate transition-colors cursor-pointer"
                  title={q}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Footer: Theme Toggle */}
      <div className="p-3 border-t border-stone-200 dark:border-stone-800 flex items-center justify-between gap-2">
        <span className="text-[11px] text-stone-500 dark:text-stone-400 tabular-nums">
          POSB Manual 2026 · {part1Pages + part2Pages}p
        </span>
        <button
          type="button"
          onClick={onToggleDarkMode}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-stone-200 dark:border-stone-700 text-xs font-medium text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors cursor-pointer whitespace-nowrap"
          aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {darkMode ? <Sun className="w-3.5 h-3.5 text-[#FFCD00]" /> : <Moon className="w-3.5 h-3.5" />}
          <span>{darkMode ? 'Light' : 'Dark'}</span>
        </button>
      </div>
    </aside>
  );

  return (
    <>
      {/* Desktop persistent sidebar */}
      <div className="hidden lg:block shrink-0 h-full no-print">{sidebarContent}</div>

      {/* Mobile slide-over drawer */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 lg:hidden flex bg-stone-950/50 backdrop-blur-[1px] no-print"
          onClick={onCloseMobile}
        >
          <div className="h-full" onClick={(e) => e.stopPropagation()}>
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
}
