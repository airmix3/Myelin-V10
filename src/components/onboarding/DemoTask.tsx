'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'motion/react';
import StepIndicator from './StepIndicator';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DemoTaskProps {
  cosName: string;
  completedPhases: number[];
  onTaskSelected: (taskDescription: string) => void;
  onSkip: () => void;
  onComplete: () => void;
}

interface TaskOption {
  title: string;
  description: string;
  department?: string;
}

type Mode = 'loading' | 'suggestions' | 'cortex';

// ---------------------------------------------------------------------------
// DemoTask Component
// ---------------------------------------------------------------------------

export default function DemoTask({
  cosName,
  completedPhases,
  onSkip,
  onComplete,
}: DemoTaskProps) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('loading');
  const [options, setOptions] = useState<TaskOption[]>([]);
  const [customRequest, setCustomRequest] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch task suggestions from CoS
  const fetchSuggestions = useCallback(async (message?: string) => {
    setMode('loading');
    setError(null);
    try {
      const res = await fetch('/onboarding/api/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: message || 'Suggest demo tasks for Phase 8',
          phaseNumber: 8,
        }),
      });

      if (!res.ok) throw new Error('Failed to get task suggestions');

      const data = await res.json();

      // Parse response for task options
      // The structured output may have ui_action.type === 'show_demo_task_options'
      if (data.ui_action?.type === 'show_demo_task_options' && data.ui_action.data?.options) {
        // Normalize: older responses may return { label, department } instead of { title, description }
        const raw = data.ui_action.data.options as Array<Record<string, string>>;
        setOptions(raw.map((o) => ({
          title: o.title || o.label || 'Task',
          description: o.description || '',
          department: o.department,
        })));
      } else if (data.response) {
        // Fallback: try to extract options from the response text
        // Generate some default options based on the CoS response
        setOptions([
          {
            title: 'Research Task',
            description: 'Ask a department head to research a topic relevant to your business.',
          },
          {
            title: 'Content Creation',
            description: 'Have the marketing team draft a piece of content for your company.',
          },
          {
            title: 'Technical Analysis',
            description: 'Get the tech team to analyze a technical challenge for your product.',
          },
        ]);
      }

      setMode('suggestions');
    } catch {
      setError('Could not load task suggestions. You can skip this step or try again.');
      setMode('suggestions');
    }
  }, []);

  // Fetch suggestions on mount
  useEffect(() => {
    fetchSuggestions();
  }, [fetchSuggestions]);

  // Handle selecting a task -- route through real Cortex pipeline
  async function handleSelectTask(option: TaskOption) {
    setIsSubmitting(true);
    setError(null);

    try {
      const taskDescription = `${option.title}: ${option.description}`;
      const res = await fetch('/api/tamir/route', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: taskDescription }),
      });

      if (!res.ok) throw new Error('Failed to create task');

      const data = await res.json();
      if (!data.taskId) throw new Error('No taskId returned');

      // Transition to Cortex mode -- redirect to Tamir chat with onboarding param
      setMode('cortex');
      router.push(`/tamir?taskId=${data.taskId}&autoStart=true&onboarding=true`);
    } catch {
      setError('Could not create the task. Try again or skip this step.');
      setIsSubmitting(false);
    }
  }

  // Handle custom task request
  async function handleCustomRequest() {
    if (!customRequest.trim()) return;
    await fetchSuggestions(customRequest.trim());
    setCustomRequest('');
  }

  // ---------------------------------------------------------------------------
  // Render: Loading
  // ---------------------------------------------------------------------------
  if (mode === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="glass-card rounded-xl p-8 text-center max-w-[520px] w-full">
          <div
            className="text-slate-400"
            style={{ fontSize: 14, fontWeight: 400, lineHeight: 1.5 }}
          >
            {cosName} is preparing task suggestions...
          </div>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Render: Cortex mode (transitioning)
  // ---------------------------------------------------------------------------
  if (mode === 'cortex') {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="glass-card rounded-xl p-8 text-center max-w-[520px] w-full">
          <div
            className="text-slate-400"
            style={{ fontSize: 14, fontWeight: 400, lineHeight: 1.5 }}
          >
            Launching your task in the Cortex...
          </div>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Render: Suggestions mode
  // ---------------------------------------------------------------------------
  return (
    <div className="flex flex-col items-center gap-8 max-w-[520px] mx-auto w-full">
      {/* Phase heading */}
      <h2
        className="text-white text-center"
        style={{ fontSize: 20, fontWeight: 600, lineHeight: 1.2 }}
      >
        Your First Task
      </h2>

      <p
        className="text-slate-400 text-center"
        style={{ fontSize: 14, fontWeight: 400, lineHeight: 1.5 }}
      >
        {cosName} has suggested a few tasks to try. Pick one to see how the
        system works end-to-end, or skip to continue.
      </p>

      {/* Error message */}
      {error && (
        <div
          className="text-center w-full"
          style={{ fontSize: 11, fontWeight: 400, color: '#f43f5e' }}
        >
          {error}
        </div>
      )}

      {/* Task option cards */}
      <AnimatePresence mode="wait">
        <motion.div
          key={options.map((o) => o.title).join(',')}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="flex flex-col gap-4 w-full"
        >
          {options.map((option, index) => (
            <div
              key={index}
              className="glass-card rounded-xl p-4 flex flex-col gap-3"
            >
              {option.department && (
                <div
                  className="text-slate-500"
                  style={{ fontSize: 10, fontWeight: 500, lineHeight: 1, textTransform: 'uppercase', letterSpacing: '0.05em' }}
                >
                  {option.department}
                </div>
              )}
              <div
                className="text-white"
                style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.3 }}
              >
                {option.title}
              </div>
              <div
                className="text-slate-400"
                style={{ fontSize: 11, fontWeight: 400, lineHeight: 1.5 }}
              >
                {option.description}
              </div>
              <button
                onClick={() => handleSelectTask(option)}
                disabled={isSubmitting}
                className="self-start rounded-lg text-white cursor-pointer transition-colors hover:bg-sky-500 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  backgroundColor: '#38bdf8',
                  paddingLeft: 16,
                  paddingRight: 16,
                  paddingTop: 8,
                  paddingBottom: 8,
                  fontSize: 11,
                  fontWeight: 600,
                }}
              >
                Start This Task
              </button>
            </div>
          ))}
        </motion.div>
      </AnimatePresence>

      {/* Custom request input */}
      <div className="w-full flex flex-col gap-2">
        <div
          className="text-slate-400"
          style={{ fontSize: 11, fontWeight: 400, lineHeight: 1.3 }}
        >
          Don&apos;t see what you want? Describe a task:
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={customRequest}
            onChange={(e) => setCustomRequest(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCustomRequest();
            }}
            placeholder="Describe what you'd like..."
            className="flex-1 glass-deep rounded-lg text-white placeholder-slate-500 outline-none"
            style={{
              fontSize: 14,
              fontWeight: 400,
              paddingLeft: 12,
              paddingRight: 12,
              paddingTop: 8,
              paddingBottom: 8,
            }}
          />
          <button
            onClick={handleCustomRequest}
            disabled={!customRequest.trim()}
            className="rounded-lg text-white cursor-pointer transition-colors hover:bg-sky-500 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              backgroundColor: '#38bdf8',
              paddingLeft: 12,
              paddingRight: 12,
              paddingTop: 8,
              paddingBottom: 8,
              fontSize: 11,
              fontWeight: 600,
            }}
          >
            Suggest
          </button>
        </div>
      </div>

      {/* Skip link */}
      <button
        onClick={onSkip}
        className="cursor-pointer bg-transparent border-none"
        style={{
          color: '#94a3b8',
          fontSize: 14,
          fontWeight: 400,
          textDecoration: 'underline',
        }}
      >
        Skip Demo Task
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// OnboardingBanner -- thin overlay bar for Phase 8 Cortex experience
// ---------------------------------------------------------------------------

