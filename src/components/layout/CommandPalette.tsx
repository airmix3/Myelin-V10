'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useRouter } from 'next/navigation';
import {
  Search, Home, AlertTriangle, Users, Layers,
  Shield, Terminal, Sparkles, ArrowRight,
  BookOpen, Settings, FolderOpen, Radio, BarChart3,
  Clock,
} from 'lucide-react';

// ---- Types ----

type CommandCategory = 'navigate' | 'action' | 'search';

interface Command {
  id: string;
  label: string;
  description: string;
  icon: React.ElementType;
  category: CommandCategory;
  color: string;
  keywords: string[];
  action: (router: ReturnType<typeof useRouter>, close: () => void) => void;
}

interface SearchResult {
  id: string;
  title: string;
  content: string;
  source: string;
  department: string;
  score: number;
}

// ---- Category config ----

const CATEGORY_META: Record<CommandCategory, { label: string; color: string }> = {
  navigate: { label: 'Navigate',        color: '#38bdf8' },
  action:   { label: 'Action',          color: '#f59e0b' },
  search:   { label: 'Search Results',  color: '#a78bfa' },
};

// ---- Command registry ----

const COMMANDS: Command[] = [
  // Navigate
  {
    id: 'nav-home',
    label: 'Go to Home',
    description: 'Dashboard overview',
    icon: Home,
    category: 'navigate',
    color: '#f43f5e',
    keywords: ['home', 'dashboard', 'overview'],
    action: (r, c) => { r.push('/'); c(); },
  },
  {
    id: 'nav-tamir',
    label: 'Go to Tamir',
    description: 'CEO Desk & task initiation',
    icon: Sparkles,
    category: 'navigate',
    color: '#f59e0b',
    keywords: ['tamir', 'ceo desk', 'chat', 'initiate'],
    action: (r, c) => { r.push('/tamir'); c(); },
  },
  {
    id: 'nav-deliverables',
    label: 'Go to Deliverables',
    description: 'All deliverables and outputs',
    icon: FolderOpen,
    category: 'navigate',
    color: '#a78bfa',
    keywords: ['deliverables', 'outputs', 'files'],
    action: (r, c) => { r.push('/deliverables'); c(); },
  },
  {
    id: 'nav-escalations',
    label: 'Go to Escalations',
    description: 'Critical decisions requiring CEO sign-off',
    icon: AlertTriangle,
    category: 'navigate',
    color: '#f43f5e',
    keywords: ['escalations', 'critical', 'urgent', 'decisions'],
    action: (r, c) => { r.push('/escalations'); c(); },
  },
  {
    id: 'nav-routines',
    label: 'Go to Routines',
    description: 'Scheduled agent routines',
    icon: Clock,
    category: 'navigate',
    color: '#38bdf8',
    keywords: ['routines', 'schedule', 'cron'],
    action: (r, c) => { r.push('/routines'); c(); },
  },
  {
    id: 'nav-workspace',
    label: 'Go to Workspace',
    description: 'Task execution canvas & agent pipeline',
    icon: Layers,
    category: 'navigate',
    color: '#38bdf8',
    keywords: ['workspace', 'execution', 'pipeline'],
    action: (r, c) => { r.push('/workspace'); c(); },
  },
  {
    id: 'nav-people',
    label: 'Go to People',
    description: 'Agent roster by department',
    icon: Users,
    category: 'navigate',
    color: '#38bdf8',
    keywords: ['people', 'agents', 'team', 'org graph'],
    action: (r, c) => { r.push('/agents'); c(); },
  },
  {
    id: 'nav-org-context',
    label: 'Go to Org Context',
    description: 'Department knowledge, skills, and tools',
    icon: BarChart3,
    category: 'navigate',
    color: '#a78bfa',
    keywords: ['org context', 'departments', 'knowledge'],
    action: (r, c) => { r.push('/org-context'); c(); },
  },
  {
    id: 'nav-vault',
    label: 'Go to Vault',
    description: 'Company memory -- strategy, decisions, policies',
    icon: Shield,
    category: 'navigate',
    color: '#a78bfa',
    keywords: ['vault', 'memory', 'strategy', 'decisions', 'policies', 'knowledge'],
    action: (r, c) => { r.push('/vault'); c(); },
  },
  {
    id: 'nav-assets',
    label: 'Go to Assets',
    description: 'Media and file assets',
    icon: Radio,
    category: 'navigate',
    color: '#34d399',
    keywords: ['assets', 'media', 'files', 'images'],
    action: (r, c) => { r.push('/assets'); c(); },
  },
  {
    id: 'nav-terminal',
    label: 'Go to Terminal',
    description: 'System access & advanced commands',
    icon: Terminal,
    category: 'navigate',
    color: '#34d399',
    keywords: ['terminal', 'system', 'cli', 'logs', 'commands'],
    action: (r, c) => { r.push('/terminal'); c(); },
  },
  {
    id: 'nav-settings',
    label: 'Go to Settings',
    description: 'Application configuration',
    icon: Settings,
    category: 'navigate',
    color: '#34d399',
    keywords: ['settings', 'config', 'preferences'],
    action: (r, c) => { r.push('/settings'); c(); },
  },

  // Action
  {
    id: 'action-new-task',
    label: 'Initiate New Task',
    description: 'Open Tamir to start a new task',
    icon: Sparkles,
    category: 'action',
    color: '#f59e0b',
    keywords: ['new task', 'initiate', 'start', 'create', 'launch'],
    action: (r, c) => { r.push('/tamir'); c(); },
  },
];

