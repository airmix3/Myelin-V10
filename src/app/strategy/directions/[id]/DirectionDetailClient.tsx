'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Edit3,
  Check,
  ChevronDown,
  ChevronUp,
  ExternalLink,
} from 'lucide-react';
import GoalSection from '@/components/strategy/GoalSection';
import type { SeedData } from '@/components/strategy/SeedCard';

/* ---------- Types ---------- */

interface DirectionData {
  id: string;
  title: string;
  rationale: string | null;
  status: string;
}

interface GoalData {
  id: string;
  title: string;
  definitionOfDone: string | null;
  status: string;
  seeds: SeedData[];
  assets: Array<{ id: string; title: string; category: string }>;
}

interface DecisionRecord {
  id: string;
  summary: string;
  createdAt: string;
  canvasChatId: string;
  conversationRef?: string | null;
  canvasSnapshotRef?: string | null;
  constraints?: string | null;
  alternatives?: string | null;
  challengeHighlights?: string | null;
}

interface LinkedTask {
  id: string;
  title: string;
  state: string;
  department: string;
  goalId: string;
}

interface DirectionDetailClientProps {
  direction: DirectionData;
  goals: GoalData[];
  allSeeds: Array<{ id: string; title: string; status: string }>;
  decisions: DecisionRecord[];
  linkedTasks: LinkedTask[];
}

/* ---------- Constants ---------- */

const STATUS_BADGES: Record<string, { bg: string; text: string }> = {
  active: { bg: 'rgba(59,130,246,0.20)', text: '#93c5fd' },
  paused: { bg: 'rgba(245,158,11,0.20)', text: '#fcd34d' },
  completed: { bg: 'rgba(34,197,94,0.20)', text: '#86efac' },
  abandoned: { bg: 'rgba(244,63,94,0.15)', text: '#fda4af' },
};

const TASK_STATE_COLORS: Record<string, { bg: string; text: string }> = {
  submitted: { bg: 'rgba(100,116,139,0.20)', text: '#94a3b8' },
  working: { bg: 'rgba(59,130,246,0.20)', text: '#93c5fd' },
  'input-required': { bg: 'rgba(245,158,11,0.20)', text: '#fcd34d' },
  completed: { bg: 'rgba(34,197,94,0.20)', text: '#86efac' },
  failed: { bg: 'rgba(244,63,94,0.15)', text: '#fda4af' },
  canceled: { bg: 'rgba(100,116,139,0.15)', text: '#64748b' },
};

const DEPT_COLORS: Record<string, { bg: string; text: string }> = {
  tech: { bg: 'rgba(59,130,246,0.15)', text: '#93c5fd' },
  marketing: { bg: 'rgba(236,72,153,0.15)', text: '#f9a8d4' },
  operations: { bg: 'rgba(34,197,94,0.15)', text: '#86efac' },
};

/* ---------- Helpers ---------- */

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function sortGoals(goals: GoalData[]): GoalData[] {
  const order: Record<string, number> = {
    active: 0,
    'at-risk': 1,
    planned: 2,
    completed: 3,
    abandoned: 4,
  };
  return [...goals].sort(
    (a, b) => (order[a.status] ?? 5) - (order[b.status] ?? 5),
  );
}

/* ---------- Component ---------- */

