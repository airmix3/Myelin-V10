'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import dynamic from 'next/dynamic';

const TerminalOverlay = dynamic(() => import('./TerminalOverlay'), { ssr: false });

interface ActiveTask {
  taskId: string;
  title: string;
  state: string;
  runId: string | null;
  sessionId: string | null;
  workspaceCwd: string | null;
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

interface SimNode extends OrgNode {
  x: number;
  y: number;
  vx: number;
  vy: number;
  fx: number | null;
  fy: number | null;
}

const NODE_RADIUS = 28;
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
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [nodes, setNodes] = useState<SimNode[]>([]);
  const [edges, setEdges] = useState<OrgEdge[]>([]);
  const [selectedNode, setSelectedNode] = useState<SimNode | null>(null);
  const [activeTerminal, setActiveTerminal] = useState<{ runId: string } | null>(null);
  const [logEntries, setLogEntries] = useState<Record<string, string[]>>({});

  // Camera state
  const cameraRef = useRef({ x: 0, y: 0, scale: 1 });
  // Drag state
  const dragRef = useRef<{
    type: 'node' | 'pan' | null;
    nodeId: string | null;
    startX: number;
    startY: number;
    lastX: number;
    lastY: number;
  }>({ type: null, nodeId: null, startX: 0, startY: 0, lastX: 0, lastY: 0 });
  // Simulation tick ref
  const simRef = useRef<number>(0);
  const nodesRef = useRef<SimNode[]>([]);

