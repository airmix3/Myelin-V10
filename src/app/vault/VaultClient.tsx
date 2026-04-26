'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { marked } from 'marked';
import {
  Shield, Search, FileText, Building2, ChevronDown, ChevronUp,
} from 'lucide-react';

// -- Types --------------------------------------------------------------------

interface VaultDocument {
  id: string;
  title: string;
  content: string;
  source: string;
  department: string | null;
  filedBy: string | null;
  createdAt: string;
}

interface SearchResult {
  id: string;
  title: string;
  source: string;
  department: string | null;
  snippet: string;
  rank: number;
}

interface VaultClientProps {
  initialDocuments: VaultDocument[];
}

// -- Helpers ------------------------------------------------------------------

const DEPT_COLORS: Record<string, { text: string; bg: string; border: string }> = {
  tech:       { text: 'text-sky-400',     bg: 'bg-sky-500/10',     border: 'border-sky-500/20' },
  marketing:  { text: 'text-rose-400',    bg: 'bg-rose-500/10',    border: 'border-rose-500/20' },
  operations: { text: 'text-amber-400',   bg: 'bg-amber-500/10',   border: 'border-amber-500/20' },
  cos:        { text: 'text-violet-400',  bg: 'bg-violet-500/10',  border: 'border-violet-500/20' },
  global:     { text: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
};

const SOURCE_COLORS: Record<string, { text: string; bg: string; border: string }> = {
  vault:     { text: 'text-indigo-400', bg: 'bg-indigo-500/10', border: 'border-indigo-500/20' },
  knowledge: { text: 'text-amber-400',  bg: 'bg-amber-500/10',  border: 'border-amber-500/20' },
};

function getDeptStyle(dept: string | null) {
  if (!dept) return DEPT_COLORS.global;
  return DEPT_COLORS[dept] || DEPT_COLORS.global;
}

function getSourceStyle(source: string) {
  return SOURCE_COLORS[source] || SOURCE_COLORS.vault;
}

function timeAgo(iso: string): string {
  const now = Date.now();
  const then = new Date(iso).getTime();
  const diff = now - then;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

// -- Component ----------------------------------------------------------------

export default function VaultClient({ initialDocuments }: VaultClientProps) {
  const [searchInput, setSearchInput] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[] | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<'all' | 'vault' | 'knowledge'>('all');

  // 300ms debounce
  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedQuery(searchInput), 300);
    return () => clearTimeout(timeout);
  }, [searchInput]);

  // Fetch search results when debounced query changes
  useEffect(() => {
    if (!debouncedQuery.trim()) {
      setSearchResults(null);
      return;
    }

    setIsSearching(true);
    fetch(`/api/vault/search?q=${encodeURIComponent(debouncedQuery)}`)
      .then((res) => res.json())
      .then((data) => {
        setSearchResults(data.results || []);
        setIsSearching(false);
      })
      .catch(() => {
        setSearchResults([]);
        setIsSearching(false);
      });
  }, [debouncedQuery]);

  // Filter documents by source
  const filteredDocuments = useMemo(() => {
    if (activeFilter === 'all') return initialDocuments;
    return initialDocuments.filter((d) => d.source === activeFilter);
  }, [initialDocuments, activeFilter]);

  // Stats
  const stats = useMemo(() => {
    const byDept: Record<string, number> = {};
    const bySource: Record<string, number> = {};
    for (const doc of initialDocuments) {
      const dept = doc.department || 'global';
      byDept[dept] = (byDept[dept] || 0) + 1;
      bySource[doc.source] = (bySource[doc.source] || 0) + 1;
    }
    return { total: initialDocuments.length, byDept, bySource };
  }, [initialDocuments]);

  const isSearchActive = debouncedQuery.trim().length > 0;

  const handleCardClick = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  const getDocContent = (id: string): string => {
    const doc = initialDocuments.find((d) => d.id === id);
    return doc?.content || '';
  };

  // -- Render -----------------------------------------------------------------

  const filterPills: Array<{ id: 'all' | 'vault' | 'knowledge'; label: string }> = [
    { id: 'all', label: 'All' },
    { id: 'vault', label: 'Vault' },
    { id: 'knowledge', label: 'Knowledge' },
  ];

  const renderCard = (doc: { id: string; title: string; source: string; department: string | null; content?: string; snippet?: string; createdAt?: string; filedBy?: string | null }, index: number) => {
    const isExpanded = expandedId === doc.id;
    const deptStyle = getDeptStyle(doc.department);
    const srcStyle = getSourceStyle(doc.source);
    const preview = doc.content ? doc.content.slice(0, 200) : doc.snippet || '';

    return (
      <motion.div
        key={doc.id}
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: index * 0.04 }}
        onClick={() => handleCardClick(doc.id)}
        className="rounded-xl p-4 flex flex-col cursor-pointer transition-all hover:border-white/10"
        style={{
          background: 'var(--bg-card)',
          border: `1px solid ${isExpanded ? 'rgba(255,255,255,0.12)' : 'var(--border-subtle)'}`,
        }}
      >
        {/* Top row: badges */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            {doc.department && (
              <div className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wider border ${deptStyle.bg} ${deptStyle.text} ${deptStyle.border}`}>
                <Building2 className="w-2.5 h-2.5" />
                {doc.department}
              </div>
            )}
            <div className={`px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wider border ${srcStyle.bg} ${srcStyle.text} ${srcStyle.border}`}>
              {doc.source}
            </div>
          </div>
          {isExpanded ? (
            <ChevronUp className="w-3.5 h-3.5 text-slate-500" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
          )}
        </div>

        {/* Title */}
        <h3 className="text-sm font-bold text-white mb-2 leading-snug">{doc.title}</h3>

        {/* Preview */}
        {!isExpanded && (
          <p className="text-xs text-slate-400 leading-relaxed mb-3 line-clamp-3 flex-1">
            {preview}
          </p>
        )}

        {/* Expanded content */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.25 }}
              className="overflow-hidden"
            >
              <div
                className="prose prose-invert prose-sm max-w-none text-xs text-slate-300 leading-relaxed mb-3"
                style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 12 }}
                dangerouslySetInnerHTML={{ __html: marked.parse(getDocContent(doc.id)) as string }}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Footer */}
        <div
          className="pt-2 text-[10px] text-slate-500 flex items-center gap-2"
          style={{ borderTop: isExpanded ? 'none' : '1px solid var(--border-subtle)' }}
        >
          {doc.filedBy && <span>by <span className="text-slate-300">{doc.filedBy}</span></span>}
          {doc.createdAt && <span>{timeAgo(doc.createdAt)}</span>}
        </div>
      </motion.div>
    );
  };

  return (
    <div className="max-w-[1400px] mx-auto px-6 py-8">
      {/* Page Header */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="mb-6"
      >
        <div className="flex items-center gap-3 mb-2">
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center"
            style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}
          >
            <Shield className="w-5 h-5 text-sky-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Vault</h1>
            <p className="text-sm text-slate-400">Company institutional memory</p>
          </div>
        </div>
      </motion.div>

      {/* Filter Bar */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="flex flex-wrap items-center gap-3 mb-6"
      >
        {/* Source filter pills */}
        <div className="flex gap-1.5">
          {filterPills.map((pill) => {
            const isActive = activeFilter === pill.id;
            return (
              <button
                key={pill.id}
                onClick={() => setActiveFilter(pill.id)}
                className={`
                  px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200
                  ${isActive
                    ? 'bg-white/10 text-white border border-white/15'
                    : 'text-slate-400 hover:text-slate-300 hover:bg-white/5 border border-transparent'
                  }
                `}
              >
                {pill.label}
              </button>
            );
          })}
        </div>

        {/* Search */}
        <div className="ml-auto relative">
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search vault..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="pl-9 pr-4 py-1.5 rounded-lg text-xs text-slate-300 placeholder:text-slate-500 outline-none w-64 transition-colors"
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-subtle)',
            }}
          />
        </div>
      </motion.div>

      {isSearching && (
        <div className="text-xs text-slate-500 mb-4">Searching...</div>
      )}

      {/* Main Grid: Cards + Sidebar */}
      <div className="grid grid-cols-[1fr_280px] gap-6">
        {/* Cards Grid */}
        <div className="grid grid-cols-2 gap-4 auto-rows-max">
          {isSearchActive && !isSearching && searchResults !== null ? (
            <>
              {searchResults.length === 0 ? (
                <div className="col-span-2 rounded-xl p-12 text-center" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
                  <Search className="w-8 h-8 text-slate-600 mx-auto mb-3" />
                  <p className="text-sm text-slate-400">No documents found</p>
                  <p className="text-xs text-slate-500 mt-1">Try a different search term</p>
                </div>
              ) : (
                searchResults.map((result, i) =>
                  renderCard({
                    id: result.id,
                    title: result.title,
                    source: result.source,
                    department: result.department,
                    snippet: result.snippet,
                    content: getDocContent(result.id),
                    createdAt: initialDocuments.find((d) => d.id === result.id)?.createdAt,
                    filedBy: initialDocuments.find((d) => d.id === result.id)?.filedBy,
                  }, i)
                )
              )}
            </>
          ) : !isSearchActive ? (
            <>
              {filteredDocuments.length === 0 ? (
                <div className="col-span-2 rounded-xl p-12 text-center" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
                  <FileText className="w-8 h-8 text-slate-600 mx-auto mb-3" />
                  <p className="text-sm text-slate-400">No documents found</p>
                  <p className="text-xs text-slate-500 mt-1">Documents filed by agents will appear here</p>
                </div>
              ) : (
                filteredDocuments.map((doc, i) => renderCard(doc, i))
              )}
            </>
          ) : null}
        </div>

        {/* Sidebar: Stats */}
        <motion.div
          initial={{ opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="space-y-4"
        >
          {/* Total count */}
          <div
            className="rounded-xl p-4"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
          >
            <h4 className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 mb-3">
              Vault Statistics
            </h4>
            <div className="flex items-baseline gap-2 mb-1">
              <span className="text-3xl font-bold text-white">{stats.total}</span>
              <span className="text-xs text-slate-400">total documents</span>
            </div>
          </div>

          {/* By Department */}
          <div
            className="rounded-xl p-4"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
          >
            <h4 className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 mb-4">
              By Department
            </h4>
            <div className="space-y-3">
              {Object.entries(stats.byDept).map(([dept, count]) => {
                const style = getDeptStyle(dept);
                const maxCount = Math.max(...Object.values(stats.byDept));
                const pct = maxCount > 0 ? (count / maxCount) * 100 : 0;
                return (
                  <div key={dept}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-slate-300 capitalize">{dept}</span>
                      <span className={`text-xs font-semibold ${style.text}`}>{count}</span>
                    </div>
                    <div
                      className="h-1.5 rounded-full overflow-hidden"
                      style={{ background: 'var(--bg-elevated)' }}
                    >
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.6, delay: 0.3 }}
                        className={`h-full rounded-full ${style.bg}`}
                        style={{ opacity: 0.8 }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* By Source */}
          <div
            className="rounded-xl p-4"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
          >
            <h4 className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 mb-4">
              By Source
            </h4>
            <div className="space-y-2">
              {Object.entries(stats.bySource).map(([source, count]) => {
                const style = getSourceStyle(source);
                return (
                  <div key={source} className="flex items-center justify-between">
                    <span className="text-xs text-slate-400 capitalize">{source}</span>
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded border ${style.bg} ${style.text} ${style.border}`}>
                      {count}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