export function OnboardingBanner({
  completedPhases,
  onReturn,
}: {
  completedPhases: number[];
  onReturn: () => void;
}) {
  return (
    <div
      className="glass-pill flex items-center justify-between px-4 w-full"
      style={{ height: 36, zIndex: 50 }}
    >
      <div className="flex items-center gap-3">
        <span
          className="text-slate-300"
          style={{ fontSize: 11, fontWeight: 600, lineHeight: 1.3 }}
        >
          Onboarding -- Step 8 of 9: Your First Task
        </span>
        {/* Inline small step dots */}
        <div className="flex items-center gap-1">
          {Array.from({ length: 9 }, (_, i) => {
            const phase = i + 1;
            const isCompleted = completedPhases.includes(phase);
            const isActive = phase === 8;
            return (
              <div
                key={phase}
                className="rounded-full"
                style={{
                  width: 6,
                  height: 6,
                  backgroundColor: isCompleted
                    ? '#10b981'
                    : isActive
                      ? '#38bdf8'
                      : 'rgba(255,255,255,0.15)',
                }}
              />
            );
          })}
        </div>
      </div>
      <button
        onClick={onReturn}
        className="cursor-pointer bg-transparent border-none"
        style={{
          color: '#38bdf8',
          fontSize: 11,
          fontWeight: 600,
          textDecoration: 'none',
        }}
      >
        Return to Onboarding
      </button>
    </div>
  );
}
