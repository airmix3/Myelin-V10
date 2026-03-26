'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import ChatPanel, { ChatMessage, RoutingButton } from '@/components/ChatPanel';
import CanvasPanel from '@/components/CanvasPanel';

export default function TamirPage() {
  const router = useRouter();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [routingButtons, setRoutingButtons] = useState<RoutingButton[] | null>(null);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showCanvas, setShowCanvas] = useState(false);
  const [planMarkdown, setPlanMarkdown] = useState<string | null>(null);
  const [chosenAgentId, setChosenAgentId] = useState<string | null>(null);
  const [isNewPlan, setIsNewPlan] = useState(true);
  const [department, setDepartment] = useState<string>('');
  const [cancelPending, setCancelPending] = useState(false);
  const cancelTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Page rehydration (D-16, D-17)
  useEffect(() => {
    const storedTaskId = localStorage.getItem('tamir_active_task');
    if (!storedTaskId) return;

    const rehydrate = async () => {
      try {
        // Load chat history
        const chatRes = await fetch(`/api/tasks/${storedTaskId}/chat`);
        if (!chatRes.ok) {
          localStorage.removeItem('tamir_active_task');
          return;
        }
        const { messages: history } = await chatRes.json();
        if (!history || history.length === 0) {
          localStorage.removeItem('tamir_active_task');
          return;
        }

        setTaskId(storedTaskId);
        setMessages(history);

        // Check if task has a plan artifact -- render canvas immediately (no typewriter)
        const taskRes = await fetch(`/api/tasks/${storedTaskId}`);
        if (taskRes.ok) {
          const taskData = await taskRes.json();
          if (taskData.planMarkdown) {
            setPlanMarkdown(taskData.planMarkdown);
            setShowCanvas(true);
            setIsNewPlan(false); // Render immediately, no typewriter replay
          }
          if (taskData.currentActorId) {
            setChosenAgentId(taskData.currentActorId);
          }
          if (taskData.department) {
            setDepartment(taskData.department);
          }
        }
      } catch {
        localStorage.removeItem('tamir_active_task');
      }
    };

    rehydrate();
  }, []);

  // Process agent turn response
  const processTurn = useCallback(
    (turn: { turn_type: string; message: string; plan_markdown?: string | null }, agentId: string) => {
      // Add agent message to chat
      const agentMsg: ChatMessage = {
        role: 'agent',
        content: turn.message,
        ts: new Date().toISOString(),
        agentId,
        turnType: turn.turn_type,
        planMarkdown: turn.plan_markdown || undefined,
      };
      setMessages((prev) => [...prev, agentMsg]);

      // Handle plan_ready: show canvas with typewriter (D-07)
      if (turn.turn_type === 'plan_ready' && turn.plan_markdown) {
        setPlanMarkdown(turn.plan_markdown);
        setShowCanvas(true);
        setIsNewPlan(true);
      }

      // Handle plan_update: update existing plan
      if (turn.turn_type === 'plan_update' && turn.plan_markdown) {
        setPlanMarkdown(turn.plan_markdown);
      }

      // Handle done: show completion state
      if (turn.turn_type === 'done') {
        const systemMsg: ChatMessage = {
          role: 'system',
          content: 'Planning complete.',
          ts: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, systemMsg]);
      }
    },
    [],
  );

  // First message: route via Tamir (D-04)
  const handleSend = useCallback(
    async (message: string) => {
      // If we already have a taskId, this is a planning turn
      if (taskId) {
        return handlePlanningMessage(message);
      }

      // Add CEO message to chat
      const ceoMsg: ChatMessage = {
        role: 'user',
        content: message,
        ts: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, ceoMsg]);
      setIsLoading(true);

      try {
        const res = await fetch('/api/tamir/route', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message }),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          const errorMsg: ChatMessage = {
            role: 'system',
            content: err.error || 'Tamir could not route this request. Try rephrasing your task description.',
            ts: new Date().toISOString(),
          };
          setMessages((prev) => [...prev, errorMsg]);
          setIsLoading(false);
          return;
        }

        const data = await res.json();
        setTaskId(data.taskId);
        setDepartment(data.department || '');
        localStorage.setItem('tamir_active_task', data.taskId);

        // Add Tamir's routing response
        const tamirMsg: ChatMessage = {
          role: 'agent',
          content: data.tamir_response,
          ts: new Date().toISOString(),
          agentId: 'tamir',
          turnType: 'routing',
        };
        setMessages((prev) => [...prev, tamirMsg]);

        // Show routing buttons
        setRoutingButtons(data.routing_buttons);
      } catch {
        const errorMsg: ChatMessage = {
          role: 'system',
          content: 'Tamir could not route this request. Try rephrasing your task description.',
          ts: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, errorMsg]);
      } finally {
        setIsLoading(false);
      }
    },
    [taskId],
  );

  // Route selection: CEO picks a department head (D-05)
  const handleRouteSelect = useCallback(
    async (agentId: string) => {
      setChosenAgentId(agentId);
      setRoutingButtons(null); // Hide buttons

      // Add system message
      const systemMsg: ChatMessage = {
        role: 'system',
        content: `Planning with ${agentId.toUpperCase()}...`,
        ts: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, systemMsg]);
      setIsLoading(true);

      try {
        const res = await fetch(`/api/tasks/${taskId}/message`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: "Let's plan this task.", agentId }),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          const errorMsg: ChatMessage = {
            role: 'system',
            content: err.error || 'Agent failed to respond.',
            ts: new Date().toISOString(),
          };
          setMessages((prev) => [...prev, errorMsg]);
          return;
        }

        const data = await res.json();
        processTurn(data.turn, data.agent_id);
      } catch {
        const errorMsg: ChatMessage = {
          role: 'system',
          content: 'Agent failed to respond. Please try again.',
          ts: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, errorMsg]);
      } finally {
        setIsLoading(false);
      }
    },
    [taskId, processTurn],
  );

  // Multi-turn planning messages
  const handlePlanningMessage = useCallback(
    async (message: string) => {
      // Add CEO message
      const ceoMsg: ChatMessage = {
        role: 'user',
        content: message,
        ts: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, ceoMsg]);
      setIsLoading(true);

      try {
        const res = await fetch(`/api/tasks/${taskId}/message`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message }),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          const errorMsg: ChatMessage = {
            role: 'system',
            content: err.error || 'Agent failed to respond.',
            ts: new Date().toISOString(),
          };
          setMessages((prev) => [...prev, errorMsg]);
          return;
        }

        const data = await res.json();
        processTurn(data.turn, data.agent_id);
      } catch {
        const errorMsg: ChatMessage = {
          role: 'system',
          content: 'Agent failed to respond. Please try again.',
          ts: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, errorMsg]);
      } finally {
        setIsLoading(false);
      }
    },
    [taskId, processTurn],
  );

  const handleApprove = useCallback(async () => {
    if (!taskId) return;
    setIsLoading(true);
    try {
      const res = await fetch(`/api/tasks/${taskId}/approve`, { method: 'POST' });
      const data = await res.json();
      if (data.redirect) {
        localStorage.removeItem('tamir_active_task');
        router.push(data.redirect);
      }
    } catch {
      setMessages((prev) => [...prev, {
        role: 'system' as const,
        content: 'Failed to approve plan. Please try again.',
        ts: new Date().toISOString(),
      }]);
    } finally {
      setIsLoading(false);
    }
  }, [taskId, router]);

  // Cancel task with inline confirmation
  const handleCancelClick = useCallback(() => {
    if (cancelPending) {
      // Confirm cancel
      handleCancelConfirm();
    } else {
      setCancelPending(true);
      // Revert after 3s
      cancelTimerRef.current = setTimeout(() => {
        setCancelPending(false);
      }, 3000);
    }
  }, [cancelPending]);

  const handleCancelConfirm = useCallback(async () => {
    if (!taskId) return;
    setCancelPending(false);
    if (cancelTimerRef.current) clearTimeout(cancelTimerRef.current);
    try {
      await fetch(`/api/tasks/${taskId}/cancel`, { method: 'POST' });
      localStorage.removeItem('tamir_active_task');
      setTaskId(null);
      setShowCanvas(false);
      setPlanMarkdown(null);
      setRoutingButtons(null);
      setDepartment('');
      setMessages((prev) => [...prev, {
        role: 'system' as const,
        content: 'Task canceled.',
        ts: new Date().toISOString(),
      }]);
    } catch {
      setMessages((prev) => [...prev, {
        role: 'system' as const,
        content: 'Failed to cancel task.',
        ts: new Date().toISOString(),
      }]);
    }
  }, [taskId]);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>Tamir</h1>
        {taskId && (
          <button
            className={`btn btn-sm ${cancelPending ? 'btn-cancel' : ''}`}
            onClick={handleCancelClick}
            style={{
              fontSize: '11px',
              color: cancelPending ? 'var(--accent-red, #e94560)' : 'var(--text-dim)',
              borderColor: cancelPending ? 'var(--accent-red, #e94560)' : undefined,
            }}
          >
            {cancelPending ? 'Confirm Cancel' : 'Cancel Task'}
          </button>
        )}
      </div>
      {!showCanvas ? (
        /* Full-width chat (initial state per D-07) */
        <div style={{ height: 'calc(100vh - 48px)' }}>
          <ChatPanel
            messages={messages}
            routingButtons={routingButtons}
            onSend={handleSend}
            onRouteSelect={handleRouteSelect}
            isLoading={isLoading}
            placeholder="What would you like to get done?"
          />
        </div>
      ) : (
        /* Split pane: 40% chat / 60% canvas (D-07) */
        <div className="split-pane" style={{ height: 'calc(100vh - 48px)' }}>
          <div className="split-chat">
            <ChatPanel
              messages={messages}
              routingButtons={routingButtons}
              onSend={handleSend}
              onRouteSelect={handleRouteSelect}
              isLoading={isLoading}
              placeholder="Continue the conversation..."
            />
          </div>
          <div className="split-canvas">
            {planMarkdown && taskId && (
              <CanvasPanel
                planMarkdown={planMarkdown}
                taskId={taskId}
                department={department}
                isNewPlan={isNewPlan}
                onApprove={handleApprove}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