  // Fetch org data
  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/org-graph');
      const data = await res.json();
      if (data.nodes && data.edges) {
        // Initialize positions in a circle layout
        const cx = 400;
        const cy = 300;
        const simNodes: SimNode[] = data.nodes.map((n: OrgNode, i: number) => {
          const angle = (2 * Math.PI * i) / data.nodes.length;
          const r = data.nodes.length > 1 ? 150 : 0;
          return {
            ...n,
            x: cx + r * Math.cos(angle),
            y: cy + r * Math.sin(angle),
            vx: 0,
            vy: 0,
            fx: null,
            fy: null,
          };
        });
        // Place CEO at top center
        const ceoNode = simNodes.find(n => n.id === 'ceo');
        if (ceoNode) {
          ceoNode.x = cx;
          ceoNode.y = cy - 200;
        }
        setNodes(simNodes);
        nodesRef.current = simNodes;
        setEdges(data.edges);
      }
    } catch {
      // Silently fail
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // SSE log streaming for selected node's tasks
  useEffect(() => {
    if (!selectedNode || selectedNode.activeTasks.length === 0) return;
    const sources: EventSource[] = [];

    for (const task of selectedNode.activeTasks) {
      const es = new EventSource(`/api/sse?channel=task:${task.taskId}`);
      es.addEventListener('message', (event) => {
        try {
          const parsed = JSON.parse(event.data);
          const desc = parsed?.data?.event?.summary
            || parsed?.data?.event?.tool_name
            || parsed?.data?.event?.type
            || JSON.stringify(parsed).slice(0, 120);
          setLogEntries(prev => ({
            ...prev,
            [task.taskId]: [...(prev[task.taskId] || []).slice(-100), desc],
          }));
        } catch {
          // skip
        }
      });
      sources.push(es);
    }

    return () => {
      for (const es of sources) es.close();
    };
  }, [selectedNode]);

  // Force simulation
  useEffect(() => {
    if (nodes.length === 0) return;
    let running = true;
    let alpha = 1;

    function tick() {
      if (!running) return;

      const ns = nodesRef.current;
      const REPULSION = 5000;
      const SPRING = 0.005;
      const SPRING_LENGTH = 120;
      const GRAVITY = 0.01;
      const DAMPING = 0.9;
      const cx = 400;
      const cy = 300;

      // Repulsion between all nodes
      for (let i = 0; i < ns.length; i++) {
        for (let j = i + 1; j < ns.length; j++) {
          const dx = ns[j].x - ns[i].x;
          const dy = ns[j].y - ns[i].y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const force = REPULSION / (dist * dist);
          const fx = (dx / dist) * force * alpha;
          const fy = (dy / dist) * force * alpha;
          if (ns[i].fx === null) { ns[i].vx -= fx; ns[i].vy -= fy; }
          if (ns[j].fx === null) { ns[j].vx += fx; ns[j].vy += fy; }
        }
      }

      // Spring force along edges
      for (const edge of edges) {
        const a = ns.find(n => n.id === edge.from);
        const b = ns.find(n => n.id === edge.to);
        if (!a || !b) continue;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const displacement = dist - SPRING_LENGTH;
        const fx = (dx / dist) * displacement * SPRING * alpha;
        const fy = (dy / dist) * displacement * SPRING * alpha;
        if (a.fx === null) { a.vx += fx; a.vy += fy; }
        if (b.fx === null) { b.vx -= fx; b.vy -= fy; }
      }

      // Gravity toward center
      for (const n of ns) {
        if (n.fx !== null) continue;
        n.vx += (cx - n.x) * GRAVITY * alpha;
        n.vy += (cy - n.y) * GRAVITY * alpha;
      }

      // Apply velocity
      for (const n of ns) {
        if (n.fx !== null) {
          n.x = n.fx;
          n.y = n.fy!;
          n.vx = 0;
          n.vy = 0;
        } else {
          n.vx *= DAMPING;
          n.vy *= DAMPING;
          n.x += n.vx;
          n.y += n.vy;
        }
      }

      alpha *= 0.99;
      if (alpha < 0.001) alpha = 0.001;

      setNodes([...ns]);
      simRef.current = requestAnimationFrame(tick);
    }

    simRef.current = requestAnimationFrame(tick);
    return () => {
      running = false;
      cancelAnimationFrame(simRef.current);
    };
  }, [edges, nodes.length]);

  // Canvas rendering
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const container = containerRef.current;
    if (container) {
      canvas.width = container.clientWidth;
      canvas.height = container.clientHeight;
    }

    const cam = cameraRef.current;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.translate(cam.x, cam.y);
    ctx.scale(cam.scale, cam.scale);

    // Draw edges
    ctx.strokeStyle = '#2a2a4a';
    ctx.lineWidth = 1.5;
    for (const edge of edges) {
      const a = nodes.find(n => n.id === edge.from);
      const b = nodes.find(n => n.id === edge.to);
      if (!a || !b) continue;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }

    // Draw nodes
    for (const node of nodes) {
      const color = DEPT_COLORS[node.department] || node.avatarColor || '#666';
      const isSelected = selectedNode?.id === node.id;

      // Node circle
      ctx.beginPath();
      ctx.arc(node.x, node.y, NODE_RADIUS, 0, 2 * Math.PI);
      ctx.fillStyle = color;
      ctx.globalAlpha = isSelected ? 1 : 0.85;
      ctx.fill();
      ctx.globalAlpha = 1;

      // Selection ring
      if (isSelected) {
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 3;
        ctx.stroke();
      }

      // Avatar letter
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 14px JetBrains Mono, monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(node.name.charAt(0).toUpperCase(), node.x, node.y);

      // Name label below
      ctx.fillStyle = '#e0e0e0';
      ctx.font = '11px JetBrains Mono, monospace';
      ctx.fillText(node.name, node.x, node.y + NODE_RADIUS + 14);

      // Status indicator dot
      const hasRunning = node.activeTasks.some(t => t.state === 'working');
      if (hasRunning) {
        ctx.beginPath();
        ctx.arc(node.x + NODE_RADIUS - 4, node.y - NODE_RADIUS + 4, 6, 0, 2 * Math.PI);
        ctx.fillStyle = '#00d68f';
        ctx.fill();
        ctx.strokeStyle = '#1a1a2e';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }

    ctx.restore();
  }, [nodes, edges, selectedNode]);

  // Handle window resize
  useEffect(() => {
    function handleResize() {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (canvas && container) {
        canvas.width = container.clientWidth;
        canvas.height = container.clientHeight;
      }
    }
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Mouse interaction handlers
  function screenToWorld(sx: number, sy: number) {
    const cam = cameraRef.current;
    return {
      x: (sx - cam.x) / cam.scale,
      y: (sy - cam.y) / cam.scale,
    };
  }

  function hitTest(wx: number, wy: number): SimNode | null {
    // Reverse order so top-drawn nodes are hit first
    for (let i = nodes.length - 1; i >= 0; i--) {
      const n = nodes[i];
      const dx = wx - n.x;
      const dy = wy - n.y;
      if (dx * dx + dy * dy < NODE_RADIUS * NODE_RADIUS) return n;
    }
    return null;
  }

  function handleMouseDown(e: React.MouseEvent<HTMLCanvasElement>) {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const { x: wx, y: wy } = screenToWorld(sx, sy);

    const hitNode = hitTest(wx, wy);
    if (hitNode && hitNode.id !== 'ceo') {
      dragRef.current = { type: 'node', nodeId: hitNode.id, startX: wx, startY: wy, lastX: sx, lastY: sy };
      // Pin the node
      const ns = nodesRef.current;
      const n = ns.find(nn => nn.id === hitNode.id);
      if (n) { n.fx = n.x; n.fy = n.y; }
    } else {
      dragRef.current = { type: 'pan', nodeId: null, startX: sx, startY: sy, lastX: sx, lastY: sy };
    }
  }

  function handleMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
    const drag = dragRef.current;
    if (!drag.type) return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;

    if (drag.type === 'node' && drag.nodeId) {
      const { x: wx, y: wy } = screenToWorld(sx, sy);
      const ns = nodesRef.current;
      const n = ns.find(nn => nn.id === drag.nodeId);
      if (n) { n.fx = wx; n.fy = wy; n.x = wx; n.y = wy; }
    } else if (drag.type === 'pan') {
      const dx = sx - drag.lastX;
      const dy = sy - drag.lastY;
      cameraRef.current.x += dx;
      cameraRef.current.y += dy;
    }

    drag.lastX = sx;
    drag.lastY = sy;
  }

  function handleMouseUp(e: React.MouseEvent<HTMLCanvasElement>) {
    const drag = dragRef.current;
    if (drag.type === 'node' && drag.nodeId) {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (rect) {
        const sx = e.clientX - rect.left;
        const sy = e.clientY - rect.top;
        const movedDist = Math.hypot(sx - drag.startX, sy - drag.startY);
        // If barely moved, treat as click -> select node
        if (movedDist < 5) {
          const node = nodesRef.current.find(n => n.id === drag.nodeId);
          if (node) setSelectedNode(prev => prev?.id === node.id ? null : node);
        }
      }
      // Unpin node
      const ns = nodesRef.current;
      const n = ns.find(nn => nn.id === drag.nodeId);
      if (n) { n.fx = null; n.fy = null; }
    }
    dragRef.current = { type: null, nodeId: null, startX: 0, startY: 0, lastX: 0, lastY: 0 };
  }

  function handleWheel(e: React.WheelEvent<HTMLCanvasElement>) {
    e.preventDefault();
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const cam = cameraRef.current;
    const scaleFactor = e.deltaY > 0 ? 0.95 : 1.05;
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    // Zoom toward mouse position
    cam.x = mx - (mx - cam.x) * scaleFactor;
    cam.y = my - (my - cam.y) * scaleFactor;
    cam.scale *= scaleFactor;
    cam.scale = Math.max(0.3, Math.min(3, cam.scale));
  }

  function handleTakeRole(task: ActiveTask) {
    if (task.runId) {
      setActiveTerminal({ runId: task.runId });
    }
  }

  function handleTerminalClose() {
    setActiveTerminal(null);
    // Refresh data after terminal session
    fetchData();
  }

  return (
    <div className="org-graph-container" ref={containerRef}>
      <canvas
        ref={canvasRef}
        className="org-graph-canvas"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
      />

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

                    {/* Live log area */}
                    <div className="org-log-area">
                      {(logEntries[task.taskId] || []).length === 0 ? (
                        <span style={{ color: 'var(--text-dim)' }}>Waiting for activity...</span>
                      ) : (
                        (logEntries[task.taskId] || []).map((entry, i) => (
                          <div key={i} style={{ marginBottom: '2px' }}>{entry}</div>
                        ))
                      )}
                    </div>

                    {/* Take His Role button */}
                    {task.runId && task.sessionId && (
                      <button
                        className="btn-takeover"
                        style={{ marginTop: '8px', width: '100%' }}
                        onClick={() => handleTakeRole(task)}
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
