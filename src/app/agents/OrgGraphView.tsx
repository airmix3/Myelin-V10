'use client';

import { useState, useEffect, useRef, useCallback, useLayoutEffect } from 'react';
import { X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// ── Types ────────────────────────────────────────────────────────────────────

interface ActivityLogRow {
  id: string;
  actionType: string;
  description: string | null;
  createdAt: string;
}

interface ActiveTask {
  taskId: string;
  title: string;
  state: string;
  runId: string | null;
  sessionId: string | null;
  workspaceCwd: string | null;
  recentActivity: ActivityLogRow[];
}

interface OrgNode {
  id: string;
  name: string;
  role: string;
  department: string;
  agentId: string | null;
  status: string;
  avatarColor: string;
  activeTasks: ActiveTask[];
}

interface OrgEdge {
  from: string;
  to: string;
}

// ── Constants ────────────────────────────────────────────────────────────────

const DEPT_COLORS: Record<string, string> = {
  tech: '#6496ff',
  marketing: '#a78bfa',
  operations: '#34d399',
  cos: '#2dd4bf',
  exec: '#e94560',
};

function stateBadgeColor(state: string): string {
  switch (state) {
    case 'working': return '#ffb347';
    case 'completed': return '#00d68f';
    case 'failed': return '#e94560';
    default: return '#64748b';
  }
}

// ── Component ────────────────────────────────────────────────────────────────

export default function OrgGraphView() {
  const [nodes, setNodes] = useState<OrgNode[]>([]);
  const [edges, setEdges] = useState<OrgEdge[]>([]);
  const [selectedNode, setSelectedNode] = useState<OrgNode | null>(null);
  const [logEntries, setLogEntries] = useState<Record<string, string[]>>({});

  const treeRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const [connectorLines, setConnectorLines] = useState<Array<{ x1: number; y1: number; x2: number; y2: number }>>([]);

  // Fetch org data
  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/org-graph');
      const data = await res.json();
      if (data.nodes && data.edges) {
        setNodes(data.nodes);
        setEdges(data.edges);
      }
    } catch {
      // Silently fail
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Historical activity load when selectedNode changes
  useEffect(() => {
    if (!selectedNode) return;
    const initial: Record<string, string[]> = {};
    for (const task of selectedNode.activeTasks) {
      if (task.recentActivity && task.recentActivity.length > 0) {
        initial[task.taskId] = task.recentActivity.map(a => a.description || a.actionType);
      }
    }
    setLogEntries(initial);
  }, [selectedNode]);

  // SSE live updates for selected node's tasks
  useEffect(() => {
    if (!selectedNode || selectedNode.activeTasks.length === 0) return;
    const es = new EventSource('/api/sse');

    es.addEventListener('task:activity', (event) => {
      try {
        const parsed = JSON.parse(event.data);
        const taskId = parsed?.taskId;
        if (!taskId) return;
        const isRelevantTask = selectedNode.activeTasks.some(t => t.taskId === taskId);
        if (!isRelevantTask) return;

        const actionType = parsed?.actionType;
        const description = parsed?.description;
        if (actionType === 'SDK_ASSISTANT') {
          if (!description || description === 'Assistant message') return;
        }

        const desc = description || actionType || 'activity';
        setLogEntries(prev => ({
          ...prev,
          [taskId]: [...(prev[taskId] || []).slice(-100), desc],
        }));
      } catch {
        // skip
      }
    });

    return () => es.close();
  }, [selectedNode]);

  // Build children map and node lookup from edges
  const childrenOf = new Map<string, string[]>();
  const nodeMap = new Map<string, OrgNode>();
  for (const e of edges) {
    const list = childrenOf.get(e.from) || [];
    list.push(e.to);
    childrenOf.set(e.from, list);
  }
  for (const node of nodes) {
    nodeMap.set(node.id, node);
  }

  // Draw connector lines after layout
  useLayoutEffect(() => {
    if (nodes.length === 0 || !treeRef.current) return;

    const timer = setTimeout(() => {
      const treeRect = treeRef.current?.getBoundingClientRect();
      if (!treeRect) return;

      const lines: Array<{ x1: number; y1: number; x2: number; y2: number }> = [];
      for (const edge of edges) {
        const parentEl = cardRefs.current.get(edge.from);
        const childEl = cardRefs.current.get(edge.to);
        if (!parentEl || !childEl) continue;

        const parentRect = parentEl.getBoundingClientRect();
        const childRect = childEl.getBoundingClientRect();

        const x1 = parentRect.left + parentRect.width / 2 - treeRect.left;
        const y1 = parentRect.top + parentRect.height - treeRect.top;
        const x2 = childRect.left + childRect.width / 2 - treeRect.left;
        const y2 = childRect.top - treeRect.top;

        lines.push({ x1, y1, x2, y2 });
      }
      setConnectorLines(lines);
    }, 50);

    return () => clearTimeout(timer);
  }, [nodes, edges]);

  function handleCardClick(node: OrgNode) {
    if (node.id === 'ceo') return;
    setSelectedNode(prev => prev?.id === node.id ? null : node);
  }

  const setCardRef = useCallback((id: string, el: HTMLDivElement | null) => {
    if (el) {
      cardRefs.current.set(id, el);
    } else {
      cardRefs.current.delete(id);
    }
  }, []);

  function renderSubtree(nodeId: string): React.ReactNode {
    const node = nodeMap.get(nodeId);
    if (!node) return null;
    const children = childrenOf.get(nodeId) || [];
    const deptColor = DEPT_COLORS[node.department] || node.avatarColor || '#666';
    const isSelected = selectedNode?.id === nodeId;
    const hasWorking = node.activeTasks.some(t => t.state === 'working');

    return (
      <div className="flex flex-col items-center" key={nodeId}>
        <div className="flex flex-col items-center">
          <div
            ref={(el) => setCardRef(nodeId, el)}
            className={`
              relative rounded-xl px-4 py-3 min-w-[120px] text-center transition-all
              ${isSelected
                ? 'ring-1 ring-white/20 bg-white/[0.08]'
                : 'bg-white/[0.04] hover:bg-white/[0.06]'
              }
            `}
            style={{
              border: '1px solid rgba(255,255,255,0.07)',
              cursor: nodeId === 'ceo' ? 'default' : 'pointer',
            }}
            onClick={() => handleCardClick(node)}
          >
            {/* Status dot */}
            {hasWorking && (
              <div
                className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: '#00d68f' }}
              />
            )}

            {/* Name row with dept color dot */}
            <div className="flex items-center justify-center gap-1.5">
              <div
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: deptColor }}
              />
              <span className="text-[13px] font-bold text-white leading-tight">
                {node.name}
              </span>
            </div>

            {/* Role */}
            <p className="text-[10px] text-slate-500 mt-0.5">{node.role}</p>

            {/* Department label */}
            <p
              className="text-[9px] uppercase tracking-wider mt-1 font-medium"
              style={{ color: deptColor }}
            >
              {node.department}
            </p>

            {/* Active tasks badge */}
            {node.activeTasks.length > 0 && (
              <span
                className="inline-block mt-1.5 text-[9px] font-bold px-1.5 py-0.5 rounded"
                style={{ background: 'rgba(255,179,71,0.2)', color: '#ffb347' }}
              >
                {node.activeTasks.length} active
              </span>
            )}
          </div>
        </div>

        {children.length > 0 && (
          <div className="flex gap-6 mt-8 items-start">
            {children.map(childId => renderSubtree(childId))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="relative flex h-full w-full overflow-hidden">
      {/* Hierarchical tree */}
      <div className="flex-1 overflow-auto p-8">
        <div className="relative inline-flex flex-col items-center min-w-full" ref={treeRef}>
          {/* SVG connector lines */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 0 }}>
            {connectorLines.map((line, i) => (
              <line
                key={i}
                x1={line.x1}
                y1={line.y1}
                x2={line.x2}
                y2={line.y2}
                stroke="rgba(255,255,255,0.08)"
                strokeWidth={1.5}
              />
            ))}
          </svg>

          <div style={{ position: 'relative', zIndex: 1 }}>
            {renderSubtree('ceo')}
          </div>
        </div>
      </div>

      {/* Task overlay panel */}
      <AnimatePresence>
        {selectedNode && (
          <motion.div
            initial={{ x: 320, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 320, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="w-80 shrink-0 h-full flex flex-col overflow-hidden glass-panel"
            style={{
              borderLeft: '1px solid rgba(255,255,255,0.07)',
              background: 'rgba(15,23,42,0.85)',
              backdropFilter: 'blur(12px)',
            }}
          >
            {/* Header */}
            <div className="px-4 py-4 shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
              <button
                onClick={() => setSelectedNode(null)}
                className="float-right text-slate-500 hover:text-white transition-colors cursor-pointer"
              >
                <X size={14} />
              </button>
              <div className="flex items-center gap-3">
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center text-[13px] font-bold text-white"
                  style={{ backgroundColor: selectedNode.avatarColor || '#666' }}
                >
                  {selectedNode.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="text-[13px] font-bold text-white">{selectedNode.name}</p>
                  <p className="text-[11px] text-slate-500">
                    {selectedNode.role} | {selectedNode.department}
                  </p>
                </div>
              </div>
            </div>

            {/* Tasks content */}
            <div className="flex-1 overflow-y-auto px-4 py-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-teal-400 mb-3">
                Active Tasks ({selectedNode.activeTasks.length})
              </p>

              {selectedNode.activeTasks.length === 0 ? (
                <p className="text-slate-600 text-[12px]">No active tasks</p>
              ) : (
                <div className="space-y-3">
                  {selectedNode.activeTasks.map(task => (
                    <div
                      key={task.taskId}
                      className="rounded-lg p-3"
                      style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}
                    >
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-[12px] font-semibold text-white">{task.title}</span>
                        <span
                          className="text-[9px] font-bold px-1.5 py-0.5 rounded"
                          style={{ background: `${stateBadgeColor(task.state)}20`, color: stateBadgeColor(task.state) }}
                        >
                          {task.state}
                        </span>
                      </div>

                      {/* Activity log */}
                      <div
                        className="max-h-28 overflow-y-auto rounded-md p-2 text-[10px] text-slate-400 font-mono space-y-0.5"
                        style={{ background: 'rgba(0,0,0,0.3)' }}
                      >
                        {(logEntries[task.taskId] || []).length === 0 ? (
                          <span className="text-slate-600">No activity recorded yet</span>
                        ) : (
                          (logEntries[task.taskId] || []).map((entry, i) => (
                            <div key={i}>{entry}</div>
                          ))
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
