'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Brain, Shield, Users, BookOpen, Settings, Sparkles,
  Home, AlertTriangle, Layers, Clock, Target, Terminal,
  Pin, PinOff, HelpCircle, Package, X, ChevronLeft, ChevronRight,
  FlaskConical, Compass, PenTool,
} from 'lucide-react';

// -- Nav structure ------------------------------------------------------------

interface NavLink {
  label: string;
  href: string;
  icon: React.ElementType;
}

interface MentalModelPage {
  name: string;
  when: string;
}

interface NavGroup {
  id: string;
  label: string;
  icon: React.ElementType;
  color: string;
  description: string;
  mentalModel: {
    tagline: string;
    explanation: string;
    whenToUse: string;
    pages: MentalModelPage[];
  };
  links: NavLink[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    id: 'desk',
    label: 'CEO Desk',
    icon: Sparkles,
    color: '#f59e0b',
    description: 'Your personal deep-work space. Chat with Tamir, review deliverables.',
    mentalModel: {
      tagline: 'Your private office -- where you think and act.',
      explanation: 'CEO Desk is your personal space. Tamir is your AI chief of staff who briefs you, takes instructions, and initiates work.',
      whenToUse: 'Start your day here. Return here to delegate a new task or review deliverables.',
      pages: [
        { name: 'Tamir', when: 'Morning briefing, quick approvals, launching tasks' },
        { name: 'Deliverables', when: 'Reviewing files, reports, and documents agents produced' },
      ],
    },
    links: [
      { label: 'Tamir', href: '/tamir', icon: Sparkles },
      { label: 'Deliverables', href: '/deliverables', icon: Package },
    ],
  },
  {
    id: 'strategy',
    label: 'Strategy',
    icon: Compass,
    color: '#8b5cf6',
    description: 'Where am I headed? Strategic directions, goals, and the CEO thinking space.',
    mentalModel: {
      tagline: 'Where am I headed? -- Strategic directions, goals, and the CEO thinking space.',
      explanation: 'Strategy is your high-level thinking layer. The Constellation shows all active directions as an orbital map. The Canvas is a whiteboard for thinking with Tamir about what matters.',
      whenToUse: 'Come here when you need to step back and think about where the company is going. Canvas for exploration, Constellation for overview.',
      pages: [
        { name: 'Constellation', when: 'Seeing all active directions, their goals, and how they relate' },
        { name: 'Canvas', when: 'Thinking with Tamir on a whiteboard -- brainstorm, commit directions' },
        { name: 'Priorities', when: 'Managing what is focus, active, or background' },
      ],
    },
    links: [
      { label: 'Constellation', href: '/strategy', icon: Compass },
      { label: 'Canvas', href: '/strategy/canvas', icon: PenTool },
      { label: 'Priorities', href: '/strategy/priorities', icon: Target },
    ],
  },
  {
    id: 'command',
    label: 'Command',
    icon: Shield,
    color: '#f43f5e',
    description: 'Things that need your attention right now. Critical decisions and live escalations.',
    mentalModel: {
      tagline: 'The war room -- what needs your attention now.',
      explanation: 'Command surfaces things that cannot move without you. Agents escalate here when they hit walls or need authorization.',
      whenToUse: 'Check Command whenever something feels stalled, or when Tamir flags a critical escalation.',
      pages: [
        { name: 'Home', when: 'Situational awareness -- what is moving across all tasks' },
        { name: 'Escalations', when: 'Blocked situations requiring your authority' },
        { name: 'Routines', when: 'Scheduled recurring operations' },
      ],
    },
    links: [
      { label: 'Home', href: '/', icon: Home },
      { label: 'Escalations', href: '/escalations', icon: AlertTriangle },
      { label: 'Routines', href: '/routines', icon: Clock },
    ],
  },
  {
    id: 'agents',
    label: 'Agents',
    icon: Users,
    color: '#38bdf8',
    description: 'Your AI workforce. See who is doing what, review output, and orchestrate agents.',
    mentalModel: {
      tagline: 'Your team -- who is doing what, and how well.',
      explanation: 'Agents are your AI workforce. They execute tasks, produce deliverables, and escalate when blocked.',
      whenToUse: 'Use Agents when you want to understand org health or investigate what a specific agent has been doing.',
      pages: [
        { name: 'People', when: 'Reviewing agent roster, status, and departments' },
        { name: 'Workspace', when: 'Seeing all active tasks with deep per-task view' },
        { name: 'Terminal', when: 'Viewing real-time agent execution logs' },
      ],
    },
    links: [
      { label: 'People', href: '/agents', icon: Users },
      { label: 'Workspace', href: '/workspace', icon: Layers },
      { label: 'Terminal', href: '/terminal', icon: Terminal },
    ],
  },
  {
    id: 'knowledge',
    label: 'Knowledge',
    icon: BookOpen,
    color: '#a78bfa',
    description: 'Company institutional memory. Decisions, knowledge, and strategic assets.',
    mentalModel: {
      tagline: 'Your company memory -- what happened, what was decided, what matters.',
      explanation: 'Knowledge is the long-term memory layer. Agents read from this to make better decisions.',
      whenToUse: 'Come here when you need historical context on a decision or to verify what was committed to.',
      pages: [
        { name: 'Vault', when: 'Reviewing saved decisions, strategies, and institutional knowledge' },
        { name: 'Assets', when: 'Managing company assets and their evolution' },
        { name: 'Org Context', when: 'Viewing department structure, employees, memories, skills' },
      ],
    },
    links: [
      { label: 'Command Book', href: '/command-book', icon: BookOpen },
      { label: 'Vault', href: '/vault', icon: Shield },
      { label: 'Assets', href: '/assets', icon: Target },
      { label: 'Org Context', href: '/org-context', icon: Layers },
    ],
  },
  {
    id: 'system',
    label: 'System',
    icon: Settings,
    color: '#34d399',
    description: 'Configure and evolve your capabilities. System settings and preferences.',
    mentalModel: {
      tagline: 'The control panel -- how you shape the operating system.',
      explanation: 'System is where you configure the org capabilities. Settings tunes the environment.',
      whenToUse: 'Come here to investigate system-level issues or change how the environment behaves.',
      pages: [
        { name: 'Settings', when: 'System configuration and preferences' },
        { name: 'Testing', when: 'Running and reviewing scenario test results' },
      ],
    },
    links: [
      { label: 'Settings', href: '/settings', icon: Settings },
      { label: 'Testing', href: '/testing', icon: FlaskConical },
    ],
  },
];

