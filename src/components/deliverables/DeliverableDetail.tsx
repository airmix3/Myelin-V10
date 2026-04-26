'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { ArrowUpFromLine, Send, ChevronDown, ChevronRight, FileText, Code2, Image as ImageIcon, Play, Database, CheckCircle2 } from 'lucide-react';
import { marked } from 'marked';
import { motion, AnimatePresence } from 'motion/react';
import TaskFlowTimeline from './TaskFlowTimeline';

// ── Types ────────────────────────────────────────────────────────────────────

interface DeliverableDetailProps {
  deliverable: Record<string, unknown>;
  task: Record<string, unknown>;
  initialChat: Array<Record<string, unknown>>;
  activityLog: Array<Record<string, unknown>>;
  hireRequests: Array<Record<string, unknown>>;
  onPromoteClick?: () => void;
  onHireApprove?: (hireRequestId: string) => void;
  onHireReject?: (hireRequestId: string) => void;
  onBudgetIncrease?: () => void;
  onTaskApprove?: () => void;
}

type TabId = 'deliverable' | 'task-flow' | 'agent-log' | 'files';

interface ChatMessage {
  role: 'user' | 'agent' | 'system';
  content: string;
  ts: string;
  agentId?: string;
  turnType?: string;
}

interface FileInfo {
  name: string;
  path: string;
  size: number;
  isDeliverable: boolean;
}

interface AgentLogEntry {
  id: string;
  taskId: string | null;
  agentId: string | null;
  actionType: string;
  description: string | null;
  metadata: string | null;
  createdAt: string;
}

// ── Constants ────────────────────────────────────────────────────────────────

const DEPT_COLORS: Record<string, { text: string; bg: string }> = {
  tech:       { text: 'text-blue-400',    bg: 'bg-blue-600' },
  marketing:  { text: 'text-violet-400',  bg: 'bg-purple-600' },
  operations: { text: 'text-emerald-400', bg: 'bg-emerald-600' },
};

