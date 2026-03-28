'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSSE } from '@/components/useSSE';

interface Agent {
  id: string;
  name: string;
  agentId: string | null;
  department: string;
}

interface Activity {
  id: string;
  taskId: string | null;
  agentId: string | null;
  actionType: string;
  description: string | null;
  createdAt: string;
}

interface Deliverable {
  id: string;
  title: string;
  department: string;
  taskId: string | null;
  createdAt: string;
}

interface DashboardClientProps {
  stats: {
    activeAgents: number;
    activeTasks: number;
    pendingApprovals: number;
    deliverableCount: number;
  };
  agents: Agent[];
  initialActivities: Activity[];
  inProgressDeliverables: Deliverable[];
}

function isUsefulActivity(activity: Activity): boolean {
  if (activity.actionType !== 'SDK_ASSISTANT') return true;
  const description = activity.description?.trim();
  return Boolean(description && description !== 'Assistant message');
}

function formatRelativeTime(isoString: string): string {
  const now = Date.now();
  const then = new Date(isoString).getTime();
  const diffSec = Math.floor((now - then) / 1000);

  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay}d ago`;
}

function getDotClass(lastSeen: number | undefined): string {
  if (!lastSeen) return 'dot dot-gray';
  const age = Date.now() - lastSeen;
  if (age < 30_000) return 'dot dot-green';
  if (age < 120_000) return 'dot dot-amber';
  return 'dot dot-gray';
}

function deptBadgeClass(dept: string): string {
  switch (dept) {
    case 'tech': return 'badge-tech';
    case 'marketing': return 'badge-marketing';
    case 'operations': return 'badge-ops';
    default: return 'badge-tech';
  }
}

export default function DashboardClient({ stats, agents, initialActivities, inProgressDeliverables }: DashboardClientProps) {
  const [activities, setActivities] = useState<Activity[]>(initialActivities.filter(isUsefulActivity));
  const [agentTimestamps, setAgentTimestamps] = useState<Record<string, number>>({});
  const [, setTick] = useState(0);

  // Update dot colors every 10 seconds
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 10_000);
    return () => clearInterval(interval);
  }, []);

  const updateAgentTimestamp = useCallback((agentId: string, ts: number) => {
    setAgentTimestamps((prev) => ({ ...prev, [agentId]: ts }));
  }, []);

  const prependActivity = useCallback((data: Record<string, unknown>) => {
    const activity: Activity = {
      id: (data.id as string) || String(Date.now()),
      taskId: (data.taskId as string) || null,
      agentId: (data.agentId as string) || null,
      actionType: (data.actionType as string) || (data.type as string) || 'TASK_TRANSITION',
      description: (data.description as string) || (data.message as string) || null,
      createdAt: new Date().toISOString(),
    };
    if (!isUsefulActivity(activity)) return;
    setActivities((prev) => [activity, ...prev].slice(0, 10));
  }, []);

  useSSE({
    'task:heartbeat': (data) => {
      const agentId = data.agentId as string;
      if (agentId) updateAgentTimestamp(agentId, Date.now());
    },
    'agent:invoked': (data) => {
      const agentId = data.agentId as string;
      if (agentId) updateAgentTimestamp(agentId, Date.now());
    },
    'task:transition': (data) => {
      prependActivity(data);
      const agentId = data.agentId as string;
      if (agentId) updateAgentTimestamp(agentId, Date.now());
    },
  });

  return (
    <div>
      <h1>Dashboard</h1>

      {/* Stats Row */}
      <div className="stat-row">
        <div className="card" style={{ textAlign: 'center', flex: 1 }}>
          <div className="stat-value">{stats.activeAgents ?? '--'}</div>
          <div className="stat-label">Active Agents</div>
        </div>
        <div className="card" style={{ textAlign: 'center', flex: 1 }}>
          <div className="stat-value">{stats.activeTasks ?? '--'}</div>
          <div className="stat-label">Active Tasks</div>
        </div>
        <div className="card" style={{ textAlign: 'center', flex: 1 }}>
          <div className="stat-value">{stats.pendingApprovals ?? '--'}</div>
          <div className="stat-label">Pending Approvals</div>
        </div>
        <div className="card" style={{ textAlign: 'center', flex: 1 }}>
          <div className="stat-value">{stats.deliverableCount ?? '--'}</div>
          <div className="stat-label">Deliverables</div>
        </div>
      </div>

      <div className="grid-2">
        {/* Agent Status Panel */}
        <div className="card">
          <div className="card-title">AGENT STATUS</div>
          {agents.length === 0 ? (
            <div style={{ color: 'var(--text-dim)' }}>
              <p style={{ fontWeight: 700 }}>No active agents</p>
              <p>Agents will appear here when tasks are running.</p>
            </div>
          ) : (
            <div>
              {agents.map((agent) => (
                <div key={agent.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <span className={getDotClass(agentTimestamps[agent.agentId || agent.id])} />
                  <span style={{ fontWeight: 700 }}>{agent.name}</span>
                  <span className={deptBadgeClass(agent.department)}>{agent.department}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Activity Timeline */}
        <div className="card">
          <div className="card-title">RECENT ACTIVITY</div>
          {activities.length === 0 ? (
            <div style={{ color: 'var(--text-dim)' }}>
              <p style={{ fontWeight: 700 }}>No recent activity</p>
              <p>Activity will appear here once agents start executing tasks.</p>
            </div>
          ) : (
            <div>
              {activities.map((activity) => (
                <div key={activity.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <span className="badge-active" style={{ fontSize: '11px' }}>{activity.actionType}</span>
                  <span style={{ flex: 1, color: 'var(--text-dim)' }}>{activity.description || '—'}</span>
                  <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>
                    {formatRelativeTime(activity.createdAt)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* In-Progress Deliverables */}
      <div className="card">
        <div className="card-title">IN-PROGRESS DELIVERABLES</div>
        {inProgressDeliverables.length === 0 ? (
          <div style={{ color: 'var(--text-dim)' }}>No deliverables in progress</div>
        ) : (
          <div>
            {inProgressDeliverables.map((d) => (
              <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <span className={deptBadgeClass(d.department)}>{d.department}</span>
                <a
                  href={`/deliverables/${d.id}`}
                  style={{ color: 'var(--text-primary)', textDecoration: 'none', fontWeight: 500, flex: 1 }}
                >
                  {d.title}
                </a>
                <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>
                  {formatRelativeTime(d.createdAt)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
