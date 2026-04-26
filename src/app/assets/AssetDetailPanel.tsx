'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  Clock,
  Eye,
  Compass,
  CircuitBoard,
  Sparkles,
  Shield,
  Layers,
  BookOpen,
  Send,
  MessageSquare,
  StickyNote,
  Activity,
  Link2,
  ChevronDown,
} from 'lucide-react';

/* -- Types -- */

interface AssetEvent {
  id: string;
  assetId: string;
  type: string;
  summary: string;
  metadata: string | null;
  agentId: string | null;
  createdAt: string;
}

interface LinkedTask {
  id: string;
  title: string;
  state: string;
  department: string;
  executorAgentId: string | null;
  createdAt: string;
}

interface AssetDetail {
  id: string;
  title: string;
  description: string | null;
  category: string;
  maturity: string;
  stewardId: string | null;
  returnFactors: string | null;
  annotations: string | null;
  healthStatus: string;
  directoryPath: string | null;
  createdAt: string;
  updatedAt: string;
  events: AssetEvent[];
  locations: { id: string; type: string; value: string; label: string | null; isCanonical: boolean }[];
  dependsOn: { id: string; targetId: string; targetTitle: string; label: string | null }[];
  dependedBy: { id: string; sourceId: string; sourceTitle: string; label: string | null }[];
  linkedTasks: LinkedTask[];
  rippleCount: number;
}

interface AssetDetailPanelProps {
  assetId: string;
  onClose: () => void;
  onAssetUpdated: () => void;
}

interface StewardLogEntry {
  id: number;
  badge: string;
  badgeClass: string;
  text: string;
  timestamp: string;
}

/* -- Constants -- */

const MATURITY_LEVELS = ['nascent', 'developing', 'established', 'foundational', 'legacy', 'heritage'] as const;

type TabId = 'past' | 'present' | 'future';

const TABS: { id: TabId; label: string; icon: React.ElementType }[] = [
  { id: 'past', label: 'Past', icon: Clock },
  { id: 'present', label: 'Present', icon: Eye },
  { id: 'future', label: 'Future', icon: Compass },
];

const CATEGORY_ACCENT: Record<string, { color: string; bg: string; icon: React.ElementType }> = {
  code: { color: 'text-blue-400', bg: 'bg-blue-500/15', icon: CircuitBoard },
  brand: { color: 'text-purple-400', bg: 'bg-purple-500/15', icon: Sparkles },
  IP: { color: 'text-amber-400', bg: 'bg-amber-500/15', icon: Shield },
  'digital-product': { color: 'text-sky-400', bg: 'bg-sky-500/15', icon: Layers },
  knowledge: { color: 'text-emerald-400', bg: 'bg-emerald-500/15', icon: BookOpen },
};

const EVENT_TYPE_COLORS: Record<string, string> = {
  creation: 'bg-emerald-400',
  promotion: 'bg-purple-400',
  steward_assessment: 'bg-blue-400',
  maturity_change: 'bg-amber-400',
  annotation: 'bg-violet-400',
  location_added: 'bg-slate-400',
  dependency_added: 'bg-slate-400',
};

const HEALTH_CONFIG: Record<string, { dot: string; label: string }> = {
  healthy: { dot: 'bg-emerald-400', label: 'Active and maintained' },
  stale: { dot: 'bg-amber-400', label: 'Stale -- needs attention' },
  degraded: { dot: 'bg-rose-400', label: 'Degraded' },
  critical: { dot: 'bg-rose-500', label: 'Critical' },
};

const TASK_STATE_COLORS: Record<string, string> = {
  submitted: 'bg-blue-500/15 text-blue-400',
  working: 'bg-amber-500/15 text-amber-400',
  'input-required': 'bg-violet-500/15 text-violet-400',
  completed: 'bg-emerald-500/15 text-emerald-400',
  failed: 'bg-rose-500/15 text-rose-400',
  canceled: 'bg-slate-500/15 text-slate-400',
};