// -- Helpers ------------------------------------------------------------------

function isLinkActive(href: string, pathname: string) {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(href + '/');
}

function isGroupActive(group: NavGroup, pathname: string) {
  return group.links.some((l) => isLinkActive(l.href, pathname));
}

// -- Mental Model Panel (click-triggered, fixed position) ---------------------

function MentalModelPanel({
  group,
  anchorRef,
  onClose,
}: {
  group: NavGroup;
  anchorRef: React.RefObject<HTMLButtonElement | null>;
  onClose: () => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0, maxHeight: 0 });

  // Position relative to the ? button -- clamp so panel never bleeds off-screen
  useEffect(() => {
    if (!anchorRef.current) return;
    const rect = anchorRef.current.getBoundingClientRect();
    const MARGIN = 12;
    const idealTop = rect.top - 8;
    const viewportH = window.innerHeight;
    const available = viewportH - idealTop - MARGIN;
    const top = available < 180
      ? Math.max(MARGIN, viewportH - Math.min(500, viewportH - MARGIN * 2) - MARGIN)
      : Math.max(MARGIN, idealTop);
    const maxHeight = viewportH - top - MARGIN;
    setPos({ top, left: rect.right + 12, maxHeight });
  }, [anchorRef]);

  // Close on outside click or Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    const handleClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node) &&
          anchorRef.current && !anchorRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKey);
    document.addEventListener('mousedown', handleClick);
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.removeEventListener('mousedown', handleClick);
    };
  }, [onClose, anchorRef]);

  return (
    <motion.div
      ref={panelRef}
      initial={{ opacity: 0, x: -8, scale: 0.96 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: -8, scale: 0.96 }}
      transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
      className="fixed z-[9999] w-[300px] rounded-2xl flex flex-col overflow-hidden"
      style={{
        top: pos.top,
        left: pos.left,
        maxHeight: pos.maxHeight || undefined,
        background: 'rgba(8,13,28,0.98)',
        border: `1px solid ${group.color}25`,
        backdropFilter: 'blur(24px)',
        boxShadow: `0 20px 60px rgba(0,0,0,0.7), 0 0 40px ${group.color}06`,
      }}
    >
      {/* Header */}
      <div
        className="shrink-0 flex items-start justify-between px-4 pt-4 pb-3"
        style={{ borderBottom: `1px solid ${group.color}12` }}
      >
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div
              className="w-6 h-6 rounded-lg flex items-center justify-center"
              style={{ background: `${group.color}15` }}
            >
              <group.icon size={12} style={{ color: group.color }} />
            </div>
            <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color: group.color }}>
              {group.label}
            </span>
          </div>
          <p className="text-[12.5px] text-slate-300 font-medium leading-snug">
            {group.mentalModel.tagline}
          </p>
        </div>
        <button
          onClick={onClose}
          className="shrink-0 ml-2 mt-0.5 w-5 h-5 rounded-full flex items-center justify-center cursor-pointer transition-colors hover:bg-white/10"
        >
          <X size={11} className="text-slate-500" />
        </button>
      </div>

      {/* Body -- scrollable */}
      <div
        className="overflow-y-auto px-4 py-3 space-y-3"
        style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.08) transparent' }}
      >
        <p className="text-[11.5px] text-slate-400 leading-relaxed">
          {group.mentalModel.explanation}
        </p>

        <div
          className="rounded-xl px-3 py-2.5"
          style={{ background: `${group.color}08`, border: `1px solid ${group.color}12` }}
        >
          <div className="text-[9px] uppercase tracking-widest font-semibold mb-1.5" style={{ color: group.color }}>
            When to come here
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            {group.mentalModel.whenToUse}
          </p>
        </div>

        <div className="pb-1">
          <div className="text-[9px] uppercase tracking-widest text-slate-600 font-semibold mb-2">
            Pages in this section
          </div>
          <div className="space-y-1.5">
            {group.mentalModel.pages.map((page) => (
              <div key={page.name} className="flex items-start gap-2">
                <span
                  className="shrink-0 mt-[3px] w-1.5 h-1.5 rounded-full"
                  style={{ background: group.color, opacity: 0.6 }}
                />
                <div>
                  <span className="text-[11px] font-semibold text-slate-300">{page.name}</span>
                  <span className="text-[10.5px] text-slate-500"> -- {page.when}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// -- Flyout for collapsed mode ------------------------------------------------

function GroupFlyout({ group, pathname }: { group: NavGroup; pathname: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -8, scale: 0.95 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: -8, scale: 0.95 }}
      transition={{ duration: 0.15, ease: [0.22, 1, 0.36, 1] }}
      className="absolute left-full top-0 ml-2 z-50 rounded-xl min-w-[200px] overflow-hidden"
      style={{
        background: 'rgba(10,16,36,0.96)',
        border: `1px solid ${group.color}25`,
        backdropFilter: 'blur(20px)',
        boxShadow: `0 12px 40px rgba(0,0,0,0.5), 0 0 20px ${group.color}08`,
      }}
    >
      <div
        className="px-3 pt-3 pb-2"
        style={{ borderBottom: `1px solid ${group.color}15` }}
      >
        <div className="flex items-center gap-1.5 mb-1.5">
          <group.icon size={11} style={{ color: group.color }} />
          <span className="text-[9px] font-bold uppercase tracking-[0.14em]" style={{ color: group.color }}>
            {group.label}
          </span>
        </div>
        <p className="text-[10px] text-slate-500 leading-relaxed">{group.description}</p>
      </div>
      <div className="p-1">
        {group.links.map((link) => {
          const active = isLinkActive(link.href, pathname);
          return (
            <Link
              key={link.href}
              href={link.href}
              className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-[12px] font-medium transition-all"
              style={{
                color: active ? 'white' : '#94a3b8',
                background: active ? `${group.color}12` : 'transparent',
              }}
            >
              <link.icon size={14} style={{ color: active ? group.color : '#64748b' }} />
              {link.label}
            </Link>
          );
        })}
      </div>
    </motion.div>
  );
}

// -- Main Sidebar -------------------------------------------------------------

export default function Sidebar() {
  const pathname = usePathname();
  const [isPinned, setIsPinned] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [hoveredGroup, setHoveredGroup] = useState<string | null>(null);
  const [openMentalModel, setOpenMentalModel] = useState<string | null>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const helpButtonRefs = useRef<Record<string, React.RefObject<HTMLButtonElement | null>>>({});

  // Create a stable ref for each group
  NAV_GROUPS.forEach((g) => {
    if (!helpButtonRefs.current[g.id]) {
      helpButtonRefs.current[g.id] = { current: null };
    }
  });

  const toggleMentalModel = useCallback((groupId: string) => {
    setOpenMentalModel((prev) => (prev === groupId ? null : groupId));
  }, []);

  // Load pin state from localStorage
  useEffect(() => {
    const stored = localStorage.getItem('sidebar-pinned');
    if (stored === 'true') setIsPinned(true);
  }, []);

  const togglePin = () => {
    const next = !isPinned;
    setIsPinned(next);
    localStorage.setItem('sidebar-pinned', String(next));
  };

  const isExpanded = isPinned || isHovered;

  return (
    <motion.aside
      ref={sidebarRef}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        setIsHovered(false);
        setHoveredGroup(null);
      }}
      animate={{ width: isExpanded ? 220 : 64 }}
      transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
      className="shrink-0 flex flex-col h-full relative z-30 overflow-visible"
      style={{
        background: 'rgba(6,10,19,0.95)',
        borderRight: '1px solid rgba(255,255,255,0.06)',
        backdropFilter: 'blur(20px)',
      }}
    >
      {/* -- Logo -- */}
      <Link
        href="/"
        className="shrink-0 flex items-center gap-2.5 px-4 py-4 transition-colors hover:bg-white/[0.02]"
        style={{ height: 56, borderBottom: '1px solid rgba(255,255,255,0.05)' }}
      >
        <Brain className="w-7 h-7 text-sky-400 shrink-0 drop-shadow-[0_0_8px_rgba(56,189,248,0.6)]" />
        <AnimatePresence>
          {isExpanded && (
            <motion.span
              initial={{ opacity: 0, x: -4 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -4 }}
              transition={{ duration: 0.15 }}
              className="text-[15px] font-bold tracking-tight text-white whitespace-nowrap"
            >
              Myelin
            </motion.span>
          )}
        </AnimatePresence>
      </Link>

      {/* -- Nav groups -- */}
      <div className="flex-1 overflow-y-auto py-3 px-2 space-y-1" style={{ scrollbarWidth: 'none' }}>
        {NAV_GROUPS.map((group) => {
          const groupActive = isGroupActive(group, pathname);

          return (
            <div key={group.id} className="mb-1">
              {/* -- Collapsed: single icon with flyout -- */}
              {!isExpanded && (
                <div
                  className="relative"
                  onMouseEnter={() => setHoveredGroup(group.id)}
                  onMouseLeave={() => setHoveredGroup(null)}
                >
                  <div
                    className="flex items-center justify-center w-10 h-10 mx-auto rounded-xl cursor-pointer transition-all"
                    style={{
                      background: groupActive ? `${group.color}12` : 'transparent',
                      border: groupActive ? `1px solid ${group.color}20` : '1px solid transparent',
                    }}
                  >
                    <group.icon
                      size={18}
                      style={{ color: groupActive ? group.color : '#64748b' }}
                    />
                    {/* Active dot */}
                    {groupActive && (
                      <span
                        className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full"
                        style={{
                          background: group.color,
                          boxShadow: `0 0 8px ${group.color}60`,
                        }}
                      />
                    )}
                  </div>

                  {/* Flyout */}
                  <AnimatePresence>
                    {hoveredGroup === group.id && (
                      <GroupFlyout group={group} pathname={pathname} />
                    )}
                  </AnimatePresence>
                </div>
              )}

              {/* -- Expanded: full group with links -- */}
              {isExpanded && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.15, delay: 0.05 }}
                >
                  {/* Group header */}
                  <div className="relative flex items-center gap-2 px-2.5 py-1.5 mb-0.5">
                    <group.icon size={13} style={{ color: group.color }} className="shrink-0" />
                    <span
                      className="text-[9px] font-bold uppercase tracking-[0.14em] whitespace-nowrap"
                      style={{ color: `${group.color}90` }}
                    >
                      {group.label}
                    </span>
                    <div className="flex-1 h-px ml-1" style={{ background: `${group.color}15` }} />

                    {/* ? button -- click to open mental model panel */}
                    <button
                      ref={(el) => { helpButtonRefs.current[group.id].current = el; }}
                      onClick={() => toggleMentalModel(group.id)}
                      className="shrink-0 w-4 h-4 rounded-full flex items-center justify-center cursor-pointer transition-all"
                      style={{
                        color: openMentalModel === group.id ? group.color : '#475569',
                        background: openMentalModel === group.id ? `${group.color}15` : 'transparent',
                      }}
                      title="Mental model -- what is this section for?"
                    >
                      <HelpCircle size={11} />
                    </button>
                  </div>

                  {/* Links */}
                  {group.links.map((link) => {
                    const active = isLinkActive(link.href, pathname);
                    return (
                      <Link
                        key={link.href}
                        href={link.href}
                        className="relative flex items-center gap-2.5 pl-7 pr-3 py-[7px] rounded-lg text-[12px] font-medium transition-all group/link"
                        style={{
                          color: active ? 'white' : '#94a3b8',
                          background: active ? `${group.color}10` : 'transparent',
                        }}
                      >
                        {/* Active left bar */}
                        {active && (
                          <motion.span
                            layoutId="sidebar-active"
                            className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full"
                            style={{
                              background: group.color,
                              boxShadow: `0 0 8px ${group.color}60`,
                            }}
                            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                          />
                        )}
                        <link.icon
                          size={14}
                          style={{ color: active ? group.color : '#64748b' }}
                          className="shrink-0 transition-colors group-hover/link:text-slate-300"
                        />
                        <span className="truncate group-hover/link:text-white transition-colors">
                          {link.label}
                        </span>
                      </Link>
                    );
                  })}
                </motion.div>
              )}
            </div>
          );
        })}

      </div>

      {/* -- Mental model panels (rendered outside sidebar to avoid overflow clipping) -- */}
      <AnimatePresence>
        {openMentalModel && (() => {
          const group = NAV_GROUPS.find((g) => g.id === openMentalModel);
          if (!group) return null;
          return (
            <MentalModelPanel
              key={group.id}
              group={group}
              anchorRef={helpButtonRefs.current[group.id]}
              onClose={() => setOpenMentalModel(null)}
            />
          );
        })()}
      </AnimatePresence>

      {/* -- Bottom: pin toggle -- */}
      <div
        className="shrink-0 px-2 py-3"
        style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}
      >
        <AnimatePresence mode="wait">
          {isExpanded ? (
            <motion.button
              key="pin-expanded"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={togglePin}
              className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-[11px] font-medium transition-all cursor-pointer"
              style={{
                color: isPinned ? '#38bdf8' : '#64748b',
                background: isPinned ? 'rgba(56,189,248,0.08)' : 'transparent',
              }}
            >
              {isPinned ? <PinOff size={13} /> : <Pin size={13} />}
              <span>{isPinned ? 'Unpin sidebar' : 'Pin sidebar'}</span>
            </motion.button>
          ) : (
            <motion.button
              key="pin-collapsed"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={togglePin}
              className="flex items-center justify-center w-10 h-10 mx-auto rounded-lg cursor-pointer transition-all"
              style={{
                color: isPinned ? '#38bdf8' : '#475569',
                background: isPinned ? 'rgba(56,189,248,0.08)' : 'transparent',
              }}
            >
              {isPinned ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
            </motion.button>
          )}
        </AnimatePresence>
      </div>
    </motion.aside>
  );
}
