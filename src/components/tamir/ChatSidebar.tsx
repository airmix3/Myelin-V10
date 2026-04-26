'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, Search, ChevronLeft, MessageSquare, ClipboardList, Shield, AlertTriangle, FileText } from 'lucide-react';

const monitoringStates = [
  'Scanning missions\u2026',
  'Checking escalation queue\u2026',
  'Reviewing vault updates\u2026',
  'Monitoring department health\u2026',
  'Analyzing blockers\u2026',
];

export interface SidebarItem {
  id: string;
  title: string;
  type: 'conversation' | 'task';
  updatedAt: string;
  linkedTaskId?: string;
  state?: string;
  department?: string;
  preview?: string;
}

const DEPT_COLORS: Record<string, string> = {
  executive: 'text-amber-400',
  tech: 'text-blue-400',
  marketing: 'text-violet-400',
  operations: 'text-emerald-400',
};

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function getDateGroup(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffDays === 0) return 'TODAY';
  if (diffDays === 1) return 'YESTERDAY';
  if (diffDays <= 7) return 'THIS WEEK';
  return 'OLDER';
}

export default function ChatSidebar({
  onSelectThread,
  activeThreadId,
}: {
  onSelectThread: (thread: SidebarItem) => void;
  activeThreadId?: string;
}) {
  const [items, setItems] = useState<SidebarItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function fetchData() {
      try {
        const [convRes, chatRes] = await Promise.all([
          fetch('/api/tamir/conversations'),
          fetch('/api/tamir/chats'),
        ]);

        const convData = convRes.ok ? await convRes.json() : { conversations: [] };
        const chatData = chatRes.ok ? await chatRes.json() : { chats: [] };

        if (cancelled) return;

        const conversations: SidebarItem[] = (convData.conversations ?? []).map(
          (c: { id: string; title: string; updatedAt: string; linkedTaskId?: string }) => ({
            id: c.id,
            title: c.title,
            type: 'conversation' as const,
            updatedAt: c.updatedAt,
            linkedTaskId: c.linkedTaskId,
          })
        );

        const tasks: SidebarItem[] = (chatData.chats ?? []).map(
          (t: { id: string; title: string; state?: string; department?: string; updatedAt: string }) => ({
            id: t.id,
            title: t.title,
            type: 'task' as const,
            updatedAt: t.updatedAt,
            state: t.state,
            department: t.department,
          })
        );

        const merged = [...conversations, ...tasks].sort(
          (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        );

        setItems(merged);
      } catch {
        // silently handle fetch errors
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchData();
    return () => { cancelled = true; };
  }, []);

  // Debounced search filter
  const [debouncedQuery, setDebouncedQuery] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const filteredItems = useMemo(() => {
    if (!debouncedQuery) return items;
    const q = debouncedQuery.toLowerCase();
    return items.filter((item) => item.title.toLowerCase().includes(q));
  }, [items, debouncedQuery]);

  const grouped = useMemo(() => {
    const groups: Record<string, SidebarItem[]> = {};
    const order = ['TODAY', 'YESTERDAY', 'THIS WEEK', 'OLDER'];
    for (const item of filteredItems) {
      const group = getDateGroup(item.updatedAt);
      if (!groups[group]) groups[group] = [];
      groups[group].push(item);
    }
    return order.filter(g => groups[g]?.length).map(g => ({ label: g, items: groups[g] }));
  }, [filteredItems]);

  const handleNewThread = () => {
    onSelectThread({
      id: 'new',
      title: 'New conversation',
      type: 'conversation',
      updatedAt: new Date().toISOString(),
    });
  };

  return (
    <div
      className="w-[260px] h-full flex flex-col shrink-0 overflow-hidden"
      style={{ background: 'rgba(255,255,255,0.02)', borderRight: '1px solid rgba(255,255,255,0.06)' }}
    >
      {/* Header */}
      <div className="px-3 py-3 flex items-center justify-between shrink-0">
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
          onClick={handleNewThread}
          className="flex items-center gap-2 px-3 py-2 rounded-xl text-[13px] font-semibold text-amber-300 cursor-pointer"
          style={{
            background: 'rgba(245,158,11,0.10)',
            border: '1px solid rgba(245,158,11,0.20)',
          }}
        >
          <Plus className="w-4 h-4" />
          New Conversation
        </motion.button>
        <button className="p-1.5 text-slate-500 hover:text-slate-300 transition-colors">
          <ChevronLeft className="w-4 h-4" />
        </button>
      </div>

      {/* Thread list */}
      <div
        className="flex-1 overflow-y-auto px-1.5 space-y-3"
        style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.06) transparent' }}
      >
        {loading ? (
          <div className="text-[11px] text-slate-600 text-center py-4">Loading...</div>
        ) : grouped.length === 0 ? (
          <div className="text-[11px] text-slate-600 text-center py-4">
            No conversations yet
          </div>
        ) : (
          grouped.map(({ label, items: groupItems }) => (
            <div key={label}>
              <div className="text-[10px] font-semibold text-slate-600 uppercase tracking-wider px-3 pt-1 mb-1.5">{label}</div>
              {groupItems.map((item) => {
                const active = item.id === activeThreadId;
                const deptColor = item.department ? DEPT_COLORS[item.department] : undefined;

                return (
                  <button
                    key={item.id}
                    onClick={() => onSelectThread(item)}
                    className={`w-full text-left px-3 py-2.5 rounded-lg transition-all cursor-pointer mb-0.5 ${
                      active ? 'bg-white/5' : 'hover:bg-white/[0.03]'
                    }`}
                    style={
                      active
                        ? { borderLeft: '2px solid rgba(56,189,248,0.7)' }
                        : { borderLeft: '2px solid transparent' }
                    }
                  >
                    <div className={`text-[13px] font-medium truncate ${active ? 'text-white' : 'text-slate-300'}`}>
                      {item.title}
                    </div>
                    <div className="text-[11px] text-slate-600 truncate mt-0.5">
                      {item.preview ?? item.title}
                    </div>
                  </button>
                );
              })}
            </div>
          ))
        )}
      </div>

      {/* Context awareness — matching V2 mock */}
      <ContextAwareness />
    </div>
  );
}

