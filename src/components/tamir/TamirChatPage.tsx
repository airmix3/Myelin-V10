'use client';

import { useCallback, useEffect, useRef, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { AnimatePresence } from 'motion/react';
import ChatSidebar, { type SidebarItem } from './ChatSidebar';
import ChatThread, { type ChatMessage } from './ChatThread';
import ChatInput from './ChatInput';
import PlanningCanvas from './PlanningCanvas';
import LiveExecutionPanel from './LiveExecutionPanel';
import MissionDetailsPanel from './MissionDetailsPanel';
import TaskAssetSelector, { type AssetTarget } from './TaskAssetSelector';
import ConfigPanel from './ConfigPanel';
import { useSSE } from '@/components/useSSE';

type WorkflowMode = 'consultation' | 'task';

type RoutingButton = {
  agentId: string;
  label: string;
};

type RoutingAction = {
  label: string;
  value: string;
  department?: string;
};

type HistoryMessage = {
  role: string;
  content: string;
  agentId?: string;
  ts?: string;
  turnType?: string;
  planMarkdown?: string | null;
};

type ThreadTask = {
  id: string;
  title: string;
  state: string;
  department: string;
  description?: string | null;
  metadata?: string | null;
  planMarkdown?: string | null;
  createdAt: string;
  deliverables?: Array<{ id: string; title: string; status: string }>;
};

function makeMessage(role: 'user' | 'assistant', content: string, extra?: Partial<ChatMessage>): ChatMessage {
  return {
    id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    role,
    content,
    timestamp: new Date().toISOString(),
    ...extra,
  };
}

function agentDepartment(agentId: string, fallback?: string): string {
  if (agentId === 'cto') return 'tech';
  if (agentId === 'cmo') return 'marketing';
  if (agentId === 'coo') return 'operations';
  return fallback ?? 'executive';
}

function departmentToAgentId(dept: string): string {
  switch (dept) {
    case 'tech': return 'cto';
    case 'marketing': return 'cmo';
    case 'operations': return 'coo';
    case 'cos': return 'tamir';
    default: return 'cto';
  }
}

function historyToMessage(entry: HistoryMessage): ChatMessage {
  return makeMessage(entry.role === 'user' ? 'user' : 'assistant', entry.content ?? '', {
    agentId: entry.agentId,
    timestamp: entry.ts,
  });
}

function TamirChatPageInner() {
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<WorkflowMode>('consultation');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeThreadId, setActiveThreadId] = useState<string | undefined>(undefined);
  const [selectedTask, setSelectedTask] = useState<ThreadTask | null>(null);

  const [conversationId, setConversationId] = useState<string | null>(null);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [department, setDepartment] = useState('');
  const [chosenAgentId, setChosenAgentId] = useState<string | null>(null);
  const [pendingAgentId, setPendingAgentId] = useState<string | null>(null);
  const [planMarkdown, setPlanMarkdown] = useState('');
  const [deliverableId, setDeliverableId] = useState<string | null>(null);
  const [taskLifecycle, setTaskLifecycle] = useState<string | null>(null);
  const [assetTarget, setAssetTarget] = useState<AssetTarget>({ mode: 'not-sure' });

  const [routingPromptId, setRoutingPromptId] = useState<string | null>(null);
  const [routingPromptTaskTitle, setRoutingPromptTaskTitle] = useState<string | null>(null);

  const clearRoutingPrompt = useCallback(() => {
    setMessages((prev) => (routingPromptId ? prev.filter((msg) => msg.id !== routingPromptId) : prev));
    setRoutingPromptId(null);
    setRoutingPromptTaskTitle(null);
  }, [routingPromptId]);

  const resetTaskState = useCallback(() => {
    setTaskId(null);
    setDepartment('');
    setChosenAgentId(null);
    setPendingAgentId(null);
    setPlanMarkdown('');
    setDeliverableId(null);
    setTaskLifecycle(null);
    setSelectedTask(null);
    setAssetTarget({ mode: 'not-sure' });
    clearRoutingPrompt();
  }, [clearRoutingPrompt]);

  const addMessage = useCallback((message: ChatMessage) => {
    setMessages((prev) => [...prev, message]);
  }, []);

  const streamMsgIdRef = useRef<string | null>(null);
  const conversationIdRef = useRef<string | null>(null);

  useEffect(() => { conversationIdRef.current = conversationId; }, [conversationId]);

  const updateMessageContent = useCallback((msgId: string, updater: (prev: string) => string) => {
    setMessages((prev) => prev.map((m) => m.id === msgId ? { ...m, content: updater(m.content) } : m));
  }, []);

  useSSE({
    'consult:stream': (data) => {
      const id = streamMsgIdRef.current;
      if (!id) return;
      // Accept stream events if: we're actively streaming AND either
      // conversationId matches, or we don't have one yet (new consultation)
      const cid = conversationIdRef.current;
      if (!cid || data.conversationId === cid) {
        updateMessageContent(id, (prev) => prev + (data.delta as string));
      }
    },
    'consult:done': (data) => {
      const cid = conversationIdRef.current;
      if (!cid || data.conversationId === cid) {
        streamMsgIdRef.current = null;
      }
    },
    'task:transition': (data) => {
      if (data.taskId === taskId) {
        const newState = String(data.newState ?? '');
        if (newState === 'completed' || newState === 'failed') {
          setTaskLifecycle(newState);
        }
      }
    },
  });

  const showRoutingPrompt = useCallback(
    (buttons: RoutingButton[], taskTitle?: string, fallbackDepartment?: string) => {
      const prompt = makeMessage('assistant', '', {
        agentId: 'tamir',
        type: 'action_confirmation',
        metadata: {
          actions: buttons.map((button) => ({
            label: button.label,
            value: button.agentId,
            department: agentDepartment(button.agentId, fallbackDepartment),
          })) satisfies RoutingAction[],
        },
      });

      setMessages((prev) => {
        const base = routingPromptId ? prev.filter((msg) => msg.id !== routingPromptId) : prev;
        return [...base, prompt];
      });
      setRoutingPromptId(prompt.id);
      setRoutingPromptTaskTitle(taskTitle ?? null);
    },
    [routingPromptId],
  );

  const linkConversationToTask = useCallback((nextTaskId: string) => {
    if (!conversationId) return;
    fetch('/api/tamir/conversations', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversationId, linkedTaskId: nextTaskId }),
    }).catch(() => {});
  }, [conversationId]);

  const processTurn = useCallback((turn: { turn_type: string; message: string; plan_markdown?: string | null }, agentId: string) => {
    addMessage(makeMessage('assistant', turn.message, { agentId }));

    if (turn.turn_type === 'plan_ready' && turn.plan_markdown) {
      setPlanMarkdown(turn.plan_markdown);
      setTaskLifecycle('plan_ready');
    }

    if (turn.turn_type === 'plan_update' && turn.plan_markdown) {
      setPlanMarkdown(turn.plan_markdown);
    }
  }, [addMessage]);

  const beginPlanning = useCallback(
    async (agentId: string, target: AssetTarget) => {
      if (!taskId) return;

      setChosenAgentId(agentId);
      setPendingAgentId(null);
      setLoading(true);
      addMessage(makeMessage('assistant', `Planning with ${agentId.toUpperCase()}...`, { agentId: 'tamir' }));

      try {
        const res = await fetch(`/api/tasks/${taskId}/message`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: "Let's plan this task.",
            agentId,
            assetTarget: target,
          }),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          addMessage(makeMessage('assistant', err.error || 'Agent failed to respond.', { agentId: 'tamir' }));
          return;
        }

        const data = await res.json();
        processTurn(data.turn, data.agent_id);
      } catch {
        addMessage(makeMessage('assistant', 'Agent failed to respond. Please try again.', { agentId: 'tamir' }));
      } finally {
        setLoading(false);
      }
    },
    [addMessage, processTurn, taskId],
  );

  const handleAssetTargetChange = useCallback(
    async (target: AssetTarget) => {
      setAssetTarget(target);
      if (target.mode === 'specific' && !target.assetId) return;
      if (!pendingAgentId) return;
      await beginPlanning(pendingAgentId, target);
    },
    [beginPlanning, pendingAgentId],
  );

  const createTaskFromMessage = useCallback(
    async (
      message: string,
      options: { appendRoutingResponse: boolean; showRoutingButtons: boolean },
    ) => {
      const res = await fetch('/api/tamir/route', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Tamir could not route this request.');
      }

      const data = await res.json();
      setMode('task');
      setTaskId(data.taskId);
      setDepartment(data.department || '');
      setPlanMarkdown('');
      setDeliverableId(null);
      setTaskLifecycle(null);
      setChosenAgentId(null);
      setPendingAgentId(null);
      setSelectedTask(null);
      setActiveThreadId(data.taskId);
      localStorage.setItem('tamir_active_task', data.taskId);
      linkConversationToTask(data.taskId);

      if (options.appendRoutingResponse && data.tamir_response) {
        addMessage(makeMessage('assistant', data.tamir_response, { agentId: 'tamir' }));
      }

      if (options.showRoutingButtons && Array.isArray(data.routing_buttons)) {
        showRoutingPrompt(data.routing_buttons, data.suggested_title || message, data.department || undefined);
      }

      return data;
    },
    [addMessage, linkConversationToTask, showRoutingPrompt],
  );

  const handlePlanningMessage = useCallback(
    async (message: string) => {
      if (!taskId) return;

      addMessage(makeMessage('user', message));
      setLoading(true);

      try {
        const res = await fetch(`/api/tasks/${taskId}/message`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message }),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          addMessage(makeMessage('assistant', err.error || 'Agent failed to respond.', { agentId: 'tamir' }));
          return;
        }

        const data = await res.json();
        processTurn(data.turn, data.agent_id);
      } catch {
        addMessage(makeMessage('assistant', 'Agent failed to respond. Please try again.', { agentId: 'tamir' }));
      } finally {
        setLoading(false);
      }
    },
    [addMessage, processTurn, taskId],
  );

  const handleSend = useCallback(
    async (text: string) => {
      if (mode === 'task' && taskId) {
        await handlePlanningMessage(text);
        return;
      }

      addMessage(makeMessage('user', text));
      setLoading(true);

      // Create a placeholder message for streaming tokens
      const streamId = `stream-${Date.now()}`;
      streamMsgIdRef.current = streamId;
      addMessage(makeMessage('assistant', '', { agentId: 'tamir', id: streamId }));

      try {
        const url = conversationId ? `/api/tamir/consult/${conversationId}` : '/api/tamir/consult';
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: text }),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          streamMsgIdRef.current = null;
          // Remove the empty streaming placeholder on error
          setMessages((prev) => prev.filter((m) => m.id !== streamId));
          addMessage(makeMessage('assistant', err.error || 'Tamir could not respond. Try again.', { agentId: 'tamir' }));
          return;
        }

        const data = await res.json();

        if (data.conversationId) {
          setConversationId(data.conversationId);
          setActiveThreadId(data.conversationId);
          localStorage.setItem('tamir_active_conversation', data.conversationId);
        }

        // Finalize the streaming message with the complete response
        streamMsgIdRef.current = null;
        setMessages((prev) => prev.map((m) => m.id === streamId ? { ...m, content: data.response } : m));

        if (data.classification === 'task_detected' && Array.isArray(data.routing_buttons)) {
          showRoutingPrompt(
            data.routing_buttons,
            data.detected_task?.title || text,
            data.detected_task?.department || undefined,
          );
        } else {
          clearRoutingPrompt();
        }
      } catch {
        streamMsgIdRef.current = null;
        // Remove the empty streaming placeholder on error
        setMessages((prev) => prev.filter((m) => m.id !== streamId));
        addMessage(makeMessage('assistant', 'Tamir could not respond. Try again.', { agentId: 'tamir' }));
      } finally {
        setLoading(false);
      }
    },
    [addMessage, clearRoutingPrompt, conversationId, handlePlanningMessage, mode, showRoutingPrompt, taskId],
  );

  const handleNewTask = useCallback(async () => {
    const lastUserMessage = [...messages].reverse().find((message) => message.role === 'user')?.content;
    const routingMessage = lastUserMessage || 'New task from consultation';

    setLoading(true);
    clearRoutingPrompt();

    try {
      await createTaskFromMessage(routingMessage, {
        appendRoutingResponse: true,
        showRoutingButtons: true,
      });
    } catch (error) {
      setMode('consultation');
      addMessage(makeMessage('assistant', error instanceof Error ? error.message : 'Failed to create task.', { agentId: 'tamir' }));
    } finally {
      setLoading(false);
    }
  }, [addMessage, clearRoutingPrompt, createTaskFromMessage, messages]);

  const handleRouteSelect = useCallback(
    async (agentId: string) => {
      if (agentId === '__cancel__') {
        clearRoutingPrompt();
        addMessage(makeMessage('assistant', 'Okay. We can keep this as a consultation for now.', { agentId: 'tamir' }));
        return;
      }

      if (mode === 'consultation') {
        const taskTitle = routingPromptTaskTitle
          || [...messages].reverse().find((message) => message.role === 'user')?.content
          || 'Detected task';

        setLoading(true);
        clearRoutingPrompt();

        try {
          await createTaskFromMessage(taskTitle, {
            appendRoutingResponse: false,
            showRoutingButtons: false,
          });
          setPendingAgentId(agentId);
          addMessage(makeMessage('assistant', 'Choose the task context before planning starts.', { agentId: 'tamir' }));
        } catch (error) {
          setMode('consultation');
          addMessage(makeMessage('assistant', error instanceof Error ? error.message : 'Failed to route task.', { agentId: 'tamir' }));
        } finally {
          setLoading(false);
        }
        return;
      }

      clearRoutingPrompt();
      setPendingAgentId(agentId);
      addMessage(makeMessage('assistant', 'Choose the task context before planning starts.', { agentId: 'tamir' }));
    },
    [addMessage, clearRoutingPrompt, createTaskFromMessage, messages, mode, routingPromptTaskTitle],
  );

  const handleApprove = useCallback(async (executorAgentId?: string) => {
    if (!taskId) return;

    setLoading(true);
    try {
      const bodyData: Record<string, unknown> = {};
      if (executorAgentId) bodyData.executorAgentId = executorAgentId;
      const res = await fetch(`/api/tasks/${taskId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyData),
      });
      const data = await res.json();

      if (data.deliverableId) {
        setDeliverableId(data.deliverableId);
        setTaskLifecycle('executing');
        addMessage(makeMessage('assistant', '', {
          agentId: 'tamir',
          metadata: { separatorType: 'plan-approved' },
        }));
      }
    } catch {
      addMessage(makeMessage('assistant', 'Failed to approve the plan. Please try again.', { agentId: 'tamir' }));
    } finally {
      setLoading(false);
    }
  }, [addMessage, taskId]);

  const loadTask = useCallback(async (nextTaskId: string) => {
    setLoading(true);
    try {
      const [taskRes, chatRes] = await Promise.all([
        fetch(`/api/tasks/${nextTaskId}`),
        fetch(`/api/tasks/${nextTaskId}/chat`),
      ]);

      if (!taskRes.ok || !chatRes.ok) return false;

      const task = await taskRes.json();
      const chatData = await chatRes.json();
      const meta = task.metadata || {};

      setMode('task');
      setTaskId(nextTaskId);
      setConversationId(null);
      setActiveThreadId(nextTaskId);
      setDepartment(task.department || '');
      lastLoadedDeptRef.current = task.department || '';
      setChosenAgentId(task.currentActorId || null);
      setPendingAgentId(null);
      setPlanMarkdown(task.planMarkdown || '');
      setDeliverableId(meta.deliverableId || null);
      setTaskLifecycle(task.lifecycle || null);
      setAssetTarget({
        mode: meta.targetAssetMode || 'not-sure',
        ...(meta.targetAssetId ? { assetId: meta.targetAssetId, assetTitle: meta.targetAssetTitle } : {}),
      });
      setMessages((chatData.messages || []).map((entry: HistoryMessage) => historyToMessage(entry)));
      setSelectedTask({
        id: task.id,
        title: task.title,
        state: task.state,
        department: task.department,
        description: task.description,
        metadata: task.metadata ? JSON.stringify(task.metadata) : null,
        planMarkdown: task.planMarkdown,
        createdAt: task.createdAt,
        deliverables: task.deliverables ?? [],
      });
      localStorage.setItem('tamir_active_task', nextTaskId);
      localStorage.removeItem('tamir_active_conversation');
      clearRoutingPrompt();
      return true;
    } catch {
      return false;
    } finally {
      setLoading(false);
    }
  }, [clearRoutingPrompt]);

  const loadConversation = useCallback(async (nextConversationId: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/tamir/consult/${nextConversationId}`);
      if (!res.ok) return false;

      const data = await res.json();
      setMode('consultation');
      setConversationId(nextConversationId);
      setActiveThreadId(nextConversationId);
      setMessages((data.messages || []).map((entry: HistoryMessage) => historyToMessage(entry)));
      resetTaskState();
      localStorage.setItem('tamir_active_conversation', nextConversationId);
      localStorage.removeItem('tamir_active_task');
      return true;
    } catch {
      return false;
    } finally {
      setLoading(false);
    }
  }, [resetTaskState]);

  const handleSelectThread = useCallback(async (thread: SidebarItem) => {
    if (thread.id === 'new') {
      localStorage.removeItem('tamir_active_task');
      localStorage.removeItem('tamir_active_conversation');
      setMode('consultation');
      setConversationId(null);
      setActiveThreadId(undefined);
      setMessages([]);
      resetTaskState();
      return;
    }

    if (thread.type === 'task') {
      const ok = await loadTask(thread.id);
      if (!ok) {
        addMessage(makeMessage('assistant', 'Failed to load this task thread.', { agentId: 'tamir' }));
      }
      return;
    }

    const ok = await loadConversation(thread.id);
    if (!ok) {
      addMessage(makeMessage('assistant', 'Failed to load this conversation.', { agentId: 'tamir' }));
    }
  }, [addMessage, loadConversation, loadTask, resetTaskState]);

  // Load active thread from localStorage on mount only.
  // Using refs to avoid re-running when callback identities change
  // (routingPromptId → clearRoutingPrompt → resetTaskState → loadConversation chain).
  const loadTaskRef = useRef(loadTask);
  const loadConversationRef = useRef(loadConversation);
  const beginPlanningRef = useRef(beginPlanning);
  const lastLoadedDeptRef = useRef<string>('');
  loadTaskRef.current = loadTask;
  loadConversationRef.current = loadConversation;
  beginPlanningRef.current = beginPlanning;

  // Load task from URL param (?taskId=X) on mount — takes priority over localStorage
  // When autoStart=true, automatically begin planning with the correct department head
  useEffect(() => {
    const urlTaskId = searchParams.get('taskId');
    const autoStart = searchParams.get('autoStart') === 'true';
    if (urlTaskId) {
      loadTaskRef.current(urlTaskId).then((ok) => {
        if (ok) {
          localStorage.setItem('tamir_active_task', urlTaskId);
          localStorage.removeItem('tamir_active_conversation');
          if (autoStart) {
            const dept = lastLoadedDeptRef.current;
            if (dept) {
              const agentId = departmentToAgentId(dept);
              beginPlanningRef.current(agentId, { mode: 'not-sure' });
            }
          }
        }
      });
    }
  }, [searchParams]);

  // Load active thread from localStorage on mount (skipped if URL param present)
  useEffect(() => {
    if (searchParams.get('taskId')) return;

    const storedTaskId = localStorage.getItem('tamir_active_task');
    if (storedTaskId) {
      loadTaskRef.current(storedTaskId).then((ok) => {
        if (!ok) localStorage.removeItem('tamir_active_task');
      });
      return;
    }

    const storedConversationId = localStorage.getItem('tamir_active_conversation');
    if (storedConversationId) {
      loadConversationRef.current(storedConversationId).then((ok) => {
        if (!ok) localStorage.removeItem('tamir_active_conversation');
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const isPostApproval = taskLifecycle === 'executing' || taskLifecycle === 'completed' || taskLifecycle === 'failed';
  const showPlanningCanvas = Boolean(planMarkdown) && !isPostApproval;
  const showExecutionPanel = isPostApproval && Boolean(taskId);
  const inputDisabled = loading || isPostApproval || Boolean(pendingAgentId);
  const inputPlaceholder = pendingAgentId
    ? 'Choose task context below to start planning...'
    : mode === 'task'
      ? (showPlanningCanvas ? 'Continue the planning conversation...' : 'What should the agent do next?')
      : 'Chat with Tamir...';

  return (
    <div className="flex h-full min-h-0 -m-6">
      <ChatSidebar
        onSelectThread={handleSelectThread}
        activeThreadId={activeThreadId}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <ChatThread
          messages={messages}
          loading={loading}
          onSuggestedPrompt={handleSend}
          onAction={handleRouteSelect}
        />

        {pendingAgentId && (
          <TaskAssetSelector
            value={assetTarget}
            onChange={handleAssetTargetChange}
          />
        )}

        {showPlanningCanvas && taskId && (
          <div
            className="shrink-0 flex items-center gap-3 px-4 py-3"
            style={{ borderTop: '1px solid rgba(255,255,255,0.06)', background: 'rgba(56,189,248,0.03)' }}
          >
            <span className="text-[12px] text-slate-400 flex-1">Plan is ready for approval</span>
            <button
              onClick={() => handleApprove()}
              disabled={loading}
              className="px-4 py-2 rounded-xl text-[13px] font-bold text-slate-900 cursor-pointer"
              style={{ background: 'linear-gradient(135deg, #38bdf8, #818cf8)' }}
            >
              Approve and Execute
            </button>
          </div>
        )}

        <ChatInput
          onSend={handleSend}
          disabled={inputDisabled}
          placeholder={inputPlaceholder}
          workflowMode={mode}
          onNewTask={mode === 'consultation' ? handleNewTask : undefined}
          newTaskDisabled={loading || !messages.some((message) => message.role === 'user')}
        />
      </div>

      <AnimatePresence>
        {showPlanningCanvas && taskId && (
          <PlanningCanvas
            key="planning-canvas"
            taskId={taskId}
            planMarkdown={planMarkdown}
            onPlanChange={setPlanMarkdown}
            onClose={() => {}}
          >
            <div className="px-4 py-4" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              <ConfigPanel
                taskId={taskId}
                initialConfig={{}}
                currentDepartment={department}
              />
            </div>
          </PlanningCanvas>
        )}
      </AnimatePresence>

      {showExecutionPanel && taskId && (
        <div className="shrink-0 w-1/2 h-full overflow-y-auto p-4" style={{ borderLeft: '1px solid rgba(255,255,255,0.06)' }}>
          <LiveExecutionPanel
            taskId={taskId}
            deliverableId={deliverableId ?? undefined}
            initialStatus={taskLifecycle === 'completed' ? 'completed' : taskLifecycle === 'failed' ? 'failed' : undefined}
          />
        </div>
      )}

      {selectedTask && !showPlanningCanvas && !showExecutionPanel && (
        <MissionDetailsPanel
          task={selectedTask}
          onClose={() => setSelectedTask(null)}
        />
      )}
    </div>
  );
}

export default function TamirChatPage() {
  return (
    <Suspense fallback={null}>
      <TamirChatPageInner />
    </Suspense>
  );
}
