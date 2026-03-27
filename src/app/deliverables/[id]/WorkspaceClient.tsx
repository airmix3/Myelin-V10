'use client';

import { useState, useCallback, useEffect } from 'react';
import { useSSE } from '@/components/useSSE';
import WorkspaceChatPanel from '@/components/WorkspaceChatPanel';
import MetadataBar from '@/components/MetadataBar';
import DeliverablePanel from '@/components/DeliverablePanel';
import AgentLogPanel from '@/components/AgentLogPanel';
import BuildLogPanel from '@/components/BuildLogPanel';
import FilesPanel from '@/components/FilesPanel';

interface WorkspaceClientProps {
  deliverable: Record<string, unknown>;
  task: Record<string, unknown>;
  initialChat: Array<Record<string, unknown>>;
  activityLog: Array<Record<string, unknown>>;
  hireRequests: Array<Record<string, unknown>>;
}

type TabId = 'deliverable' | 'agent-log' | 'build-log' | 'files';

interface BuildLogEntry {
  type: string;
  agentId?: string;
  content?: unknown;
  message?: string;
  timestamp?: string;
  attempt?: number;
  retry_delay_ms?: number;
  tool_name?: string;
  elapsed_time_seconds?: number;
  summary?: string;
  tool_use_id?: string;
}

export default function WorkspaceClient({
  deliverable,
  task,
  initialChat,
  activityLog,
  hireRequests: initialHireRequests,
}: WorkspaceClientProps) {
  const taskId = task.id as string;
  const taskState = task.state as string;
  const taskMetadata = task.metadata ? JSON.parse(task.metadata as string) : {};

  // Default tab: Build Log when working, Deliverable when completed with primaryFile
  const defaultTab: TabId =
    taskState === 'completed' && deliverable.primaryFile ? 'deliverable' : 'build-log';

  const [activeTab, setActiveTab] = useState<TabId>(defaultTab);
  const [buildLogEntries, setBuildLogEntries] = useState<BuildLogEntry[]>([]);
  const [currentTaskState, setCurrentTaskState] = useState(taskState);
  const [currentTaskMetadata, setCurrentTaskMetadata] = useState<Record<string, unknown>>(taskMetadata);
  const [transitionCounter, setTransitionCounter] = useState(0);
  const [fileRefreshCounter, setFileRefreshCounter] = useState(0);
  const [fileCount, setFileCount] = useState(0);
  const [currentHireRequests, setCurrentHireRequests] = useState(initialHireRequests);

  // Fetch file count on mount
  useEffect(() => {
    const fetchFileCount = async () => {
      try {
        const res = await fetch(`/api/deliverables/${deliverable.id}/file?list=true`);
        if (res.ok) {
          const data = await res.json();
          setFileCount(data.files?.length ?? 0);
        }
      } catch { /* ignore */ }
    };
    fetchFileCount();
  }, [deliverable.id, fileRefreshCounter]);

  // SSE subscriptions
  useSSE({
    'task:buildlog': useCallback((data: Record<string, unknown>) => {
      if (data.taskId !== taskId) return;
      setBuildLogEntries(prev => [...prev, data as BuildLogEntry]);
      // Files may have been created - bump refresh counter
      setFileRefreshCounter(prev => prev + 1);
    }, [taskId]),

    'task:transition': useCallback((data: Record<string, unknown>) => {
      if (data.taskId !== taskId) return;
      setCurrentTaskState(data.to as string);
      if (data.metadata) {
        setCurrentTaskMetadata(data.metadata as Record<string, unknown>);
      }
      setTransitionCounter(prev => prev + 1);
    }, [taskId]),

    'task:review': useCallback((data: Record<string, unknown>) => {
      if (data.taskId !== taskId) return;
      // Actor changed, trigger chat re-fetch
      setTransitionCounter(prev => prev + 1);
    }, [taskId]),
  });

  const handleApprovalAction = useCallback(async (action: string, payload?: Record<string, unknown>) => {
    if (action === 'hire_approve' && payload?.hireRequestId) {
      try {
        const res = await fetch(`/api/hire_requests/${payload.hireRequestId}/approve`, { method: 'POST' });
        if (res.ok) {
          setCurrentHireRequests(prev => prev.filter(h => (h as Record<string, unknown>).id !== payload.hireRequestId));
        }
      } catch { /* ignore */ }
    } else if (action === 'hire_reject' && payload?.hireRequestId) {
      try {
        const res = await fetch(`/api/hire_requests/${payload.hireRequestId}/reject`, { method: 'POST' });
        if (res.ok) {
          setCurrentHireRequests(prev => prev.filter(h => (h as Record<string, unknown>).id !== payload.hireRequestId));
        }
      } catch { /* ignore */ }
    } else if (action === 'budget_increase' && payload?.maxBudgetUsd) {
      try {
        await fetch(`/api/tasks/${taskId}/budget`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ maxBudgetUsd: payload.maxBudgetUsd }),
        });
      } catch { /* ignore */ }
    }
  }, [taskId]);

  const tabs: Array<{ id: TabId; label: string }> = [
    { id: 'deliverable', label: 'Deliverable' },
    { id: 'agent-log', label: 'Agent Log' },
    { id: 'build-log', label: 'Build Log' },
    { id: 'files', label: `Files (${fileCount})` },
  ];

  return (
    <div className="split-pane" style={{ marginLeft: '-24px', marginTop: '-24px', width: 'calc(100% + 48px)', height: 'calc(100vh - 0px)' }}>
      {/* Left: Chat Panel (400px) */}
      <div className="ws-split-chat">
        <WorkspaceChatPanel
          deliverableId={deliverable.id as string}
          taskId={taskId}
          currentActorId={task.currentActorId as string | null}
          initialMessages={initialChat}
          transitionCounter={transitionCounter}
        />
      </div>

      {/* Right: Workspace */}
      <div className="ws-split-workspace">
        <MetadataBar
          deliverableId={deliverable.id as string}
          creatorId={deliverable.creatorId as string | null}
          department={deliverable.department as string}
          type={deliverable.type as string | null}
          createdAt={deliverable.createdAt as string}
          taskDescription={task.description as string | null}
        />

        {/* Tab bar */}
        <div className="tab-bar">
          {tabs.map(tab => (
            <button
              key={tab.id}
              className={`tab ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="tab-content">
          {activeTab === 'deliverable' && (
            <DeliverablePanel
              deliverableId={deliverable.id as string}
              primaryFile={deliverable.primaryFile as string | null}
              manifestPath={deliverable.manifestPath as string | null}
            />
          )}

          {activeTab === 'agent-log' && (
            <AgentLogPanel activityLog={activityLog as Array<{
              id: string;
              taskId: string | null;
              agentId: string | null;
              actionType: string;
              description: string | null;
              metadata: string | null;
              createdAt: string;
            }>} />
          )}

          {activeTab === 'build-log' && (
            <BuildLogPanel
              entries={buildLogEntries}
              taskId={taskId}
              taskState={currentTaskState}
              taskMetadata={currentTaskMetadata}
              hireRequests={currentHireRequests}
              onApprovalAction={handleApprovalAction}
            />
          )}

          {activeTab === 'files' && (
            <FilesPanel
              deliverableId={deliverable.id as string}
              workspacePath={deliverable.workspacePath as string || ''}
              refreshCounter={fileRefreshCounter}
            />
          )}
        </div>
      </div>
    </div>
  );
}