const ACTION_TYPE_COLORS: Record<string, { text: string; bg: string; dot: string; label: string }> = {
  SDK_SESSION_INIT:   { text: 'text-sky-400',     bg: 'rgba(56,189,248,0.12)',  dot: 'rgb(56,189,248)',    label: 'SESSION' },
  SDK_SKILL_LOAD:     { text: 'text-sky-400',     bg: 'rgba(56,189,248,0.12)',  dot: 'rgb(56,189,248)',    label: 'SKILL' },
  SDK_ASSISTANT:      { text: 'text-violet-400',  bg: 'rgba(139,92,246,0.12)',  dot: 'rgb(139,92,246)',    label: 'ASSISTANT' },
  SDK_TOOL_CALL:      { text: 'text-amber-400',   bg: 'rgba(251,191,36,0.12)',  dot: 'rgb(251,191,36)',    label: 'TOOL' },
  SDK_TOOL_PROGRESS:  { text: 'text-amber-400',   bg: 'rgba(251,191,36,0.12)',  dot: 'rgb(251,191,36)',    label: 'PROGRESS' },
  SDK_TOOL_SUMMARY:   { text: 'text-emerald-400', bg: 'rgba(16,185,129,0.12)',  dot: 'rgb(16,185,129)',    label: 'TOOL' },
  SDK_FILES_PERSISTED:{ text: 'text-emerald-400', bg: 'rgba(16,185,129,0.12)',  dot: 'rgb(16,185,129)',    label: 'FILES' },
  SDK_RESULT_SUCCESS: { text: 'text-emerald-400', bg: 'rgba(16,185,129,0.12)',  dot: 'rgb(16,185,129)',    label: 'RESULT' },
  SDK_RESULT_FAILURE: { text: 'text-rose-400',    bg: 'rgba(251,113,133,0.12)', dot: 'rgb(251,113,133)',   label: 'FAILED' },
  SDK_API_RETRY:      { text: 'text-rose-400',    bg: 'rgba(251,113,133,0.12)', dot: 'rgb(251,113,133)',   label: 'RETRY' },
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function shortenId(id: string): string {
  return id.length > 10 ? id.slice(0, 8) + '...' : id;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatRelativeTime(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function getFileExtension(filename: string): string {
  const parts = filename.split('.');
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
}

function isImageFile(ext: string): boolean {
  return ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'].includes(ext);
}

function isVideoFile(ext: string): boolean {
  return ['mp4', 'webm'].includes(ext);
}

function findDividerIndex(messages: ChatMessage[]): number {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].turnType === 'plan_ready') return i + 1;
  }
  return -1;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ── Component ────────────────────────────────────────────────────────────────

export default function DeliverableDetail({
  deliverable,
  task,
  initialChat,
  activityLog,
  hireRequests,
  onPromoteClick,
  onHireApprove,
  onHireReject,
  onBudgetIncrease,
  onTaskApprove,
}: DeliverableDetailProps) {
  const department = deliverable.department as string;
  const deliverableId = deliverable.id as string;
  const taskId = task.id as string;
  const deptColors = DEPT_COLORS[department] ?? { text: 'text-slate-400', bg: 'bg-slate-600' };

  // State
  const defaultTab: TabId = deliverable.primaryFile ? 'deliverable' : 'agent-log';
  const [activeTab, setActiveTab] = useState<TabId>(defaultTab);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(initialChat as unknown as ChatMessage[]);
  const [chatInput, setChatInput] = useState('');
  const [sending, setSending] = useState(false);
  const [deliverableContent, setDeliverableContent] = useState<string | null>(null);
  const [files, setFiles] = useState<FileInfo[]>([]);
  const [filesLoading, setFilesLoading] = useState(false);
  const [expandedLogIds, setExpandedLogIds] = useState<Set<string>>(new Set());
  const chatEndRef = useRef<HTMLDivElement>(null);

  const taskState = task.state as string;
  const isTerminal = ['completed', 'failed', 'canceled'].includes(taskState);

  // Parse task metadata for input type
  let inputType: string | null = null;
  try {
    const meta = typeof task.metadata === 'string' ? JSON.parse(task.metadata) : task.metadata;
    inputType = meta?.inputType ?? null;
  } catch { /* ignore */ }

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  // Load deliverable content
  useEffect(() => {
    if (activeTab !== 'deliverable') return;
    const primaryFile = deliverable.primaryFile as string | null;
    if (!primaryFile) return;

    const ext = getFileExtension(primaryFile);
    if (isImageFile(ext) || isVideoFile(ext) || ext === 'pdf') return; // rendered inline

    fetch(`/api/deliverables/${deliverableId}/file?path=${encodeURIComponent(primaryFile)}`)
      .then((r) => r.ok ? r.text() : Promise.reject())
      .then((text) => {
        if (ext === 'md' || ext === 'markdown') {
          setDeliverableContent(marked.parse(text) as string);
        } else {
          setDeliverableContent(`<pre class="font-mono text-xs text-slate-300 whitespace-pre-wrap">${text}</pre>`);
        }
      })
      .catch(() => setDeliverableContent(null));
  }, [activeTab, deliverableId, deliverable.primaryFile]);

  // Load files list
  useEffect(() => {
    if (activeTab !== 'files') return;
    setFilesLoading(true);
    fetch(`/api/deliverables/${deliverableId}/file?list=true`)
      .then((r) => r.ok ? r.json() : { files: [] })
      .then((data) => setFiles(data.files ?? []))
      .catch(() => setFiles([]))
      .finally(() => setFilesLoading(false));
  }, [activeTab, deliverableId]);

  // Send chat message
  const handleSendMessage = useCallback(async () => {
    const msg = chatInput.trim();
    if (!msg || sending) return;
    setSending(true);
    setChatInput('');

    const optimistic: ChatMessage = { role: 'user', content: msg, ts: new Date().toISOString() };
    setChatMessages((prev) => [...prev, optimistic]);

    try {
      const res = await fetch(`/api/deliverables/${deliverableId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.reply) {
          setChatMessages((prev) => [...prev, {
            role: 'agent',
            content: data.reply.content ?? data.reply,
            ts: new Date().toISOString(),
            agentId: data.reply.agentId,
          }]);
        }
      }
    } catch { /* ignore */ }
    setSending(false);
  }, [chatInput, sending, deliverableId]);

  const toggleLogExpand = useCallback((id: string) => {
    setExpandedLogIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const dividerIndex = findDividerIndex(chatMessages);

  const tabs: Array<{ id: TabId; label: string }> = [
    { id: 'deliverable', label: 'Deliverable' },
    { id: 'task-flow', label: 'Task Flow' },
    { id: 'agent-log', label: 'Agent Log' },
    { id: 'files', label: `Files${files.length > 0 ? ` (${files.length})` : ''}` },
  ];

  return (
    <div className="flex flex-col rounded-2xl overflow-hidden" style={{ height: 'calc(100vh - 0px)', background: 'rgba(6,10,19,0.60)' }}>
      {/* ── MetadataBar ──────────────────────────────────────────────── */}
      <div
        className="flex items-center gap-3 px-5 mx-3 mt-3 shrink-0 rounded-xl"
        style={{
          height: 52,
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        {/* ID badge */}
        <span className="glass-pill px-2.5 py-1 text-[11px] font-mono text-slate-400 rounded-md">
          {shortenId(deliverableId as string)}
        </span>

        {/* Creator avatar */}
        {!!deliverable.creatorId && (
          <div
            className={`w-6 h-6 rounded-full ${deptColors.bg} flex items-center justify-center text-[10px] font-bold text-white shrink-0`}
          >
            {(deliverable.creatorId as string).charAt(0).toUpperCase()}
          </div>
        )}

        {/* Department badge */}
        <span className={`glass-pill px-2.5 py-1 text-[11px] font-semibold rounded-md ${deptColors.text}`}>
          {department}
        </span>

        {/* Type badge */}
        {!!deliverable.type && (
          <span className="glass-pill px-2.5 py-1 text-[11px] font-semibold text-slate-400 rounded-md">
            {deliverable.type as string}
          </span>
        )}

        {/* Created date */}
        <span className="text-[11px] text-slate-500">
          {formatDate(deliverable.createdAt as string)}
        </span>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Promote to Asset button */}
        {!(deliverable as Record<string, unknown>).assetId && (
          <button
            onClick={onPromoteClick}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white transition-all cursor-pointer hover:brightness-110"
            style={{
              background: 'linear-gradient(135deg, rgba(14,165,233,0.90), rgba(2,132,199,0.80))',
              boxShadow: '0 4px 16px rgba(14,165,233,0.30)',
            }}
          >
            <ArrowUpFromLine size={14} />
            Promote to Asset
          </button>
        )}

        {/* Hire approval */}
        {taskState === 'input-required' && inputType === 'hire_approval' && hireRequests.length > 0 && (
          <button
            onClick={() => onHireApprove?.((hireRequests[0] as Record<string, unknown>).id as string)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white cursor-pointer hover:brightness-110 transition-all"
            style={{
              background: 'linear-gradient(135deg, rgba(16,185,129,0.90), rgba(5,150,105,0.80))',
              boxShadow: '0 4px 16px rgba(16,185,129,0.30)',
            }}
          >
            Approve Hire
          </button>
        )}

        {/* Budget increase */}
        {taskState === 'input-required' && inputType === 'budget_increase' && (
          <button
            onClick={onBudgetIncrease}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white cursor-pointer hover:brightness-110 transition-all"
            style={{
              background: 'linear-gradient(135deg, rgba(245,158,11,0.90), rgba(217,119,6,0.80))',
              boxShadow: '0 4px 16px rgba(245,158,11,0.30)',
            }}
          >
            Increase Budget
          </button>
        )}

        {/* CEO Review: Approve */}
        {(taskState === 'completed' || taskState === 'canceled') && (
          <button
            onClick={onTaskApprove}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white cursor-pointer transition-all hover:brightness-110"
            style={{
              background: 'linear-gradient(135deg, rgba(16,185,129,0.90), rgba(5,150,105,0.80))',
              boxShadow: '0 4px 16px rgba(16,185,129,0.30)',
            }}
          >
            <CheckCircle2 size={14} />
            Approve
          </button>
        )}
      </div>

      {/* ── Split layout ─────────────────────────────────────────────── */}
      <div className="flex flex-row flex-1 min-h-0">

        {/* ── Chat Panel (400px) ───────────────────────────────────── */}
        <div className="w-[400px] flex flex-col shrink-0" style={{ borderRight: '1px solid rgba(255,255,255,0.06)' }}>
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2">
            {chatMessages.length === 0 && (
              <p className="text-xs text-slate-500 text-center mt-8">No messages yet</p>
            )}
            {chatMessages.map((msg, i) => {
              const isCeo = msg.role === 'user';
              const isSystem = msg.role === 'system';

              // Planning divider
              const showDivider = dividerIndex > 0 && i === dividerIndex;

              return (
                <div key={i}>
                  {showDivider && (
                    <div className="flex items-center gap-2 my-3">
                      <div className="flex-1 h-px bg-slate-700" />
                      <span className="glass-pill rounded-full px-3 py-1 text-[10px] text-slate-500 uppercase tracking-wider">
                        plan approved - task executing
                      </span>
                      <div className="flex-1 h-px bg-slate-700" />
                    </div>
                  )}

                  {isSystem ? (
                    <div className="text-[11px] text-slate-500 text-center py-1">{msg.content}</div>
                  ) : (
                    <div className={`flex ${isCeo ? 'justify-end' : 'justify-start'}`}>
                      <div
                        className={`max-w-[85%] px-3 py-2 text-sm ${
                          isCeo ? 'rounded-2xl' : 'rounded-2xl rounded-tl-md glass-card'
                        }`}
                        style={
                          isCeo
                            ? {
                                background: 'rgba(56,189,248,0.10)',
                                border: '1px solid rgba(56,189,248,0.18)',
                                color: '#bae6fd',
                              }
                            : {}
                        }
                      >
                        {!isCeo && msg.agentId && (
                          <span className="text-[10px] font-semibold text-slate-400 block mb-0.5">
                            {msg.agentId}
                          </span>
                        )}
                        <div className="whitespace-pre-wrap">{msg.content}</div>
                        <span className="text-[10px] text-slate-500 block mt-1">
                          {formatRelativeTime(msg.ts)}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            <div ref={chatEndRef} />
          </div>

          {/* Chat input */}
          <div className="p-3 border-t border-white/5">
            <div
              className="flex items-center gap-2 px-3 py-2 rounded-xl"
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
              }}
            >
              <input
                type="text"
                placeholder={isTerminal ? 'Task is complete' : 'Send a message...'}
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
                disabled={isTerminal || sending}
                className="flex-1 bg-transparent border-none outline-none text-sm text-slate-200 placeholder:text-slate-500 disabled:opacity-50"
              />
              <button
                onClick={handleSendMessage}
                disabled={isTerminal || sending || !chatInput.trim()}
                className="rounded-full w-8 h-8 flex items-center justify-center transition-all cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
                style={{
                  background: !isTerminal && !sending && chatInput.trim()
                    ? 'rgba(56,189,248,0.15)'
                    : 'transparent',
                }}
              >
                <Send size={15} className="text-sky-400 disabled:text-slate-600" />
              </button>
            </div>
          </div>
        </div>

        {/* ── Tabbed Workspace ─────────────────────────────────────── */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Tab bar — segmented control */}
          <div className="mx-4 mt-2 mb-1 shrink-0">
            <div
              className="relative flex items-center gap-0.5 p-1 rounded-xl"
              style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.06)',
              }}
            >
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`relative z-10 px-4 py-2 rounded-lg text-[12px] font-medium transition-colors cursor-pointer ${
                    activeTab === tab.id
                      ? 'text-white'
                      : 'text-slate-400 hover:text-slate-300'
                  }`}
                >
                  {activeTab === tab.id && (
                    <motion.div
                      layoutId="activeTab"
                      className="absolute inset-0 rounded-lg"
                      style={{
                        background: 'rgba(255,255,255,0.08)',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                      }}
                      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                    />
                  )}
                  <span className="relative z-10">{tab.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-y-auto p-4">
            {/* ── Deliverable tab ─────────────────────────────────── */}
            {activeTab === 'deliverable' && (
              <DeliverableTabContent
                deliverableId={deliverableId}
                primaryFile={deliverable.primaryFile as string | null}
                content={deliverableContent}
              />
            )}

            {/* ── Task Flow tab ────────────────────────────────────── */}
            {activeTab === 'task-flow' && (
              <TaskFlowTimeline taskId={taskId} />
            )}

            {/* ── Agent Log tab ───────────────────────────────────── */}
            {activeTab === 'agent-log' && (
              <AgentLogTabContent
                entries={activityLog as unknown as AgentLogEntry[]}
                expandedIds={expandedLogIds}
                onToggle={toggleLogExpand}
              />
            )}

            {/* ── Files tab ───────────────────────────────────────── */}
            {activeTab === 'files' && (
              <FilesTabContent
                files={files}
                loading={filesLoading}
                deliverableId={deliverableId}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ───────────────────────────────────────────────────────────

function DeliverableTabContent({
  deliverableId,
  primaryFile,
  content,
}: {
  deliverableId: string;
  primaryFile: string | null;
  content: string | null;
}) {
  if (!primaryFile) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[200px] text-center opacity-80">
        <FileText size={32} className="text-slate-600 mb-3" />
        <p className="text-sm font-semibold text-slate-400">No deliverable content yet</p>
        <p className="text-xs text-slate-500 mt-1">The agent is still working on this task</p>
      </div>
    );
  }

  const ext = getFileExtension(primaryFile);

  if (isImageFile(ext)) {
    return (
      <div className="flex justify-center">
        <img
          src={`/api/deliverables/${deliverableId}/file?path=${encodeURIComponent(primaryFile)}`}
          alt={primaryFile}
          className="max-w-full rounded-xl"
        />
      </div>
    );
  }

  if (isVideoFile(ext)) {
    return (
      <video controls className="w-full rounded-xl">
        <source src={`/api/deliverables/${deliverableId}/file?path=${encodeURIComponent(primaryFile)}`} />
      </video>
    );
  }

  if (ext === 'pdf') {
    return (
      <iframe
        src={`/api/deliverables/${deliverableId}/file?path=${encodeURIComponent(primaryFile)}`}
        className="w-full h-full rounded-xl"
        style={{ minHeight: 600 }}
      />
    );
  }

  if (content) {
    return (
      <div
        className="prose prose-invert max-w-none text-sm"
        dangerouslySetInnerHTML={{ __html: content }}
      />
    );
  }

  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[200px] text-center opacity-80">
      <p className="text-sm text-slate-400">Loading content...</p>
    </div>
  );
}

function AgentLogTabContent({
  entries,
  expandedIds,
  onToggle,
}: {
  entries: AgentLogEntry[];
  expandedIds: Set<string>;
  onToggle: (id: string) => void;
}) {
  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[200px] text-center opacity-80">
        <Database size={32} className="text-slate-600 mb-3" />
        <p className="text-sm text-slate-400">No activity log entries</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      {entries.map((entry, index) => {
        const typeInfo = ACTION_TYPE_COLORS[entry.actionType] ?? {
          text: 'text-slate-400',
          bg: 'rgba(100,116,139,0.12)',
          dot: 'rgb(100,116,139)',
          label: entry.actionType.replace('SDK_', ''),
        };
        const isExpanded = expandedIds.has(entry.id);
        const hasMeta = entry.metadata && entry.metadata !== '{}' && entry.metadata !== 'null';

        return (
          <motion.div
            key={entry.id}
            initial={index < 20 ? { opacity: 0, y: 4 } : false}
            animate={{ opacity: 1, y: 0 }}
            transition={index < 20 ? { delay: index * 0.03, duration: 0.2 } : undefined}
            className="rounded-xl cursor-pointer transition-all"
            style={{
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid rgba(255,255,255,0.05)',
              borderLeft: `2px solid ${typeInfo.dot}`,
              padding: '12px 14px',
            }}
            onClick={() => hasMeta && onToggle(entry.id)}
          >
            <div className="flex items-center gap-2.5">
              {/* Color dot */}
              <div
                className="w-2 h-2 rounded-full shrink-0"
                style={{ background: typeInfo.dot }}
              />

              {/* Type badge */}
              <span
                className={`px-1.5 py-0.5 rounded-md text-[8px] font-bold uppercase tracking-wider ${typeInfo.text}`}
                style={{ background: typeInfo.bg }}
              >
                {typeInfo.label}
              </span>

              {/* Agent name */}
              {entry.agentId && (
                <span className="text-[11px] font-semibold text-slate-400">{entry.agentId}</span>
              )}

              {/* Description */}
              <span className="text-[12px] text-slate-300 flex-1 truncate">
                {entry.description || ''}
              </span>

              {/* Timestamp */}
              <span className="text-[10px] text-slate-500 shrink-0">
                {formatRelativeTime(entry.createdAt)}
              </span>

              {/* Expand indicator */}
              {hasMeta && (
                <span className="text-slate-500">
                  {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                </span>
              )}
            </div>

            {/* Expanded metadata */}
            {isExpanded && hasMeta && (
              <pre
                className="mt-2 p-2.5 rounded-lg text-[10px] text-slate-400 font-mono overflow-x-auto max-h-48"
                style={{
                  background: 'rgba(0,0,0,0.20)',
                  border: '1px solid rgba(255,255,255,0.04)',
                }}
              >
                {JSON.stringify(JSON.parse(entry.metadata!), null, 2)}
              </pre>
            )}
          </motion.div>
        );
      })}
    </div>
  );
}

function FilesTabContent({
  files,
  loading,
  deliverableId,
}: {
  files: FileInfo[];
  loading: boolean;
  deliverableId: string;
}) {
  if (loading) {
    return <p className="text-xs text-slate-500 text-center mt-8">Loading files...</p>;
  }

  if (files.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[200px] text-center opacity-80">
        <FileText size={32} className="text-slate-600 mb-3" />
        <p className="text-sm font-semibold text-slate-400">No files in workspace</p>
        <p className="text-xs text-slate-500 mt-1">Files will appear as the agent creates them</p>
      </div>
    );
  }

  const deliverableFiles = files.filter((f) => f.isDeliverable);
  const workingFiles = files.filter((f) => !f.isDeliverable);

  const FILE_TYPE_ICONS: Record<string, React.ElementType> = {
    md: FileText, py: Code2, js: Code2, ts: Code2, json: FileText,
    png: ImageIcon, jpg: ImageIcon, jpeg: ImageIcon, gif: ImageIcon, svg: ImageIcon,
    mp4: Play, webm: Play, csv: Database,
  };

  const FILE_TYPE_COLORS: Record<string, string> = {
    md: 'rgba(56,189,248,0.12)', py: 'rgba(16,185,129,0.12)', js: 'rgba(251,191,36,0.12)',
    ts: 'rgba(59,130,246,0.12)', json: 'rgba(148,163,184,0.12)',
    png: 'rgba(244,114,182,0.12)', jpg: 'rgba(244,114,182,0.12)', jpeg: 'rgba(244,114,182,0.12)',
    gif: 'rgba(244,114,182,0.12)', svg: 'rgba(244,114,182,0.12)',
    mp4: 'rgba(139,92,246,0.12)', webm: 'rgba(139,92,246,0.12)', csv: 'rgba(16,185,129,0.12)',
  };

  const renderFileGrid = (fileList: FileInfo[]) => (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
      {fileList.map((file) => {
        const ext = getFileExtension(file.name);
        const Icon = FILE_TYPE_ICONS[ext] ?? FileText;
        const iconBg = FILE_TYPE_COLORS[ext] ?? 'rgba(148,163,184,0.08)';
        return (
          <a
            key={file.path}
            href={`/api/deliverables/${deliverableId}/file?path=${encodeURIComponent(file.path)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-xl p-4 flex flex-col items-center gap-2 transition-all group"
            style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.06)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'rgba(56,189,248,0.15)';
              e.currentTarget.style.boxShadow = '0 0 12px rgba(56,189,248,0.06)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: iconBg }}
            >
              <Icon size={18} className="text-slate-400" />
            </div>
            <span className="text-[12px] font-medium text-slate-200 truncate w-full text-center">
              {file.name}
            </span>
            <span className="text-[10px] text-slate-500">{formatFileSize(file.size)}</span>
          </a>
        );
      })}
    </div>
  );

  return (
    <div className="flex flex-col gap-4">
      {deliverableFiles.length > 0 && (
        <div>
          <h3 className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold mb-3">
            Deliverables
          </h3>
          {renderFileGrid(deliverableFiles)}
        </div>
      )}
      {workingFiles.length > 0 && (
        <div>
          <h3 className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold mb-3">
            Working Files
          </h3>
          {renderFileGrid(workingFiles)}
        </div>
      )}
    </div>
  );
}