export default function DirectionDetailClient({
  direction,
  goals,
  allSeeds,
  decisions,
  linkedTasks,
}: DirectionDetailClientProps) {
  const router = useRouter();

  // Inline edit state
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(direction.title);
  const [editRationale, setEditRationale] = useState(direction.rationale || '');
  const [editStatus, setEditStatus] = useState(direction.status);

  // Collapsible sections
  const [showDecisions, setShowDecisions] = useState(false);
  const [showLinkedTasks, setShowLinkedTasks] = useState(false);
  const [expandedDecisions, setExpandedDecisions] = useState<Set<string>>(new Set());

  // Add Goal form
  const [showAddGoal, setShowAddGoal] = useState(false);
  const [goalTitle, setGoalTitle] = useState('');
  const [goalDod, setGoalDod] = useState('');
  const [addingGoal, setAddingGoal] = useState(false);

  // Hash-based scroll on mount (D-04)
  useEffect(() => {
    const hash = window.location.hash;
    if (hash) {
      const el = document.getElementById(hash.slice(1));
      if (el) {
        setTimeout(() => {
          el.scrollIntoView({ behavior: 'smooth' });
        }, 200);
      }
    }
  }, []);

  // Aggregate progress
  const totalSeeds = goals.reduce((sum, g) => sum + g.seeds.length, 0);
  const completedSeeds = goals.reduce(
    (sum, g) =>
      sum +
      g.seeds.filter(
        (s) => s.status === 'completed' || s.status === 'activated',
      ).length,
    0,
  );
  const progressingGoals = goals.filter(
    (g) => g.seeds.some((s) => s.status === 'activated' || s.status === 'completed'),
  ).length;
  const overallPercent =
    totalSeeds > 0 ? (completedSeeds / totalSeeds) * 100 : 0;

  const sortedGoals = sortGoals(goals);
  const statusBadge = STATUS_BADGES[direction.status] || STATUS_BADGES.active;

  /* ---- Handlers ---- */

  const handleSave = async () => {
    const body: Record<string, string> = {};
    if (editTitle !== direction.title) body.title = editTitle;
    if (editRationale !== (direction.rationale || ''))
      body.rationale = editRationale;
    if (editStatus !== direction.status) body.status = editStatus;

    if (Object.keys(body).length > 0) {
      await fetch(`/api/strategy/directions/${direction.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    }
    setEditing(false);
    router.refresh();
  };

  const handleSeedActivate = useCallback(
    async (seedId: string) => {
      // Find the seed's goal
      const seedGoal = goals.find((g) =>
        g.seeds.some((s) => s.id === seedId),
      );
      if (!seedGoal) return;

      try {
        const res = await fetch(
          `/api/strategy/directions/${direction.id}/goals/${seedGoal.id}/seeds/${seedId}/activate`,
          { method: 'POST' },
        );
        if (res.ok) {
          const data = await res.json();
          // Navigate to Tamir chat with the new task (D-08)
          router.push(`/tamir?taskId=${data.taskId}&autoStart=true`);
        }
      } catch {
        // User can retry
      }
    },
    [direction.id, goals, router],
  );

  const handleSeedDiscard = useCallback(
    async (seedId: string) => {
      const seedGoal = goals.find((g) =>
        g.seeds.some((s) => s.id === seedId),
      );
      if (!seedGoal) return;

      await fetch(
        `/api/strategy/directions/${direction.id}/goals/${seedGoal.id}/seeds/${seedId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'discarded' }),
        },
      );
      router.refresh();
    },
    [direction.id, goals, router],
  );

  const handleAddGoal = async () => {
    if (!goalTitle.trim()) return;
    setAddingGoal(true);
    try {
      await fetch(`/api/strategy/directions/${direction.id}/goals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: goalTitle.trim(),
          definitionOfDone: goalDod.trim() || undefined,
        }),
      });
      setGoalTitle('');
      setGoalDod('');
      setShowAddGoal(false);
      router.refresh();
    } catch {
      // Error acceptable, user can retry
    } finally {
      setAddingGoal(false);
    }
  };

  const toggleDecision = (id: string) => {
    setExpandedDecisions((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  /* ---- Render ---- */

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      {/* Back link */}
      <Link
        href="/strategy"
        className="flex items-center gap-1.5 text-xs font-medium mb-6 transition-colors"
        style={{ color: 'rgba(255,255,255,0.45)' }}
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Back to Strategy
      </Link>

      {/* 1. Header Section */}
      <div className="mb-8">
        {editing ? (
          <div className="space-y-3">
            <input
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              className="w-full bg-transparent text-2xl font-semibold text-white px-2 py-1 rounded border outline-none"
              style={{ borderColor: 'rgba(255,255,255,0.15)' }}
            />
            <textarea
              value={editRationale}
              onChange={(e) => setEditRationale(e.target.value)}
              rows={3}
              placeholder="Rationale..."
              className="w-full bg-transparent text-sm px-2 py-1.5 rounded border outline-none resize-none italic"
              style={{
                borderColor: 'rgba(255,255,255,0.10)',
                color: 'rgba(255,255,255,0.55)',
              }}
            />
            <div className="flex items-center gap-2">
              <select
                value={editStatus}
                onChange={(e) => setEditStatus(e.target.value)}
                className="bg-transparent text-xs px-2 py-1 rounded border outline-none cursor-pointer"
                style={{
                  borderColor: 'rgba(255,255,255,0.10)',
                  color: 'rgba(255,255,255,0.70)',
                }}
              >
                <option value="active">Active</option>
                <option value="paused">Paused</option>
                <option value="completed">Completed</option>
                <option value="abandoned">Abandoned</option>
              </select>
              <button
                onClick={handleSave}
                className="glass-pill flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg font-medium cursor-pointer"
                style={{ color: '#86efac' }}
              >
                <Check className="w-3 h-3" />
                Save
              </button>
              <button
                onClick={() => {
                  setEditing(false);
                  setEditTitle(direction.title);
                  setEditRationale(direction.rationale || '');
                  setEditStatus(direction.status);
                }}
                className="text-xs px-3 py-1.5 cursor-pointer"
                style={{ color: 'rgba(255,255,255,0.40)' }}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1
                className="text-2xl font-semibold"
                style={{ color: 'rgba(255,255,255,0.95)' }}
              >
                {direction.title}
              </h1>
              <span
                className="text-[11px] px-2.5 py-0.5 rounded-full font-semibold capitalize"
                style={{
                  background: statusBadge.bg,
                  color: statusBadge.text,
                }}
              >
                {direction.status}
              </span>
              <button
                onClick={() => setEditing(true)}
                className="p-1 rounded transition-colors cursor-pointer"
                style={{ color: 'rgba(255,255,255,0.35)' }}
                title="Edit direction"
              >
                <Edit3 className="w-4 h-4" />
              </button>
            </div>
            {direction.rationale && (
              <p
                className="text-sm italic leading-relaxed"
                style={{ color: 'rgba(255,255,255,0.50)' }}
              >
                {direction.rationale}
              </p>
            )}
          </div>
        )}
      </div>

      {/* 2. Progress Overview */}
      <div className="glass-card rounded-xl p-4 mb-8">
        <div className="flex items-center justify-between mb-3">
          <span
            className="text-xs font-semibold uppercase tracking-wider"
            style={{ color: 'rgba(255,255,255,0.40)' }}
          >
            Overall Progress
          </span>
          <span
            className="text-xs tabular-nums"
            style={{ color: 'rgba(255,255,255,0.50)' }}
          >
            {progressingGoals} of {goals.length} goals progressing,{' '}
            {completedSeeds} seeds completed
          </span>
        </div>
        <div
          className="glass-deep rounded-full overflow-hidden"
          style={{ height: 8 }}
        >
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{
              width: `${overallPercent}%`,
              background:
                'linear-gradient(90deg, rgba(59,130,246,0.7), rgba(34,197,94,0.9))',
              boxShadow:
                overallPercent > 0
                  ? '0 0 12px rgba(34,197,94,0.3)'
                  : 'none',
            }}
          />
        </div>
      </div>

      {/* 3. Goals Section */}
      <div className="mb-8">
        <h2
          className="text-sm font-semibold uppercase tracking-wider mb-4"
          style={{ color: 'rgba(255,255,255,0.40)' }}
        >
          Goals ({goals.length})
        </h2>

        {sortedGoals.length === 0 ? (
          <p className="text-sm" style={{ color: 'rgba(255,255,255,0.30)' }}>
            No goals yet. Add the first goal to start decomposing this direction.
          </p>
        ) : (
          sortedGoals.map((goal) => (
            <GoalSection
              key={goal.id}
              goal={goal}
              allSeeds={allSeeds}
              directionId={direction.id}
              onSeedActivate={handleSeedActivate}
              onSeedDiscard={handleSeedDiscard}
              onAddSeed={() => {
                // Scroll to goal and open its add seed form
                const el = document.getElementById(`goal-${goal.id}`);
                el?.scrollIntoView({ behavior: 'smooth' });
              }}
            />
          ))
        )}

        {/* Add Goal */}
        <div className="mt-4">
          <button
            onClick={() => setShowAddGoal(!showAddGoal)}
            className="glass-pill flex items-center gap-1.5 text-xs px-4 py-2 rounded-lg font-medium cursor-pointer"
            style={{ color: 'rgba(255,255,255,0.55)' }}
          >
            {showAddGoal ? (
              <ChevronUp className="w-3 h-3" />
            ) : (
              <span>+ Add Goal</span>
            )}
            {showAddGoal && 'Close'}
          </button>

          {showAddGoal && (
            <div
              className="glass-card rounded-lg p-4 mt-2 space-y-2"
              style={{ border: '1px solid rgba(255,255,255,0.10)' }}
            >
              <input
                type="text"
                placeholder="Goal title (required)"
                value={goalTitle}
                onChange={(e) => setGoalTitle(e.target.value)}
                className="w-full bg-transparent text-sm px-2 py-1.5 rounded border outline-none"
                style={{
                  borderColor: 'rgba(255,255,255,0.10)',
                  color: 'rgba(255,255,255,0.85)',
                }}
              />
              <textarea
                placeholder="Definition of done (optional)"
                value={goalDod}
                onChange={(e) => setGoalDod(e.target.value)}
                rows={2}
                className="w-full bg-transparent text-xs px-2 py-1.5 rounded border outline-none resize-none"
                style={{
                  borderColor: 'rgba(255,255,255,0.10)',
                  color: 'rgba(255,255,255,0.70)',
                }}
              />
              <button
                onClick={handleAddGoal}
                disabled={addingGoal || !goalTitle.trim()}
                className="glass-pill text-xs px-4 py-1.5 rounded-lg font-medium cursor-pointer disabled:opacity-40"
                style={{ color: '#86efac' }}
              >
                {addingGoal ? 'Creating...' : 'Create Goal'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 5. Decision History Section (collapsible) */}
      <div
        className="mb-8"
        style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 24 }}
      >
        <button
          onClick={() => setShowDecisions(!showDecisions)}
          className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider mb-3 cursor-pointer w-full text-left"
          style={{ color: 'rgba(255,255,255,0.40)' }}
        >
          Decision History ({decisions.length})
          {showDecisions ? (
            <ChevronUp className="w-3.5 h-3.5" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5" />
          )}
        </button>

        {showDecisions && (
          <div className="space-y-2">
            {decisions.length === 0 ? (
              <p className="text-xs" style={{ color: 'rgba(255,255,255,0.30)' }}>
                No decisions linked to this direction yet.
              </p>
            ) : (
              decisions.map((dec) => {
                const isExpanded = expandedDecisions.has(dec.id);
                return (
                  <div key={dec.id} className="glass-card rounded-lg overflow-hidden">
                    <button
                      onClick={() => toggleDecision(dec.id)}
                      className="w-full flex items-center gap-2 p-3 text-left cursor-pointer"
                    >
                      <span
                        className="text-xs flex-1"
                        style={{ color: 'rgba(255,255,255,0.70)' }}
                      >
                        {dec.summary}
                      </span>
                      <span
                        className="text-[10px] shrink-0 tabular-nums"
                        style={{ color: 'rgba(255,255,255,0.30)' }}
                      >
                        {formatDate(dec.createdAt)}
                      </span>
                      {isExpanded ? (
                        <ChevronUp
                          className="w-3 h-3 shrink-0"
                          style={{ color: 'rgba(255,255,255,0.30)' }}
                        />
                      ) : (
                        <ChevronDown
                          className="w-3 h-3 shrink-0"
                          style={{ color: 'rgba(255,255,255,0.30)' }}
                        />
                      )}
                    </button>
                    {isExpanded && (
                      <div
                        className="px-3 pb-3 space-y-2"
                        style={{
                          borderTop: '1px solid rgba(255,255,255,0.06)',
                        }}
                      >
                        {dec.conversationRef && (
                          <div className="pt-2">
                            <span
                              className="text-[10px] font-semibold block mb-0.5"
                              style={{ color: 'rgba(255,255,255,0.35)' }}
                            >
                              Conversation
                            </span>
                            <p
                              className="text-[11px]"
                              style={{ color: 'rgba(255,255,255,0.55)' }}
                            >
                              {dec.conversationRef}
                            </p>
                          </div>
                        )}
                        {dec.canvasSnapshotRef && (
                          <div>
                            <span
                              className="text-[11px] underline cursor-pointer"
                              style={{ color: '#93c5fd' }}
                            >
                              View canvas snapshot
                            </span>
                          </div>
                        )}
                        {dec.constraints && (
                          <div>
                            <span
                              className="text-[10px] font-semibold block mb-0.5"
                              style={{ color: 'rgba(255,255,255,0.35)' }}
                            >
                              Constraints
                            </span>
                            <p
                              className="text-[11px]"
                              style={{ color: 'rgba(255,255,255,0.55)' }}
                            >
                              {dec.constraints}
                            </p>
                          </div>
                        )}
                        {dec.alternatives && (
                          <div>
                            <span
                              className="text-[10px] font-semibold block mb-0.5"
                              style={{ color: 'rgba(255,255,255,0.35)' }}
                            >
                              Alternatives
                            </span>
                            <p
                              className="text-[11px]"
                              style={{ color: 'rgba(255,255,255,0.55)' }}
                            >
                              {dec.alternatives}
                            </p>
                          </div>
                        )}
                        {dec.challengeHighlights && (
                          <div>
                            <span
                              className="text-[10px] font-semibold block mb-0.5"
                              style={{ color: 'rgba(255,255,255,0.35)' }}
                            >
                              Challenge Highlights
                            </span>
                            <p
                              className="text-[11px]"
                              style={{ color: 'rgba(255,255,255,0.55)' }}
                            >
                              {dec.challengeHighlights}
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* 6. Linked Tasks Section (collapsible) */}
      <div
        className="mb-8"
        style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 24 }}
      >
        <button
          onClick={() => setShowLinkedTasks(!showLinkedTasks)}
          className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider mb-3 cursor-pointer w-full text-left"
          style={{ color: 'rgba(255,255,255,0.40)' }}
        >
          Linked Tasks ({linkedTasks.length})
          {showLinkedTasks ? (
            <ChevronUp className="w-3.5 h-3.5" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5" />
          )}
        </button>

        {showLinkedTasks && (
          <div className="space-y-2">
            {linkedTasks.length === 0 ? (
              <p className="text-xs" style={{ color: 'rgba(255,255,255,0.30)' }}>
                No tasks linked to this direction yet. Activate seeds to create tasks.
              </p>
            ) : (
              linkedTasks.map((task) => {
                const stateStyle =
                  TASK_STATE_COLORS[task.state] || TASK_STATE_COLORS.submitted;
                const deptStyle =
                  DEPT_COLORS[task.department] || DEPT_COLORS.tech;
                return (
                  <Link
                    key={task.id}
                    href={`/tamir?taskId=${task.id}`}
                    className="glass-card rounded-lg p-3 flex items-center gap-3 transition-colors hover:brightness-110 block"
                  >
                    <div className="flex-1 min-w-0">
                      <span
                        className="text-sm font-medium truncate block"
                        style={{ color: 'rgba(255,255,255,0.80)' }}
                      >
                        {task.title}
                      </span>
                    </div>
                    <span
                      className="text-[10px] px-2 py-0.5 rounded-full font-semibold capitalize shrink-0"
                      style={{ background: deptStyle.bg, color: deptStyle.text }}
                    >
                      {task.department}
                    </span>
                    <span
                      className="text-[10px] px-2 py-0.5 rounded-full font-semibold shrink-0"
                      style={{
                        background: stateStyle.bg,
                        color: stateStyle.text,
                      }}
                    >
                      {task.state}
                    </span>
                    <ExternalLink
                      className="w-3.5 h-3.5 shrink-0"
                      style={{ color: 'rgba(255,255,255,0.30)' }}
                    />
                  </Link>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
}
