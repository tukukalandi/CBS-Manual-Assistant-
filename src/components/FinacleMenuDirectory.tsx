import { useMemo, useState } from 'react';
import { MessageSquare, Search } from 'lucide-react';
import { FREQUENT_FINACLE_MENUS } from '../data/cbsQuickData';

interface FinacleMenuDirectoryProps {
  onLookupMenu: (code: string) => void;
  onAskMenu: (question: string) => void;
}

export function FinacleMenuDirectory({
  onLookupMenu,
  onAskMenu,
}: FinacleMenuDirectoryProps) {
  const [filterText, setFilterText] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');

  const categories = useMemo(() => {
    const set = new Set<string>(['All']);
    for (const m of FREQUENT_FINACLE_MENUS) set.add(m.category);
    return Array.from(set);
  }, []);

  const filtered = useMemo(() => {
    const q = filterText.trim().toLowerCase();
    return FREQUENT_FINACLE_MENUS.filter((item) => {
      if (selectedCategory !== 'All' && item.category !== selectedCategory) return false;
      if (!q) return true;
      return (
        item.code.toLowerCase().includes(q) ||
        item.purpose.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q)
      );
    });
  }, [filterText, selectedCategory]);

  return (
    <div className="flex-1 overflow-y-auto bg-[#FAF7F2] dark:bg-[#141312] px-4 sm:px-6 lg:px-8 py-6">
      <div className="max-w-5xl mx-auto space-y-5">
        <div>
          <h1 className="font-display text-2xl font-bold text-stone-900 dark:text-stone-100">
            Frequently Used Finacle Menu Codes
          </h1>
          <p className="text-sm text-stone-600 dark:text-stone-400 mt-1">
            Quick reference of commonly used POSB Finacle menus referenced in POSB CBS Manual 2026.
            Look up exact manual pages or ask the AI Assistant for Maker &amp; Checker steps.
          </p>
        </div>

        {/* Filter bar */}
        <div className="rounded-xl bg-white dark:bg-[#1C1B19] border border-stone-200 dark:border-stone-800 p-4 space-y-3">
          <div className="relative">
            <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              placeholder="Filter menu code or function (e.g. CASBAO, closure, passbook, transfer)…"
              className="w-full pl-10 pr-4 py-2 rounded-lg border border-stone-300 dark:border-stone-700 bg-[#FAF7F2] dark:bg-[#22201D] text-sm text-stone-900 dark:text-stone-100 placeholder:text-stone-400 focus:outline-none focus:border-[#C8102E] dark:focus:border-[#FFCD00]"
            />
          </div>

          <div className="flex flex-wrap gap-1.5">
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                  selectedCategory === cat
                    ? 'bg-[#C8102E] text-white'
                    : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-700'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Menu table */}
        <div className="rounded-xl bg-white dark:bg-[#1C1B19] border border-stone-200 dark:border-stone-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-stone-200 dark:border-stone-800 bg-[#FAF7F2] dark:bg-[#23211E] text-xs font-semibold text-stone-600 dark:text-stone-400">
                  <th className="py-3 px-4 whitespace-nowrap">Menu Code</th>
                  <th className="py-3 px-4 whitespace-nowrap">Category</th>
                  <th className="py-3 px-4">Purpose</th>
                  <th className="py-3 px-4 text-right whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 dark:divide-stone-800/80 text-sm">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-10 text-center text-stone-500 dark:text-stone-400">
                      No matching Finacle menu codes found.
                    </td>
                  </tr>
                ) : (
                  filtered.map((item) => (
                    <tr
                      key={item.code}
                      className="hover:bg-stone-50/80 dark:hover:bg-stone-800/30 transition-colors"
                    >
                      <td className="py-3 px-4 font-mono font-semibold text-[#C8102E] dark:text-[#FFCD00] whitespace-nowrap">
                        {item.code}
                      </td>
                      <td className="py-3 px-4 text-xs text-stone-500 dark:text-stone-400 whitespace-nowrap">
                        {item.category} · {item.partHint}
                      </td>
                      <td className="py-3 px-4 text-stone-800 dark:text-stone-200">
                        {item.purpose}
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => onLookupMenu(item.code)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-stone-200 dark:border-stone-700 text-xs font-medium text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors cursor-pointer"
                          >
                            <Search className="w-3 h-3" />
                            Lookup
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              onAskMenu(
                                `Explain the Finacle menu ${item.code}, its purpose, sequential steps, and Maker/Checker responsibilities as per the POSB CBS Manual 2026.`
                              )
                            }
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-[#C8102E] hover:bg-[#A00D24] text-white text-xs font-medium transition-colors cursor-pointer"
                          >
                            <MessageSquare className="w-3 h-3" />
                            Ask AI
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