function ContextAwareness() {
  const [monitorIdx, setMonitorIdx] = useState(0);
  const [counts, setCounts] = useState({ missions: 0, escalations: 0, vault: 0 });

  useEffect(() => {
    const iv = setInterval(() => setMonitorIdx((i) => (i + 1) % monitoringStates.length), 3000);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    Promise.all([
      fetch('/api/status-bar').then(r => r.ok ? r.json() : null),
      fetch('/api/vault').then(r => r.ok ? r.json() : null),
    ]).then(([status, vault]) => {
      setCounts({
        missions: status?.tasksCompleted ?? 0,
        escalations: status?.activeAgents ?? 0,
        vault: vault?.entries?.length ?? 0,
      });
    }).catch(() => {});
  }, []);

  const indicators = [
    { icon: Shield, count: counts.missions, color: '#7dd3fc', label: 'Missions' },
    { icon: AlertTriangle, count: counts.escalations, color: '#fda4af', label: 'Escalations' },
    { icon: FileText, count: counts.vault, color: '#c4b5fd', label: 'Vault' },
  ];

  return (
    <div className="px-3 py-3 shrink-0" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
      <div className="rounded-xl px-3 py-2.5" style={{ background: 'rgba(255,255,255,0.03)' }}>
        <div className="flex items-center gap-3 mb-2">
          {indicators.map((item) => (
            <div key={item.label} className="flex items-center gap-1" title={item.label}>
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: item.color, boxShadow: `0 0 4px ${item.color}` }} />
              <span className="text-[11px] font-semibold" style={{ color: item.color }}>{item.count}</span>
            </div>
          ))}
        </div>
        <AnimatePresence mode="wait">
          <motion.div
            key={monitorIdx}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.2 }}
            className="text-[10px] text-slate-600"
          >
            {monitoringStates[monitorIdx]}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
