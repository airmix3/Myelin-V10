'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import { useSSE } from '@/components/useSSE';
import NeuralHero from './components/NeuralHero';

const OrgGraphClient = dynamic(() => import('@/app/org-graph/OrgGraphClient'), { ssr: false });

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

function formatTimestamp(isoString: string): string {
  const d = new Date(isoString);
  return d.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function badgeClass(actionType: string): string {
  switch (actionType) {
    case 'SDK_TOOL_USE':
    case 'TOOL_USE':
      return 'activity-badge activity-badge-tool';
    case 'SDK_ASSISTANT':
    case 'ASSISTANT':
      return 'activity-badge activity-badge-assistant';
    case 'TASK_TRANSITION':
      return 'activity-badge activity-badge-transition';
    default:
      return 'activity-badge activity-badge-default';
  }
}

function badgeLabel(actionType: string): string {
  switch (actionType) {
    case 'SDK_TOOL_USE':
    case 'TOOL_USE':
      return 'TOOL';
    case 'SDK_ASSISTANT':
    case 'ASSISTANT':
      return 'ASST';
    case 'TASK_TRANSITION':
      return 'TRANS';
    default:
      return actionType.substring(0, 5);
  }
}

export default function DashboardClient({ stats, agents, initialActivities, inProgressDeliverables }: DashboardClientProps) {
  const [activities, setActivities] = useState<Activity[]>(initialActivities.filter(isUsefulActivity));
  const [agentTimestamps, setAgentTimestamps] = useState<Record<string, number>>({});
  const [, setTick] = useState(0);
  const activityBodyRef = useRef<HTMLDivElement>(null);

  // Update dot colors every 10 seconds
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 10_000);
    return () => clearInterval(interval);
  }, []);

  // Auto-scroll activity overlay
  useEffect(() => {
    if (activityBodyRef.current) {
      activityBodyRef.current.scrollTop = activityBodyRef.current.scrollHeight;
    }
  }, [activities]);

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
    setActivities((prev) => [...prev, activity].slice(-15));
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

  // Suppress unused variable warnings — these are passed as props and used implicitly
  void agents;
  void agentTimestamps;
  void inProgressDeliverables;

  const heroStats = [
    { label: 'Agents', value: stats.activeAgents },
    { label: 'Tasks', value: stats.activeTasks },
    { label: 'Approvals', value: stats.pendingApprovals },
    { label: 'Deliverables', value: stats.deliverableCount },
  ];

  return (
    <div>
      {/* 1. Neural Hero */}
      <NeuralHero title="MYELIN v3" subtitle="The Cortex" stats={heroStats} />

      {/* 2. Org Graph Section with Activity Overlay */}
      <div className="dashboard-org-section">
        <OrgGraphClient />

        {/* 3. Activity Log Overlay */}
        <div className="activity-overlay">
          <div className="activity-overlay-header">
            <span className="blink-dot" />
            Activity Log
          </div>
          <div className="activity-overlay-body" ref={activityBodyRef}>
            {activities.length === 0 ? (
              <div style={{ padding: '14px', color: 'var(--text-dim)', fontSize: '11px' }}>
                No recent activity
              </div>
            ) : (
              activities.map((a) => (
                <div key={a.id} className="activity-entry">
                  <span className="activity-ts">{formatTimestamp(a.createdAt)}</span>
                  <span className={badgeClass(a.actionType)}>{badgeLabel(a.actionType)}</span>
                  {a.agentId && <span className="activity-agent">{a.agentId}</span>}
                  <span className="activity-desc">
                    {(a.description || '---').substring(0, 60)}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
