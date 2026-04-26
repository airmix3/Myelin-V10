'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { marked } from 'marked';
import Link from 'next/link';
import { motion, AnimatePresence } from 'motion/react';
import { Users, Brain, BookOpen, Zap, Wrench, X, ChevronDown, ChevronRight, Plus, RefreshCw, Trash2 } from 'lucide-react';
import DepartmentTabRail from '@/components/deliverables/DepartmentTabRail';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface TaskPreview {
  id: string;
  title: string;
  state: string;
  createdAt: string;
}

interface EmployeeData {
  id: string;
  name: string;
  role: string;
  department: string;
  agentId: string | null;
  status: string;
  budgetLimit: number;
  budgetSpent: number;
  tasks: TaskPreview[];
}

interface SkillData {
  id: string;
  name: string;
  department: string;
  description: string | null;
  status: string;
  filePath: string | null;
  proposedBy: string | null;
}

interface KnowledgeFile {
  name: string;
  content: string;
}

interface DeptTool {
  name: string;
  directory: string;
  description?: string;
}

interface DeptData {
  employees: EmployeeData[];
  agentMemories: Record<string, string>;
  agentCards: Record<string, unknown>;
  knowledgeFiles: KnowledgeFile[];
  skills: SkillData[];
  tools: DeptTool[];
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const DEPARTMENTS = ['tech', 'marketing', 'operations'];

const DEPT_ACCENT: Record<string, string> = {
  tech: 'rgb(14,165,233)',
  marketing: 'rgb(139,92,246)',
  operations: 'rgb(16,185,129)',
};

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function renderMarkdown(md: string): string {
  return marked.parse(md, { async: false }) as string;
}

function skillStatusColor(status: string): string {
  switch (status) {
    case 'active': return 'text-emerald-400 bg-emerald-500/15 border-emerald-500/25';
    case 'approved': return 'text-blue-400 bg-blue-500/15 border-blue-500/25';
    case 'pending': return 'text-amber-400 bg-amber-500/15 border-amber-500/25';
    case 'dismissed': return 'text-red-400 bg-red-500/15 border-red-500/25';
    default: return 'text-slate-400 bg-slate-500/15 border-slate-500/25';
  }
}

function statusDot(status: string): string {
  if (status === 'active') return 'bg-emerald-400';
  if (status === 'idle') return 'bg-amber-400';
  return 'bg-slate-500';
}

/* ------------------------------------------------------------------ */
/*  Stagger animation helpers                                          */
/* ------------------------------------------------------------------ */

const sectionVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, duration: 0.35, ease: 'easeOut' as const },
  }),
};

/* ------------------------------------------------------------------ */
/*  Glass Modal                                                        */
/* ------------------------------------------------------------------ */

function GlassModal({ open, onClose, title, children }: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-start justify-center"
          onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.2 }}
            className="glass-card rounded-2xl p-6 max-w-md w-full mx-4 mt-[20vh]"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-slate-200">{title}</h3>
              <button
                onClick={onClose}
                className="p-1 rounded-lg hover:bg-white/5 transition-colors"
              >
                <X size={16} className="text-slate-400" />
              </button>
            </div>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ------------------------------------------------------------------ */
/*  Section wrapper                                                    */
/* ------------------------------------------------------------------ */