const AGENT_LABELS: Record<string, string> = {
  cto: 'CTO',
  cmo: 'CMO',
  coo: 'COO',
  tamir: 'Tamir',
};

/* -- Component -- */

export default function AssetDetailPanel({ assetId, onClose, onAssetUpdated }: AssetDetailPanelProps) {
  const [asset, setAsset] = useState<AssetDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabId>('present');
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState<Array<{ role: 'user' | 'steward'; text: string }>>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [stewardLog, setStewardLog] = useState<StewardLogEntry[]>([]);
  const [maturityOpen, setMaturityOpen] = useState(false);
  const [annotationText, setAnnotationText] = useState('');
  const [submittingAnnotation, setSubmittingAnnotation] = useState(false);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const logIdRef = useRef(0);

  /* -- Data fetching -- */

  const fetchAsset = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/assets/${assetId}`);
      if (res.ok) setAsset(await res.json());
    } catch { /* silently fail */ }
    finally { setLoading(false); }
  }, [assetId]);

  useEffect(() => { fetchAsset(); }, [fetchAsset]);

  /* -- Escape key -- */

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  /* -- Auto-scroll chat -- */

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chatMessages.length, stewardLog.length]);

  /* -- Steward label -- */

  const stewardLabel = asset?.stewardId
    ? `${AGENT_LABELS[asset.stewardId] || asset.stewardId.toUpperCase()} (Steward)`
    : 'Steward';

  /* -- Log helpers -- */

  const addLogEntry = (badge: string, badgeClass: string, text: string) => {
    const id = ++logIdRef.current;
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setStewardLog(prev => {
      const next = [...prev, { id, badge, badgeClass, text, timestamp }];
      return next.slice(-3);
    });
  };

  /* -- Handlers -- */

  const handleMaturityChange = async (level: string) => {
    if (!confirm(`Change maturity to ${level}?`)) return;
    try {
      const res = await fetch(`/api/assets/${assetId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ maturity: level }),
      });
      if (res.ok) {
        setMaturityOpen(false);
        await fetchAsset();
        onAssetUpdated();
      }
    } catch { /* silently fail */ }
  };

  const handleAddAnnotation = async () => {
    if (!annotationText.trim()) return;
    setSubmittingAnnotation(true);
    try {
      const res = await fetch(`/api/assets/${assetId}/annotations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: annotationText.trim() }),
      });
      if (res.ok) {
        setAnnotationText('');
        await fetchAsset();
        onAssetUpdated();
      }
    } catch { /* silently fail */ }
    finally { setSubmittingAnnotation(false); }
  };

  const handleChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || chatLoading) return;
    const msg = chatInput.trim();
    setChatInput('');
    setChatMessages(prev => [...prev, { role: 'user', text: msg }]);
    setChatLoading(true);

    addLogEntry('SESSION', 'log-type-session', `Invoking ${stewardLabel} for asset context...`);

    const toolTimeout = setTimeout(() => {
      addLogEntry('TOOL', 'log-type-tool', 'Reading asset health, events, and dependencies...');
    }, 800);

    const thinkTimeout = setTimeout(() => {
      addLogEntry('THINKING', 'log-type-assistant', 'Generating steward assessment...');
    }, 2000);

    try {
      const res = await fetch(`/api/assets/${assetId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg }),
      });
      const data = await res.json();
      clearTimeout(toolTimeout);
      clearTimeout(thinkTimeout);

      addLogEntry('DONE', 'log-type-success', 'Assessment complete');
      setChatMessages(prev => [...prev, { role: 'steward', text: data.response || 'No response' }]);

      await fetchAsset();
      onAssetUpdated();
    } catch {
      clearTimeout(toolTimeout);
      clearTimeout(thinkTimeout);
      addLogEntry('ERROR', 'log-type-error', 'Steward invocation failed');
      setChatMessages(prev => [...prev, { role: 'steward', text: 'Failed to reach steward.' }]);
    }
    setChatLoading(false);
  };

  /* -- Loading -- */

  if (loading) {
    return (
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className="fixed right-0 top-0 w-[420px] h-screen z-50 glass-panel overflow-y-auto p-5"
        style={{ borderLeft: '1px solid var(--border-subtle)' }}
      >
        <button onClick={onClose} className="absolute top-3 right-3 p-1.5 rounded-lg hover:bg-white/5 text-[var(--text-dim)] cursor-pointer">
          <X className="w-4 h-4" />
        </button>
        <div className="flex flex-col gap-3 mt-10">
          {[200, 150, 180].map((w, i) => (
            <div key={i} className="h-4 rounded bg-white/5 animate-pulse" style={{ width: w }} />
          ))}
        </div>
      </motion.div>
    );
  }

  if (!asset) {
    return (
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className="fixed right-0 top-0 w-[420px] h-screen z-50 glass-panel overflow-y-auto p-5"
        style={{ borderLeft: '1px solid var(--border-subtle)' }}
      >
        <button onClick={onClose} className="absolute top-3 right-3 p-1.5 rounded-lg hover:bg-white/5 text-[var(--text-dim)] cursor-pointer">
          <X className="w-4 h-4" />
        </button>
        <p className="text-[var(--text-dim)] mt-10">Failed to load asset.</p>
      </motion.div>
    );
  }

  /* -- Derived data -- */

  const catCfg = CATEGORY_ACCENT[asset.category] || CATEGORY_ACCENT.code;
  const CatIcon = catCfg.icon;
  const healthCfg = HEALTH_CONFIG[asset.healthStatus] || HEALTH_CONFIG.healthy;
  const recentEvents = [...asset.events]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 10);
  const annotations: { text: string; createdAt: string }[] = asset.annotations ? JSON.parse(asset.annotations) : [];

  return (
    <motion.div
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
      className="fixed right-0 top-0 w-[420px] h-screen z-50 glass-panel overflow-y-auto"
      style={{ borderLeft: '1px solid var(--border-subtle)' }}
    >
      <div className="p-5 pb-8">
        {/* -- Close -- */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 p-1.5 rounded-lg hover:bg-white/5 text-[var(--text-dim)] cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        {/* -- Header -- */}
        <div className="mb-5">
          <div className="flex items-center gap-2 mb-2">
            <div className={`w-6 h-6 rounded-md ${catCfg.bg} flex items-center justify-center`}>
              <CatIcon className={`w-3.5 h-3.5 ${catCfg.color}`} />
            </div>
            <span className={`glass-pill px-2 py-0.5 text-[10px] font-semibold uppercase ${catCfg.color}`}>
              {asset.category}
            </span>
            {asset.stewardId && (
              <span className="glass-pill px-2 py-0.5 text-[10px] font-medium text-[var(--text-dim)]">
                {stewardLabel}
              </span>
            )}
          </div>
          <h2 className="text-lg font-bold text-white pr-8">{asset.title}</h2>
          {asset.description && (
            <p className="text-xs text-[var(--text-dim)] mt-1 leading-relaxed">{asset.description}</p>
          )}
        </div>

        {/* -- Tab Bar -- */}
        <div className="flex gap-1 mb-5">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`glass-pill flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-all cursor-pointer ${
                  isActive
                    ? 'text-white ring-1 ring-white/20'
                    : 'text-[var(--text-dim)] hover:text-white'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* -- Tab Content -- */}
        <AnimatePresence mode="wait">
          {activeTab === 'past' && (
            <motion.div
              key="past"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              transition={{ duration: 0.15 }}
              className="space-y-4"
            >
              <SectionTitle icon={Activity} label="Event Timeline" />
              {recentEvents.length === 0 ? (
                <p className="text-[var(--text-dim)] text-xs italic">No activity recorded yet</p>
              ) : (
                <div className="space-y-2">
                  {recentEvents.map((ev) => (
                    <div key={ev.id} className="glass-card rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`w-2 h-2 rounded-full ${EVENT_TYPE_COLORS[ev.type] || 'bg-slate-400'}`} />
                        <span className="text-[10px] font-semibold text-white uppercase">
                          {ev.type.replace(/_/g, ' ')}
                        </span>
                        <span className="text-[10px] text-[var(--text-dim)] ml-auto">
                          {new Date(ev.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-xs text-[var(--text-dim)] truncate">{ev.summary}</p>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {activeTab === 'present' && (
            <motion.div
              key="present"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              transition={{ duration: 0.15 }}
              className="space-y-5"
            >
              {/* Health */}
              <div>
                <SectionTitle icon={Activity} label="Health" />
                <div className="glass-card rounded-lg p-3 flex items-center gap-3">
                  <span className={`w-3 h-3 rounded-full ${healthCfg.dot}`} />
                  <div>
                    <span className="text-sm font-semibold text-white capitalize">{asset.healthStatus}</span>
                    <p className="text-[10px] text-[var(--text-dim)]">{healthCfg.label}</p>
                  </div>
                </div>
              </div>

              {/* Lifecycle / Maturity */}
              <div>
                <SectionTitle icon={ChevronDown} label="Lifecycle" />
                <button
                  onClick={() => setMaturityOpen(!maturityOpen)}
                  className="glass-card rounded-lg px-3 py-2 w-full text-left text-sm text-white flex items-center justify-between cursor-pointer"
                >
                  <span className="capitalize">{asset.maturity}</span>
                  <ChevronDown className={`w-4 h-4 text-[var(--text-dim)] transition-transform ${maturityOpen ? 'rotate-180' : ''}`} />
                </button>
                <AnimatePresence>
                  {maturityOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="glass-card rounded-lg mt-1 p-1 space-y-0.5">
                        {MATURITY_LEVELS.map((level) => (
                          <button
                            key={level}
                            onClick={() => handleMaturityChange(level)}
                            disabled={level === asset.maturity}
                            className={`w-full text-left px-3 py-1.5 rounded text-xs cursor-pointer transition-colors ${
                              level === asset.maturity
                                ? 'bg-white/10 text-[var(--text-dim)]'
                                : 'text-white hover:bg-white/5'
                            }`}
                          >
                            {level}
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Annotations */}
              <div>
                <SectionTitle icon={StickyNote} label="Annotations" />
                {annotations.length > 0 && (
                  <div className="space-y-2 mb-3">
                    {annotations.map((ann, i) => (
                      <div key={i} className="glass-card rounded-lg p-3">
                        <p className="text-xs text-white">{ann.text}</p>
                        <span className="text-[10px] text-[var(--text-dim)] mt-1 block">
                          {new Date(ann.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={annotationText}
                    onChange={(e) => setAnnotationText(e.target.value)}
                    placeholder="Add a note..."
                    onKeyDown={(e) => { if (e.key === 'Enter') handleAddAnnotation(); }}
                    className="flex-1 bg-transparent border border-[var(--border-subtle)] rounded-lg px-3 py-2 text-xs text-white placeholder-[var(--text-dim)] outline-none focus:ring-1 focus:ring-white/10"
                  />
                  <button
                    onClick={handleAddAnnotation}
                    disabled={submittingAnnotation || !annotationText.trim()}
                    className="glass-pill px-3 py-2 text-xs font-medium text-white disabled:opacity-40 cursor-pointer"
                  >
                    Add
                  </button>
                </div>
              </div>

              {/* Linked Tasks */}
              <div>
                <SectionTitle icon={Link2} label="Linked Tasks" />
                {(!asset.linkedTasks || asset.linkedTasks.length === 0) ? (
                  <p className="text-[var(--text-dim)] text-xs italic">No linked tasks</p>
                ) : (
                  <div className="space-y-1.5">
                    {asset.linkedTasks.map((task) => {
                      const stateStyle = TASK_STATE_COLORS[task.state] || 'bg-slate-500/15 text-slate-400';
                      return (
                        <div key={task.id} className="glass-card rounded-lg px-3 py-2 flex items-center gap-2">
                          <span className="text-xs text-white flex-1 truncate">{task.title}</span>
                          <span className={`glass-pill px-2 py-0.5 text-[10px] font-semibold ${stateStyle}`}>
                            {task.state}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {activeTab === 'future' && (
            <motion.div
              key="future"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              transition={{ duration: 0.15 }}
              className="space-y-5"
            >
              {/* Dependencies */}
              <div>
                <SectionTitle icon={Link2} label="Dependencies" />
                {asset.dependsOn.length === 0 && asset.dependedBy.length === 0 ? (
                  <p className="text-[var(--text-dim)] text-xs italic">No dependencies</p>
                ) : (
                  <div className="space-y-2">
                    {asset.dependsOn.map((dep) => (
                      <div key={dep.id} className="glass-card rounded-lg px-3 py-2 text-xs">
                        <span className="text-[var(--text-dim)]">Depends on: </span>
                        <span className="text-white font-medium">{dep.targetTitle}</span>
                        {dep.label && <span className="text-[var(--text-dim)]"> ({dep.label})</span>}
                      </div>
                    ))}
                    {asset.dependedBy.map((dep) => (
                      <div key={dep.id} className="glass-card rounded-lg px-3 py-2 text-xs">
                        <span className="text-[var(--text-dim)]">Required by: </span>
                        <span className="text-white font-medium">{dep.sourceTitle}</span>
                        {dep.label && <span className="text-[var(--text-dim)]"> ({dep.label})</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Steward Chat */}
              <div>
                <SectionTitle icon={MessageSquare} label="Steward Chat" />

                {/* Steward activity log */}
                {stewardLog.length > 0 && (
                  <div className="mb-3 space-y-1">
                    {stewardLog.map((entry) => (
                      <div key={entry.id} className="glass-card rounded px-2.5 py-1.5 flex items-center gap-2 text-[10px]">
                        <span className="font-bold text-amber-400">{entry.badge}</span>
                        <span className="text-[var(--text-dim)] flex-1 truncate">{entry.text}</span>
                        <span className="text-[var(--text-dim)] shrink-0">{entry.timestamp}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Chat messages */}
                <div ref={chatContainerRef} className="max-h-[200px] overflow-y-auto mb-3 space-y-2.5">
                  {chatMessages.map((msg, i) => (
                    <div key={i} className="text-xs">
                      <span className={`font-bold ${msg.role === 'user' ? 'text-purple-400' : 'text-emerald-400'}`}>
                        {msg.role === 'user' ? 'You' : stewardLabel}:
                      </span>{' '}
                      <span className="text-white">{msg.text}</span>
                    </div>
                  ))}
                  {chatLoading && chatMessages[chatMessages.length - 1]?.role === 'user' && (
                    <div className="text-xs text-[var(--text-dim)] italic">
                      {stewardLabel} is thinking...
                    </div>
                  )}
                </div>

                {/* Chat input */}
                <form onSubmit={handleChat} className="flex gap-2">
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder={asset?.stewardId ? `Ask ${stewardLabel}...` : 'No steward assigned'}
                    disabled={chatLoading || !asset?.stewardId}
                    className="flex-1 bg-transparent border border-[var(--border-subtle)] rounded-lg px-3 py-2 text-xs text-white placeholder-[var(--text-dim)] outline-none focus:ring-1 focus:ring-white/10 disabled:opacity-40"
                  />
                  <button
                    type="submit"
                    disabled={chatLoading || !chatInput.trim()}
                    className="glass-pill p-2 text-white disabled:opacity-40 cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </form>
                {!asset?.stewardId && (
                  <p className="text-[10px] text-[var(--text-dim)] mt-1">No steward assigned. Assign one to enable chat.</p>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

/* -- Sub-components -- */

function SectionTitle({ icon: Icon, label }: { icon: React.ElementType; label: string }) {
  return (
    <div className="flex items-center gap-2 mb-2">
      <Icon className="w-3.5 h-3.5 text-[var(--text-dim)]" />
      <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-dim)]">{label}</span>
    </div>
  );
}