// ---- Highlight match ----

function Highlight({ text, query }: { text: string; query: string }) {
  if (!query) return <>{text}</>;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-transparent font-bold" style={{ color: 'inherit', opacity: 1 }}>
        {text.slice(idx, idx + query.length)}
      </mark>
      {text.slice(idx + query.length)}
    </>
  );
}

// ---- Main component ----

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function CommandPalette({ open, onClose }: Props) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [activeIdx, setActiveIdx] = useState(0);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<NodeJS.Timeout>();

  // Focus input on open
  useEffect(() => {
    if (open) {
      setQuery('');
      setActiveIdx(0);
      setSearchResults([]);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Debounced search via GET /api/search?q=...
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const q = query.trim();
    if (q.length < 2) { setSearchResults([]); setSearching(false); return; }
    setSearching(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
        if (res.ok) {
          const data = await res.json();
          setSearchResults(data.results || []);
        }
      } catch { /* silent */ }
      setSearching(false);
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query]);

  // Filter commands by query
  const filteredCommands = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return COMMANDS;
    return COMMANDS.filter((c) =>
      c.label.toLowerCase().includes(q) ||
      c.description.toLowerCase().includes(q) ||
      c.keywords.some((k) => k.includes(q))
    );
  }, [query]);

  // Build combined items list: commands + search results
  const allItems = useMemo(() => {
    const items: Array<{ type: 'command'; data: Command } | { type: 'search'; data: SearchResult }> = [];
    filteredCommands.forEach((cmd) => items.push({ type: 'command', data: cmd }));
    searchResults.forEach((sr) => items.push({ type: 'search', data: sr }));
    return items;
  }, [filteredCommands, searchResults]);

  // Reset active index when items change
  useEffect(() => {
    setActiveIdx(0);
  }, [allItems.length]);

  // Execute command or navigate to search result
  const executeItem = useCallback((item: typeof allItems[number]) => {
    if (item.type === 'command') {
      item.data.action(router, onClose);
    } else {
      // Navigate based on source
      const sr = item.data;
      if (sr.source === 'deliverable') {
        router.push(`/deliverables`);
      } else if (sr.source === 'vault') {
        router.push(`/vault`);
      } else {
        router.push(`/vault`);
      }
      onClose();
    }
  }, [router, onClose]);

  // Keyboard navigation
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx((i) => Math.min(i + 1, allItems.length - 1)); }
      if (e.key === 'ArrowUp')   { e.preventDefault(); setActiveIdx((i) => Math.max(i - 1, 0)); }
      if (e.key === 'Enter' && allItems[activeIdx]) { executeItem(allItems[activeIdx]); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, allItems, activeIdx, executeItem, onClose]);

  // Group commands by category
  const groupedCommands = useMemo(() => {
    const groups: Partial<Record<CommandCategory, Command[]>> = {};
    filteredCommands.forEach((cmd) => {
      if (!groups[cmd.category]) groups[cmd.category] = [];
      groups[cmd.category]!.push(cmd);
    });
    return groups;
  }, [filteredCommands]);

  // Calculate global index for a command
  const getCommandGlobalIndex = (cmd: Command) => {
    return allItems.findIndex((item) => item.type === 'command' && item.data.id === cmd.id);
  };

  // Calculate global index for a search result
  const getSearchGlobalIndex = (sr: SearchResult, localIdx: number) => {
    return filteredCommands.length + localIdx;
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-[100]"
            style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)' }}
            onClick={onClose}
          />

          {/* Palette */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: -16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -12 }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            className="fixed left-1/2 top-[18%] -translate-x-1/2 z-[101] w-full max-w-[580px] rounded-2xl overflow-hidden"
            style={{
              background: 'rgba(8,14,32,0.97)',
              border: '1px solid rgba(255,255,255,0.1)',
              backdropFilter: 'blur(32px) saturate(160%)',
              boxShadow: '0 24px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.04), 0 0 40px rgba(56,189,248,0.06)',
            }}
          >
            {/* Specular top edge */}
            <div className="absolute top-0 left-0 right-0 h-px" style={{ background: 'linear-gradient(to right, transparent 10%, rgba(255,255,255,0.12) 50%, transparent 90%)' }} />

            {/* Search input */}
            <div
              className="flex items-center gap-3 px-4 py-3.5"
              style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}
            >
              <Search size={16} className="text-slate-500 shrink-0" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search actions, navigate, or search documents..."
                className="flex-1 bg-transparent text-[14px] text-white placeholder-slate-600 outline-none"
              />
              <div className="flex items-center gap-1 shrink-0">
                <kbd
                  className="px-1.5 py-0.5 rounded text-[10px] font-mono text-slate-500"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
                >
                  ESC
                </kbd>
              </div>
            </div>

            {/* Results */}
            <div className="overflow-y-auto max-h-[360px] py-2" style={{ scrollbarWidth: 'none' }}>
              {allItems.length === 0 && !searching ? (
                <div className="px-4 py-8 text-center">
                  <p className="text-[13px] text-slate-600">No results for &ldquo;{query}&rdquo;</p>
                  <p className="text-[11px] text-slate-700 mt-1">Try &ldquo;vault&rdquo;, &ldquo;deliverables&rdquo;, or &ldquo;settings&rdquo;</p>
                </div>
              ) : (
                <>
                  {/* Command categories */}
                  {(['navigate', 'action'] as CommandCategory[]).map((cat) => {
                    const cmds = groupedCommands[cat];
                    if (!cmds?.length) return null;
                    const meta = CATEGORY_META[cat];
                    return (
                      <div key={cat} className="mb-1">
                        {/* Category header */}
                        <div className="flex items-center gap-2 px-4 py-1.5">
                          <span
                            className="text-[9px] font-bold uppercase tracking-[0.14em]"
                            style={{ color: meta.color }}
                          >
                            {meta.label}
                          </span>
                          <div className="flex-1 h-px" style={{ background: `${meta.color}20` }} />
                        </div>

                        {/* Commands */}
                        {cmds.map((cmd) => {
                          const globalIdx = getCommandGlobalIndex(cmd);
                          const isActive = globalIdx === activeIdx;
                          return (
                            <motion.button
                              key={cmd.id}
                              onClick={() => executeItem({ type: 'command', data: cmd })}
                              onMouseEnter={() => setActiveIdx(globalIdx)}
                              className="relative w-full flex items-center gap-3 px-4 py-2.5 text-left transition-all cursor-pointer"
                              style={{
                                background: isActive ? 'rgba(255,255,255,0.05)' : 'transparent',
                              }}
                            >
                              {/* Active left bar */}
                              {isActive && (
                                <motion.span
                                  layoutId="palette-active"
                                  className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-7 rounded-r-full"
                                  style={{ background: cmd.color, boxShadow: `0 0 8px ${cmd.color}60` }}
                                  transition={{ duration: 0.15 }}
                                />
                              )}

                              {/* Icon */}
                              <div
                                className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                                style={{
                                  background: isActive ? `${cmd.color}18` : 'rgba(255,255,255,0.04)',
                                  border: `1px solid ${isActive ? cmd.color + '30' : 'rgba(255,255,255,0.06)'}`,
                                }}
                              >
                                <cmd.icon size={15} style={{ color: isActive ? cmd.color : '#64748b' }} />
                              </div>

                              {/* Label + description */}
                              <div className="flex-1 min-w-0">
                                <p className="text-[13px] font-medium text-white truncate">
                                  <Highlight text={cmd.label} query={query} />
                                </p>
                                <p className="text-[11px] text-slate-500 truncate">{cmd.description}</p>
                              </div>

                              {/* Category badge */}
                              <span
                                className="shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded-md uppercase tracking-wide"
                                style={{
                                  background: `${meta.color}12`,
                                  color: isActive ? meta.color : '#475569',
                                  border: `1px solid ${isActive ? meta.color + '30' : 'transparent'}`,
                                }}
                              >
                                {cat === 'navigate' ? '\u2197' : '\u26A1'}
                              </span>

                              {/* Arrow on active */}
                              {isActive && (
                                <ArrowRight size={13} style={{ color: cmd.color }} className="shrink-0" />
                              )}
                            </motion.button>
                          );
                        })}
                      </div>
                    );
                  })}

                  {/* Search results section */}
                  {searchResults.length > 0 && (
                    <div className="mb-1">
                      <div className="flex items-center gap-2 px-4 py-1.5">
                        <span
                          className="text-[9px] font-bold uppercase tracking-[0.14em]"
                          style={{ color: CATEGORY_META.search.color }}
                        >
                          {CATEGORY_META.search.label}
                        </span>
                        <div className="flex-1 h-px" style={{ background: `${CATEGORY_META.search.color}20` }} />
                      </div>

                      {searchResults.slice(0, 8).map((sr, localIdx) => {
                        const globalIdx = getSearchGlobalIndex(sr, localIdx);
                        const isActive = globalIdx === activeIdx;
                        const srColor = '#a78bfa';
                        return (
                          <motion.button
                            key={`sr-${sr.id}-${localIdx}`}
                            onClick={() => executeItem({ type: 'search', data: sr })}
                            onMouseEnter={() => setActiveIdx(globalIdx)}
                            className="relative w-full flex items-center gap-3 px-4 py-2.5 text-left transition-all cursor-pointer"
                            style={{
                              background: isActive ? 'rgba(255,255,255,0.05)' : 'transparent',
                            }}
                          >
                            {isActive && (
                              <motion.span
                                layoutId="palette-active"
                                className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-7 rounded-r-full"
                                style={{ background: srColor, boxShadow: `0 0 8px ${srColor}60` }}
                                transition={{ duration: 0.15 }}
                              />
                            )}

                            <div
                              className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                              style={{
                                background: isActive ? `${srColor}18` : 'rgba(255,255,255,0.04)',
                                border: `1px solid ${isActive ? srColor + '30' : 'rgba(255,255,255,0.06)'}`,
                              }}
                            >
                              <BookOpen size={15} style={{ color: isActive ? srColor : '#64748b' }} />
                            </div>

                            <div className="flex-1 min-w-0">
                              <p className="text-[13px] font-medium text-white truncate">
                                <Highlight text={sr.title} query={query} />
                              </p>
                              <p className="text-[11px] text-slate-500 truncate">
                                {sr.source}{sr.department ? ` / ${sr.department}` : ''}
                              </p>
                            </div>

                            <span
                              className="shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded-md uppercase tracking-wide"
                              style={{
                                background: `${srColor}12`,
                                color: isActive ? srColor : '#475569',
                                border: `1px solid ${isActive ? srColor + '30' : 'transparent'}`,
                              }}
                            >
                              {sr.source}
                            </span>

                            {isActive && (
                              <ArrowRight size={13} style={{ color: srColor }} className="shrink-0" />
                            )}
                          </motion.button>
                        );
                      })}
                    </div>
                  )}

                  {/* Searching indicator */}
                  {searching && (
                    <div className="px-4 py-2 text-center">
                      <span className="text-[11px] text-slate-600">Searching documents...</span>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Footer hint */}
            <div
              className="flex items-center justify-between px-4 py-2.5"
              style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}
            >
              <div className="flex items-center gap-3">
                {[
                  { keys: ['\u2191', '\u2193'], label: 'navigate' },
                  { keys: ['\u21B5'], label: 'select' },
                  { keys: ['esc'], label: 'close' },
                ].map(({ keys, label }) => (
                  <div key={label} className="flex items-center gap-1">
                    {keys.map((k) => (
                      <kbd
                        key={k}
                        className="px-1.5 py-0.5 rounded text-[10px] font-mono text-slate-600"
                        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
                      >
                        {k}
                      </kbd>
                    ))}
                    <span className="text-[10px] text-slate-700 ml-0.5">{label}</span>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-1.5">
                <BookOpen size={10} className="text-slate-700" />
                <span className="text-[10px] text-slate-700">{allItems.length} items</span>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