function Section({ icon: Icon, title, index, count, children, action }: {
  icon: React.ElementType;
  title: string;
  index: number;
  count?: number;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <motion.div
      custom={index}
      initial="hidden"
      animate="visible"
      variants={sectionVariants}
      className="glass-card rounded-xl p-4"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Icon size={16} className="text-slate-400" />
          <h2 className="text-sm font-semibold text-slate-200">
            {title}
            {count !== undefined && (
              <span className="ml-1.5 text-xs font-normal text-slate-500">({count})</span>
            )}
          </h2>
        </div>
        {action}
      </div>
      {children}
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */

export default function OrgContextClient({ defaultDept }: { defaultDept: string }) {
  const [activeDept, setActiveDept] = useState(defaultDept);
  const [data, setData] = useState<DeptData | null>(null);
  const [loading, setLoading] = useState(true);

  /* Expandable state */
  const [expandedMemories, setExpandedMemories] = useState<Set<string>>(new Set());
  const [expandedKnowledge, setExpandedKnowledge] = useState<Set<string>>(new Set());

  /* Skill actions */
  const [dismissConfirm, setDismissConfirm] = useState<string | null>(null);
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  /* Modals */
  const [showCreateSkill, setShowCreateSkill] = useState(false);
  const [createSkillText, setCreateSkillText] = useState('');
  const [createSkillLoading, setCreateSkillLoading] = useState(false);
  const [showInstallTool, setShowInstallTool] = useState(false);
  const [installToolPackage, setInstallToolPackage] = useState('');
  const [installToolHint, setInstallToolHint] = useState('');
  const [installToolLoading, setInstallToolLoading] = useState(false);

  /* Data fetching */
  const fetchData = useCallback(async (dept: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/org-context/${dept}`);
      if (res.ok) setData(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData(activeDept);
  }, [activeDept, fetchData]);

  const refreshData = useCallback(() => fetchData(activeDept), [activeDept, fetchData]);

  /* Toggle helpers */
  function toggleSet(set: Set<string>, key: string, setter: (s: Set<string>) => void) {
    const next = new Set(set);
    if (next.has(key)) next.delete(key); else next.add(key);
    setter(next);
  }

  /* Department tab change */
  function handleDeptChange(dept: string) {
    if (dept === 'all') return; // no "all" tab for org-context
    setActiveDept(dept);
    setExpandedMemories(new Set());
    setExpandedKnowledge(new Set());
  }

  /* ---- Skill actions ---- */

  async function handleSkillAction(skillId: string, action: 'approve' | 'submit-to-ceo' | 'dismiss') {
    if (action === 'dismiss' && dismissConfirm !== skillId) {
      setDismissConfirm(skillId);
      if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
      dismissTimerRef.current = setTimeout(() => setDismissConfirm(null), 3000);
      return;
    }
    setActionLoading(`skill-${action}-${skillId}`);
    try {
      const res = await fetch(`/api/skills/${skillId}/${action}`, { method: 'POST' });
      if (res.ok) await refreshData();
    } finally {
      setActionLoading(null);
      setDismissConfirm(null);
    }
  }

  async function handleCreateSkill() {
    setCreateSkillLoading(true);
    try {
      const res = await fetch(`/api/org-context/${activeDept}/skills/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: createSkillText }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        alert((errData as Record<string, string>).error || 'Failed to create skill');
        return;
      }
      setShowCreateSkill(false);
      setCreateSkillText('');
      await refreshData();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to create skill');
    } finally {
      setCreateSkillLoading(false);
    }
  }

  async function handleInstallTool() {
    setInstallToolLoading(true);
    try {
      const res = await fetch(`/api/org-context/${activeDept}/tools/install`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packageName: installToolPackage, hint: installToolHint }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        alert((errData as Record<string, string>).error || 'Failed to install tool');
        return;
      }
      setShowInstallTool(false);
      setInstallToolPackage('');
      setInstallToolHint('');
      await refreshData();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to install tool');
    } finally {
      setInstallToolLoading(false);
    }
  }

  /* ------------------------------------------------------------------ */
  /*  Render                                                             */
  /* ------------------------------------------------------------------ */

  const accent = DEPT_ACCENT[activeDept] || DEPT_ACCENT.tech;

  return (
    <div className="flex flex-col gap-4" style={{ margin: '-24px', padding: '0 20px 20px' }}>
      {/* Page header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '6px 0 2px', height: '44px',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
      }}>
        <h1 className="text-sm font-semibold text-white">Org Context</h1>
      </div>

      {/* Department tabs -- no "All" tab for org-context */}
      <DepartmentTabRail
        departments={DEPARTMENTS}
        active={activeDept}
        onSelect={handleDeptChange}
      />

      {/* Loading state */}
      {loading && (
        <div className="glass-card rounded-xl p-8 flex items-center justify-center">
          <div className="text-sm text-slate-500">Loading department data...</div>
        </div>
      )}

      {/* Content */}
      {!loading && data && (
        <div className="flex flex-col gap-4">

          {/* A. Employees section */}
          <Section icon={Users} title="Employees" index={0} count={data.employees.length}>
            {data.employees.length === 0 ? (
              <p className="text-xs text-slate-500">No employees in this department.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {data.employees.map((emp) => (
                  <div
                    key={emp.id}
                    className="glass-deep rounded-lg p-3 flex items-center gap-3 hover:border-white/10 transition-colors"
                    style={{ border: '1px solid rgba(255,255,255,0.04)' }}
                  >
                    {/* Avatar */}
                    <div
                      className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                      style={{ background: accent }}
                    >
                      {emp.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        {emp.agentId ? (
                          <Link
                            href={`/agents/${emp.agentId}`}
                            className="text-xs font-semibold text-slate-200 hover:text-white transition-colors truncate"
                          >
                            {emp.name}
                          </Link>
                        ) : (
                          <span className="text-xs font-semibold text-slate-200 truncate">{emp.name}</span>
                        )}
                        <span className={`w-2 h-2 rounded-full shrink-0 ${statusDot(emp.status)}`} />
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5 truncate">{emp.role}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Section>

          {/* B. Agent Memories section */}
          <Section icon={Brain} title="Agent Memories" index={1} count={Object.keys(data.agentMemories).length}>
            {data.employees.filter(e => e.agentId).length === 0 ? (
              <p className="text-xs text-slate-500">No agents in this department.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {data.employees.filter(e => e.agentId).map((emp) => {
                  const memory = emp.agentId ? data.agentMemories[emp.agentId] : null;
                  const expanded = emp.agentId ? expandedMemories.has(emp.agentId) : false;
                  return (
                    <div key={emp.id} className="glass-deep rounded-lg overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.04)' }}>
                      <button
                        className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-white/[0.02] transition-colors"
                        onClick={() => emp.agentId && toggleSet(expandedMemories, emp.agentId, setExpandedMemories)}
                      >
                        {expanded
                          ? <ChevronDown size={14} className="text-slate-500 shrink-0" />
                          : <ChevronRight size={14} className="text-slate-500 shrink-0" />
                        }
                        <span className="text-xs font-semibold text-slate-300">{emp.name}</span>
                        {!memory && <span className="text-[10px] text-slate-600 ml-auto">no memory</span>}
                      </button>
                      <AnimatePresence>
                        {expanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="overflow-hidden"
                          >
                            {memory ? (
                              <div
                                className="px-3 pb-3 text-xs text-slate-400 prose prose-invert prose-xs max-w-none [&_h1]:text-sm [&_h2]:text-xs [&_h3]:text-xs [&_p]:text-xs [&_li]:text-xs [&_code]:text-[11px]"
                                dangerouslySetInnerHTML={{ __html: renderMarkdown(memory) }}
                              />
                            ) : (
                              <p className="px-3 pb-3 text-xs text-slate-600">No memory recorded yet.</p>
                            )}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })}
              </div>
            )}
          </Section>

          {/* C. Knowledge Library section */}
          <Section icon={BookOpen} title="Knowledge Library" index={2} count={data.knowledgeFiles.length}>
            {data.knowledgeFiles.length === 0 ? (
              <div>
                <p className="text-xs text-slate-500">No knowledge articles</p>
                <p className="text-[11px] text-slate-600 mt-1">Agents write knowledge articles as they complete tasks.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {data.knowledgeFiles.map((kf) => {
                  const expanded = expandedKnowledge.has(kf.name);
                  return (
                    <div key={kf.name} className="glass-deep rounded-lg overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.04)' }}>
                      <button
                        className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-white/[0.02] transition-colors"
                        onClick={() => toggleSet(expandedKnowledge, kf.name, setExpandedKnowledge)}
                      >
                        {expanded
                          ? <ChevronDown size={14} className="text-slate-500 shrink-0" />
                          : <ChevronRight size={14} className="text-slate-500 shrink-0" />
                        }
                        <span className="text-xs font-semibold text-slate-300">{kf.name}</span>
                      </button>
                      <AnimatePresence>
                        {expanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="overflow-hidden"
                          >
                            <div
                              className="px-3 pb-3 text-xs text-slate-400 prose prose-invert prose-xs max-w-none [&_h1]:text-sm [&_h2]:text-xs [&_h3]:text-xs [&_p]:text-xs [&_li]:text-xs [&_code]:text-[11px]"
                              dangerouslySetInnerHTML={{ __html: renderMarkdown(kf.content) }}
                            />
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })}
              </div>
            )}
          </Section>

          {/* D. Skills section */}
          <Section
            icon={Zap}
            title="Skills"
            index={3}
            count={data.skills.length}
            action={
              <button
                onClick={() => setShowCreateSkill(true)}
                className="glass-pill flex items-center gap-1.5 px-3 text-xs font-semibold transition-colors hover:bg-white/5"
                style={{ height: 30, border: '1px solid rgba(255,255,255,0.08)', color: accent }}
              >
                <Plus size={13} />
                Create Skill
              </button>
            }
          >
            {data.skills.length === 0 ? (
              <div>
                <p className="text-xs text-slate-500">No skills installed</p>
                <p className="text-[11px] text-slate-600 mt-1">Skills are proposed by agents after completing tasks and approved by department heads.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {data.skills.map((skill) => (
                  <div
                    key={skill.id}
                    className="glass-deep rounded-lg p-3 relative"
                    style={{ border: '1px solid rgba(255,255,255,0.04)' }}
                  >
                    {/* Action icons for approved/active skills */}
                    {(skill.status === 'approved' || skill.status === 'active') && (
                      <div className="absolute top-2 right-2 flex gap-1">
                        <button
                          disabled
                          title="Refresh - Coming soon"
                          className="w-6 h-6 rounded-full flex items-center justify-center text-slate-600 cursor-not-allowed opacity-40"
                          style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
                        >
                          <RefreshCw size={11} />
                        </button>
                        <button
                          disabled
                          title="Remove - Coming soon"
                          className="w-6 h-6 rounded-full flex items-center justify-center text-slate-600 cursor-not-allowed opacity-40"
                          style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
                        >
                          <Trash2 size={11} />
                        </button>
                      </div>
                    )}

                    {/* Skill icon */}
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold mb-2"
                      style={{ background: accent }}
                    >
                      {skill.name.charAt(0).toUpperCase()}
                    </div>

                    <div className="text-xs font-semibold text-slate-200 mb-1 pr-14">{skill.name}</div>
                    {skill.description && (
                      <p className="text-[11px] text-slate-500 mb-2 line-clamp-2">{skill.description}</p>
                    )}

                    {/* Status badge */}
                    <span className={`inline-block text-[10px] font-medium px-2 py-0.5 rounded-full border ${skillStatusColor(skill.status)}`}>
                      {skill.status}
                    </span>

                    {/* Proposed skill actions */}
                    {skill.status === 'pending' && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        <button
                          onClick={() => handleSkillAction(skill.id, 'approve')}
                          disabled={actionLoading === `skill-approve-${skill.id}`}
                          className="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 hover:bg-emerald-500/25 transition-colors disabled:opacity-50"
                        >
                          {actionLoading === `skill-approve-${skill.id}` ? 'Approving...' : 'Approve'}
                        </button>
                        <button
                          onClick={() => handleSkillAction(skill.id, 'submit-to-ceo')}
                          disabled={actionLoading === `skill-submit-to-ceo-${skill.id}`}
                          className="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-blue-500/15 text-blue-400 border border-blue-500/25 hover:bg-blue-500/25 transition-colors disabled:opacity-50"
                        >
                          Submit to CEO
                        </button>
                        <button
                          onClick={() => handleSkillAction(skill.id, 'dismiss')}
                          disabled={actionLoading === `skill-dismiss-${skill.id}`}
                          className="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-red-500/15 text-red-400 border border-red-500/25 hover:bg-red-500/25 transition-colors disabled:opacity-50"
                          style={dismissConfirm === skill.id ? { background: 'rgba(239,68,68,0.25)' } : undefined}
                        >
                          {dismissConfirm === skill.id ? 'Confirm Dismiss' : 'Dismiss'}
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Section>

          {/* E. Tools section */}
          <Section
            icon={Wrench}
            title="Tools"
            index={4}
            count={data.tools?.length ?? 0}
            action={
              <button
                onClick={() => setShowInstallTool(true)}
                className="glass-pill flex items-center gap-1.5 px-3 text-xs font-semibold transition-colors hover:bg-white/5"
                style={{ height: 30, border: '1px solid rgba(255,255,255,0.08)', color: accent }}
              >
                <Plus size={13} />
                Install Tool
              </button>
            }
          >
            {(!data.tools || data.tools.length === 0) ? (
              <div>
                <p className="text-xs text-slate-500">No tools installed</p>
                <p className="text-[11px] text-slate-600 mt-1">Tools are MCP servers installed via Smithery for agent use.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {data.tools.map((tool) => (
                  <div
                    key={tool.name}
                    className="glass-deep rounded-lg p-3 relative"
                    style={{ border: '1px solid rgba(255,255,255,0.04)' }}
                  >
                    {/* Disabled action icons */}
                    <div className="absolute top-2 right-2 flex gap-1">
                      <button
                        disabled
                        title="Refresh - Coming soon"
                        className="w-6 h-6 rounded-full flex items-center justify-center text-slate-600 cursor-not-allowed opacity-40"
                        style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
                      >
                        <RefreshCw size={11} />
                      </button>
                      <button
                        disabled
                        title="Remove - Coming soon"
                        className="w-6 h-6 rounded-full flex items-center justify-center text-slate-600 cursor-not-allowed opacity-40"
                        style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>

                    {/* Tool icon */}
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold mb-2 bg-slate-600">
                      {tool.name.charAt(0).toUpperCase()}
                    </div>

                    <div className="text-xs font-semibold text-slate-200 mb-1 pr-14">{tool.name}</div>
                    {tool.description && (
                      <p className="text-[11px] text-slate-500 mb-2 line-clamp-2">{tool.description}</p>
                    )}

                    <span className="inline-block text-[10px] font-medium px-2 py-0.5 rounded-full border text-emerald-400 bg-emerald-500/15 border-emerald-500/25">
                      installed
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Section>
        </div>
      )}

      {/* ---- Create Skill Modal ---- */}
      <GlassModal
        open={showCreateSkill}
        onClose={() => { setShowCreateSkill(false); setCreateSkillText(''); }}
        title="Create Skill"
      >
        <div className="flex flex-col gap-3">
          <label className="text-xs text-slate-400">Describe the skill procedure:</label>
          <textarea
            value={createSkillText}
            onChange={(e) => setCreateSkillText(e.target.value)}
            placeholder="e.g., When researching a competitor, always check their LinkedIn, Crunchbase, and recent news..."
            rows={5}
            className="bg-slate-800/50 border border-slate-600/50 rounded-lg px-3 py-2 text-slate-200 text-sm resize-vertical placeholder:text-slate-600 focus:outline-none focus:border-slate-500/70"
          />
          <p className="text-[11px] text-slate-600">
            Tamir will create a structured skill from your description and propose it for approval.
          </p>
          <div className="flex gap-2 justify-end mt-1">
            <button
              onClick={() => { setShowCreateSkill(false); setCreateSkillText(''); }}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg text-slate-400 hover:text-slate-300 hover:bg-white/5 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleCreateSkill}
              disabled={createSkillText.trim() === '' || createSkillLoading}
              className="text-xs font-semibold px-4 py-1.5 rounded-lg text-white disabled:opacity-40 transition-colors"
              style={{ background: accent }}
            >
              {createSkillLoading ? 'Creating...' : 'Create'}
            </button>
          </div>
        </div>
      </GlassModal>

      {/* ---- Install Tool Modal ---- */}
      <GlassModal
        open={showInstallTool}
        onClose={() => { setShowInstallTool(false); setInstallToolPackage(''); setInstallToolHint(''); }}
        title="Install Tool"
      >
        <div className="flex flex-col gap-3">
          <div>
            <label className="text-xs text-slate-400 mb-1.5 block">Package name:</label>
            <input
              type="text"
              value={installToolPackage}
              onChange={(e) => setInstallToolPackage(e.target.value)}
              placeholder="e.g., @anthropic/mcp-server-github"
              className="w-full bg-slate-800/50 border border-slate-600/50 rounded-lg px-3 py-2 text-slate-200 text-sm placeholder:text-slate-600 focus:outline-none focus:border-slate-500/70"
            />
          </div>
          <div>
            <label className="text-xs text-slate-400 mb-1.5 block">Hint (optional):</label>
            <input
              type="text"
              value={installToolHint}
              onChange={(e) => setInstallToolHint(e.target.value)}
              placeholder="Optional hint for the installer..."
              className="w-full bg-slate-800/50 border border-slate-600/50 rounded-lg px-3 py-2 text-slate-200 text-sm placeholder:text-slate-600 focus:outline-none focus:border-slate-500/70"
            />
          </div>
          <p className="text-[11px] text-slate-600">
            Tamir will install the Smithery MCP server package into this department.
          </p>
          <div className="flex gap-2 justify-end mt-1">
            <button
              onClick={() => { setShowInstallTool(false); setInstallToolPackage(''); setInstallToolHint(''); }}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg text-slate-400 hover:text-slate-300 hover:bg-white/5 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleInstallTool}
              disabled={installToolPackage.trim() === '' || installToolLoading}
              className="text-xs font-semibold px-4 py-1.5 rounded-lg text-white disabled:opacity-40 transition-colors"
              style={{ background: accent }}
            >
              {installToolLoading ? 'Installing...' : 'Install'}
            </button>
          </div>
        </div>
      </GlassModal>
    </div>
  );
}
