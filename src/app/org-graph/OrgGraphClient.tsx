'use client';

import { useState, useEffect, useRef, useCallback, useLayoutEffect } from 'react';
import dynamic from 'next/dynamic';

const TerminalOverlay = dynamic(() => import('./TerminalOverlay'), { ssr: false });

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

const DEPT_COLORS: Record<string, string> = {
  tech: '#6496ff',
  marketing: '#ff64c8',
  operations: '#64c864',
  cos: '#ffa500',
  exec: '#e94560',
};

function stateBadgeColor(state: string): string {
  switch (state) {
    case 'working': return 'var(--amber, #ffb347)';
    case 'completed': return 'var(--green, #00d68f)';
    case 'failed': return 'var(--red, #e94560)';
    default: return 'var(--text-dim, #a0a0b0)';
  }
}

export default function OrgGraphClient() {
  const [nodes, setNodes] = useState<OrgNode[]>([]);
  const [edges, setEdges] = useState<OrgEdge[]>([]);
  const [selectedNode, setSelectedNode] = useState<OrgNode | null>(null);
  const [activeTerminal, setActiveTerminal] = useState<{ runId: string } | null>(null);
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
        // Only process activity for this selected node's tasks
        const isRelevantTask = selectedNode.activeTasks.some(t => t.taskId === taskId);
        if (!isRelevantTask) return;

        // Filter out SDK_ASSISTANT noise
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

    // Small delay to ensure card refs are populated
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

  function handleTakeRole(task: ActiveTask) {
    if (task.runId) {
      setActiveTerminal({ runId: task.runId });
    }
  }

  function handleTerminalClose() {
    setActiveTerminal(null);
    fetchData();
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
      <div className="org-subtree" key={nodeId}>
        <div className="org-subtree-node">
          <div
            ref={(el) => setCardRef(nodeId, el)}
            className={`org-node-card ${isSelected ? 'selected' : ''}`}
            onClick={() => handleCardClick(node)}
            style={{ cursor: nodeId === 'ceo' ? 'default' : 'pointer' }}
          >
            {/* Status dot */}
            {hasWorking && (
              <div
                className="org-node-status"
                style={{
                  top: '-3px',
                  right: '-3px',
                  backgroundColor: '#00d68f',
                }}
              />
            )}

            {/* Name row with dept color dot */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: deptColor,
                  flexShrink: 0,
                }}
              />
              <div style={{ fontWeight: 700, fontSize: '13px', lineHeight: 1.2 }}>
                {node.name}
              </div>
            </div>

            {/* Role */}
            <div style={{ fontSize: '10px', color: 'var(--text-dim, #a0a0b0)', marginTop: '2px' }}>
              {node.role}
            </div>

            {/* Department label */}
            <div style={{
              fontSize: '9px',
              color: deptColor,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              marginTop: '4px',
            }}>
              {node.department}
            </div>

            {/* Active tasks badge */}
            {node.activeTasks.length > 0 && (
              <div style={{
                marginTop: '6px',
                fontSize: '9px',
                fontWeight: 700,
                color: '#111',
                backgroundColor: 'var(--amber, #ffb347)',
                padding: '1px 6px',
                borderRadius: '4px',
                display: 'inline-block',
              }}>
                {node.activeTasks.length} active
              </div>
            )}
          </div>
        </div>

        {children.length > 0 && (
          <div className="org-subtree-children">
            {children.map(childId => renderSubtree(childId))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="org-graph-container">
      {/* Hierarchical tree */}
      <div className="org-tree-scroll">
        <div className="org-tree" ref={treeRef}>
          {/* SVG connector lines */}
          <svg className="org-tree-connectors">
            {connectorLines.map((line, i) => (
              <line
                key={i}
                x1={line.x1}
                y1={line.y1}
                x2={line.x2}
                y2={line.y2}
                stroke="#2a2a4a"
                strokeWidth={1.5}
              />
            ))}
          </svg>

          {renderSubtree('ceo')}
        </div>
      </div>

      {/* Task overlay panel */}
      <div className={`org-overlay-panel ${selectedNode ? '' : 'closed'}`}>
        {selectedNode && (
          <>
            <div style={{ padding: '16px', borderBottom: '1px solid var(--border)' }}>
              <button
                onClick={() => setSelectedNode(null)}
                style={{
                  float: 'right', background: 'none', border: 'none',
                  color: 'var(--text-dim)', cursor: 'pointer', fontSize: '16px', fontFamily: 'var(--font)',
                }}
              >
                X
              </button>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div className="avatar" style={{ backgroundColor: selectedNode.avatarColor }}>
                  {selectedNode.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '14px' }}>{selectedNode.name}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>
                    {selectedNode.role} | {selectedNode.department}
                  </div>
                </div>
              </div>
            </div>

            <div style={{ padding: '16px', overflowY: 'auto', flex: 1 }}>
              <div style={{ fontSize: '11px', color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '12px' }}>
                Active Tasks ({selectedNode.activeTasks.length})
              </div>

              {selectedNode.activeTasks.length === 0 ? (
                <p style={{ color: 'var(--text-dim)', fontSize: '12px' }}>No active tasks</p>
              ) : (
                selectedNode.activeTasks.map(task => (
                  <div key={task.taskId} className="org-task-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <span style={{ fontWeight: 700, fontSize: '12px' }}>{task.title}</span>
                      <span className="badge" style={{ background: stateBadgeColor(task.state), color: '#111', fontSize: '9px' }}>
                        {task.state}
                      </span>
                    </div>

                    {/* Activity log area */}
                    <div className="org-log-area">
                      {(logEntries[task.taskId] || []).length === 0 ? (
                        <span style={{ color: 'var(--text-dim)' }}>No activity recorded yet</span>
                      ) : (
                        (logEntries[task.taskId] || []).map((entry, i) => (
                          <div key={i} style={{ marginBottom: '2px' }}>{entry}</div>
                        ))
                      )}
                    </div>

                    {/* Take His Role button -- visible for all working tasks */}
                    {task.state === 'working' && (
                      <button
                        className="btn-takeover"
                        style={{ marginTop: '8px', width: '100%' }}
                        onClick={() => handleTakeRole(task)}
                        disabled={!task.runId}
                        title={task.runId ? 'Take over this agent session' : 'Agent not yet running'}
                      >
                        Take His Role
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </div>

      {/* Terminal overlay for CEO session takeover */}
      {activeTerminal && (
        <TerminalOverlay
          runId={activeTerminal.runId}
          agentName={selectedNode?.name}
          onClose={handleTerminalClose}
        />
      )}
    </div>
  );
}
