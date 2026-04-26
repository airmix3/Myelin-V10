'use client';

/**
 * CommitDirectionModal -- AI-powered direction commit modal.
 *
 * When opened, invokes Tamir to analyze the canvas conversation and pre-fill
 * a direction draft with title, rationale, context summary, and 2-4 candidate goals.
 * Each goal is an expandable card that triggers a second invocation to generate
 * task seeds. User can approve/remove items before committing.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { GitCommit, X, Sparkles, ChevronDown, ChevronUp, Check } from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Seed {
  title: string;
  description: string;
  suggestedDepartment: string;
  roughScope: string;
}

interface SeedState extends Seed {
  selected: boolean;
}

interface GoalState {
  title: string;
  definitionOfDone: string;
  expanded: boolean;
  seeds: SeedState[] | null;
  seedsLoading: boolean;
}

interface AnalysisResult {
  title: string;
  rationale: string;
  contextSummary: string;
  goals: Array<{ title: string; definitionOfDone: string }>;
}

interface CommitDirectionModalProps {
  chatId: string;
  isOpen: boolean;
  onClose: () => void;
  onCommitted: (directionTitle: string) => void;
}

// ---------------------------------------------------------------------------
// Department color mapping
// ---------------------------------------------------------------------------

const DEPT_COLORS: Record<string, string> = {
  tech: 'rgba(34,211,238,0.70)',
  marketing: 'rgba(251,191,36,0.70)',
  operations: 'rgba(74,222,128,0.70)',
};

const DEPT_BG: Record<string, string> = {
  tech: 'rgba(34,211,238,0.10)',
  marketing: 'rgba(251,191,36,0.10)',
  operations: 'rgba(74,222,128,0.10)',
};

const DEPT_BORDER: Record<string, string> = {
  tech: 'rgba(34,211,238,0.25)',
  marketing: 'rgba(251,191,36,0.25)',
  operations: 'rgba(74,222,128,0.25)',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function CommitDirectionModal({
  chatId,
  isOpen,
  onClose,
  onCommitted,
}: CommitDirectionModalProps) {
  const [phase, setPhase] = useState<'loading' | 'draft' | 'committing' | 'error'>('loading');
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [editedTitle, setEditedTitle] = useState('');
  const [editedRationale, setEditedRationale] = useState('');
  const [goals, setGoals] = useState<GoalState[]>([]);
  const [error, setError] = useState<string | null>(null);
  const prevIsOpen = useRef(false);

  // Trigger analysis when modal opens
  useEffect(() => {
    if (isOpen && !prevIsOpen.current) {
      setPhase('loading');
      setAnalysis(null);
      setError(null);
      setGoals([]);

      (async () => {
        try {
          const res = await fetch(`/api/strategy/canvas-chats/${chatId}/analyze`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
          });
          if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            throw new Error(data.error || `Analysis failed (${res.status})`);
          }
          const data: AnalysisResult = await res.json();
          setAnalysis(data);
          setEditedTitle(data.title);
          setEditedRationale(data.rationale);
          setGoals(
            data.goals.map((g) => ({
              title: g.title,
              definitionOfDone: g.definitionOfDone,
              expanded: false,
              seeds: null,
              seedsLoading: false,
            })),
          );
          setPhase('draft');
        } catch (err) {
          setError(err instanceof Error ? err.message : String(err));
          setPhase('error');
        }
      })();
    }
    prevIsOpen.current = isOpen;
  }, [isOpen, chatId]);

  // Escape key to close
  useEffect(() => {
    if (!isOpen) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  // Toggle seed selected state
  const toggleSeedSelected = useCallback((goalIndex: number, seedIndex: number) => {
    setGoals((prev) =>
      prev.map((g, i) => {
        if (i !== goalIndex || !g.seeds) return g;
        return {
          ...g,
          seeds: g.seeds.map((s, si) => (si === seedIndex ? { ...s, selected: !s.selected } : s)),
        };
      }),
    );
  }, []);

  // Toggle goal expanded + trigger seed generation on first expand
  const toggleGoalExpanded = useCallback(
    (index: number) => {
      setGoals((prev) =>
        prev.map((g, i) => {
          if (i !== index) return g;
          const nowExpanded = !g.expanded;
          // Trigger seed generation on first expand
          if (nowExpanded && g.seeds === null && !g.seedsLoading) {
            // Start loading seeds asynchronously
            (async () => {
              setGoals((curr) =>
                curr.map((gg, ii) => (ii === index ? { ...gg, expanded: true, seedsLoading: true } : gg)),
              );
              try {
                const res = await fetch(`/api/strategy/canvas-chats/${chatId}/generate-seeds`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    goalTitle: g.title,
                    goalDefinitionOfDone: g.definitionOfDone,
                    directionTitle: editedTitle,
                    directionRationale: editedRationale,
                  }),
                });
                const data = await res.json();
                const seedsWithState = (data.seeds || []).map((s: Seed) => ({ ...s, selected: false }));
                setGoals((curr) =>
                  curr.map((gg, ii) =>
                    ii === index ? { ...gg, seeds: seedsWithState, seedsLoading: false } : gg,
                  ),
                );
              } catch {
                setGoals((curr) =>
                  curr.map((gg, ii) =>
                    ii === index ? { ...gg, seeds: [], seedsLoading: false } : gg,
                  ),
                );
              }
            })();
            return { ...g, expanded: true, seedsLoading: true };
          }
          return { ...g, expanded: nowExpanded };
        }),
      );
    },
    [chatId, editedTitle, editedRationale],
  );

  // Update goal title
  const updateGoalTitle = useCallback((index: number, title: string) => {
    setGoals((prev) =>
      prev.map((g, i) => (i === index ? { ...g, title } : g)),
    );
  }, []);

  // Update goal definition of done
  const updateGoalDod = useCallback((index: number, definitionOfDone: string) => {
    setGoals((prev) =>
      prev.map((g, i) => (i === index ? { ...g, definitionOfDone } : g)),
    );
  }, []);


  // Commit direction + goals + seeds
  const handleCommit = useCallback(async () => {
    if (!editedTitle.trim() || phase === 'committing') return;
    setPhase('committing');

    try {
      // 1. Create direction
      const dirRes = await fetch('/api/strategy/directions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: editedTitle.trim(), rationale: editedRationale }),
      });
      if (!dirRes.ok) throw new Error('Failed to create direction');
      const dirData = await dirRes.json();
      const directionId = dirData.id;

      // 2. Create goals that have selected seeds (or are expanded = user reviewed them)
      const activeGoals = goals.filter((g) => g.expanded && g.seeds?.some((s) => s.selected));
      for (const goal of activeGoals) {
        const goalRes = await fetch(`/api/strategy/directions/${directionId}/goals`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: goal.title,
            definitionOfDone: goal.definitionOfDone,
          }),
        });
        if (!goalRes.ok) continue;
        const goalData = await goalRes.json();
        const goalId = goalData.id;

        // Create selected seeds for this goal
        const selectedSeeds = (goal.seeds || []).filter((s) => s.selected);
        if (selectedSeeds.length > 0) {
          for (const seed of selectedSeeds) {
            await fetch(`/api/strategy/directions/${directionId}/goals/${goalId}/seeds`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                title: seed.title,
                description: seed.description,
                suggestedDepartment: seed.suggestedDepartment,
                roughScope: seed.roughScope,
              }),
            });
          }
        }
      }

      // 3. Create decision record
      await fetch('/api/strategy/decisions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          canvasChatId: chatId,
          summary: editedTitle.trim(),
          conversationRef: 'Committed from canvas with AI analysis',
          canvasSnapshotRef: `/api/strategy/canvas-chats/${chatId}/snapshot`,
          directionIds: [directionId],
        }),
      });

      onCommitted(editedTitle.trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Commit failed');
      setPhase('error');
    }
  }, [editedTitle, editedRationale, goals, chatId, phase, onCommitted]);

  // Retry analysis after error
  const handleRetry = useCallback(() => {
    prevIsOpen.current = false; // Reset so useEffect re-triggers
    setPhase('loading');
    setError(null);
    // Force re-trigger by toggling prevIsOpen
    setTimeout(() => {
      prevIsOpen.current = false;
      setPhase('loading');
      // Re-run analysis
      (async () => {
        try {
          const res = await fetch(`/api/strategy/canvas-chats/${chatId}/analyze`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
          });
          if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            throw new Error(data.error || `Analysis failed (${res.status})`);
          }
          const data: AnalysisResult = await res.json();
          setAnalysis(data);
          setEditedTitle(data.title);
          setEditedRationale(data.rationale);
          setGoals(
            data.goals.map((g) => ({
              title: g.title,
              definitionOfDone: g.definitionOfDone,
              expanded: false,
              seeds: null,
              seedsLoading: false,
            })),
          );
          setPhase('draft');
        } catch (err) {
          setError(err instanceof Error ? err.message : String(err));
          setPhase('error');
        }
      })();
    }, 0);
  }, [chatId]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.50)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="w-[600px] max-h-[80vh] overflow-y-auto rounded-2xl p-6"
        style={{
          background: 'rgba(15,20,35,0.95)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(139,92,246,0.25)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
          scrollbarWidth: 'thin',
          scrollbarColor: 'rgba(255,255,255,0.08) transparent',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <GitCommit className="w-5 h-5" style={{ color: '#a78bfa' }} />
            <span className="text-[14px] font-semibold" style={{ color: '#c4b5fd' }}>
              Commit Direction
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded cursor-pointer transition-opacity hover:opacity-80"
            style={{ color: 'rgba(255,255,255,0.30)' }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Loading state */}
        {phase === 'loading' && (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <div className="relative">
              <Sparkles
                className="w-8 h-8"
                style={{
                  color: '#a78bfa',
                  animation: 'commitModalSpin 2s linear infinite',
                }}
              />
            </div>
            <span className="text-[13px]" style={{ color: 'rgba(255,255,255,0.50)' }}>
              Tamir is analyzing the canvas...
            </span>
          </div>
        )}

        {/* Error state */}
        {phase === 'error' && (
          <div className="flex flex-col items-center justify-center py-12 gap-4">
            <span className="text-[13px]" style={{ color: 'rgba(239,68,68,0.80)' }}>
              {error || 'Analysis failed'}
            </span>
            <button
              onClick={handleRetry}
              className="text-[12px] font-medium px-4 py-2 rounded-lg cursor-pointer transition-all"
              style={{
                background: 'rgba(139,92,246,0.15)',
                border: '1px solid rgba(139,92,246,0.30)',
                color: '#c4b5fd',
              }}
            >
              Retry Analysis
            </button>
          </div>
        )}

        {/* Draft state */}
        {(phase === 'draft' || phase === 'committing') && analysis && (
          <div className="space-y-4">
            {/* Title */}
            <div>
              <label
                className="text-[10px] font-semibold uppercase tracking-wider block mb-1"
                style={{ color: 'rgba(255,255,255,0.35)' }}
              >
                Title
              </label>
              <input
                type="text"
                value={editedTitle}
                onChange={(e) => setEditedTitle(e.target.value)}
                className="w-full text-[13px] px-3 py-2 rounded-lg bg-transparent outline-none"
                style={{
                  color: 'rgba(255,255,255,0.85)',
                  border: '1px solid rgba(255,255,255,0.10)',
                  background: 'rgba(255,255,255,0.03)',
                }}
                placeholder="Direction title..."
                autoFocus
              />
            </div>

            {/* Rationale */}
            <div>
              <label
                className="text-[10px] font-semibold uppercase tracking-wider block mb-1"
                style={{ color: 'rgba(255,255,255,0.35)' }}
              >
                Rationale
              </label>
              <textarea
                value={editedRationale}
                onChange={(e) => setEditedRationale(e.target.value)}
                rows={3}
                className="w-full text-[12px] px-3 py-2 rounded-lg bg-transparent outline-none resize-none"
                style={{
                  color: 'rgba(255,255,255,0.65)',
                  border: '1px solid rgba(255,255,255,0.10)',
                  background: 'rgba(255,255,255,0.03)',
                }}
                placeholder="Why this direction matters..."
              />
            </div>

            {/* Context Summary */}
            {analysis.contextSummary && (
              <div>
                <label
                  className="text-[10px] font-semibold uppercase tracking-wider block mb-1"
                  style={{ color: 'rgba(255,255,255,0.35)' }}
                >
                  Canvas Context
                </label>
                <div
                  className="px-3 py-2 rounded-lg text-[12px] leading-relaxed"
                  style={{
                    color: 'rgba(255,255,255,0.50)',
                    background: 'rgba(255,255,255,0.02)',
                    border: '1px solid rgba(255,255,255,0.06)',
                  }}
                >
                  {analysis.contextSummary}
                </div>
              </div>
            )}

            {/* Goals */}
            <div>
              <label
                className="text-[10px] font-semibold uppercase tracking-wider block mb-2"
                style={{ color: 'rgba(255,255,255,0.35)' }}
              >
                Suggested Goals
              </label>
              <div className="space-y-2">
                {goals.map((goal, gi) => {
                  const hasSelectedSeeds = goal.seeds?.some((s) => s.selected) ?? false;
                  return (
                    <div key={gi}>
                      {/* Goal card — click to expand and generate seeds */}
                      <div
                        className="rounded-lg cursor-pointer transition-all"
                        style={{
                          background: goal.expanded
                            ? 'rgba(139,92,246,0.06)'
                            : 'rgba(255,255,255,0.03)',
                          border: `1px solid ${hasSelectedSeeds ? 'rgba(139,92,246,0.35)' : goal.expanded ? 'rgba(139,92,246,0.15)' : 'rgba(255,255,255,0.08)'}`,
                        }}
                        onClick={() => toggleGoalExpanded(gi)}
                      >
                        <div className="p-3 flex items-start gap-3">
                          {/* Goal indicator */}
                          <div
                            className="mt-1 w-2 h-2 rounded-full shrink-0"
                            style={{
                              background: hasSelectedSeeds
                                ? '#a78bfa'
                                : goal.expanded
                                  ? 'rgba(139,92,246,0.40)'
                                  : 'rgba(255,255,255,0.15)',
                            }}
                          />

                          {/* Goal content */}
                          <div className="flex-1 min-w-0">
                            <div className="text-[13px] font-medium" style={{ color: 'rgba(255,255,255,0.85)' }}>
                              {goal.title}
                            </div>
                            <div className="text-[11px] mt-0.5" style={{ color: 'rgba(255,255,255,0.45)' }}>
                              {goal.definitionOfDone}
                            </div>
                            {hasSelectedSeeds && (
                              <div className="text-[10px] mt-1" style={{ color: '#a78bfa' }}>
                                {goal.seeds!.filter((s) => s.selected).length} seed{goal.seeds!.filter((s) => s.selected).length !== 1 ? 's' : ''} selected
                              </div>
                            )}
                          </div>

                          {/* Expand chevron */}
                          <div className="mt-0.5 shrink-0 p-0.5" style={{ color: 'rgba(255,255,255,0.30)' }}>
                            {goal.expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </div>
                        </div>

                        {/* Expanded: seeds loading area + seed cards */}
                        {goal.expanded && (
                          <div
                            className="px-3 pb-3 space-y-2"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="ml-5 border-l border-purple-500/20 pl-3 space-y-2">
                              {/* Loading shimmer */}
                              {goal.seedsLoading && (
                                <div className="space-y-2">
                                  {[0, 1, 2].map((i) => (
                                    <div
                                      key={i}
                                      className="rounded-lg p-3"
                                      style={{
                                        background: 'rgba(255,255,255,0.02)',
                                        border: '1px solid rgba(255,255,255,0.04)',
                                      }}
                                    >
                                      <div
                                        className="h-3 rounded"
                                        style={{
                                          width: `${60 + i * 15}%`,
                                          background: 'rgba(255,255,255,0.06)',
                                          animation: 'commitModalPulse 1.5s ease-in-out infinite',
                                          animationDelay: `${i * 0.2}s`,
                                        }}
                                      />
                                      <div
                                        className="h-2 rounded mt-2"
                                        style={{
                                          width: `${80 - i * 10}%`,
                                          background: 'rgba(255,255,255,0.04)',
                                          animation: 'commitModalPulse 1.5s ease-in-out infinite',
                                          animationDelay: `${i * 0.2 + 0.1}s`,
                                        }}
                                      />
                                    </div>
                                  ))}
                                  <div className="flex items-center gap-2 pt-1">
                                    <Sparkles className="w-3 h-3" style={{ color: '#a78bfa', animation: 'commitModalSpin 2s linear infinite' }} />
                                    <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.35)' }}>Generating task seeds...</span>
                                  </div>
                                </div>
                              )}

                              {/* No seeds */}
                              {goal.seeds && goal.seeds.length === 0 && !goal.seedsLoading && (
                                <span className="text-[11px] block py-2" style={{ color: 'rgba(255,255,255,0.30)' }}>
                                  No seeds generated
                                </span>
                              )}

                              {/* Seed cards — each individually selectable */}
                              {goal.seeds?.map((seed, si) => (
                                <div
                                  key={si}
                                  className="rounded-lg p-2.5 flex items-start gap-2.5 cursor-pointer transition-all"
                                  style={{
                                    background: seed.selected ? 'rgba(139,92,246,0.08)' : 'rgba(255,255,255,0.02)',
                                    border: `1px solid ${seed.selected ? 'rgba(139,92,246,0.30)' : 'rgba(255,255,255,0.06)'}`,
                                  }}
                                  onClick={() => toggleSeedSelected(gi, si)}
                                >
                                  {/* Select circle */}
                                  <div
                                    className="mt-0.5 w-4 h-4 rounded-full flex items-center justify-center shrink-0"
                                    style={{
                                      background: seed.selected ? 'rgba(139,92,246,0.50)' : 'transparent',
                                      border: `1.5px solid ${seed.selected ? 'rgba(139,92,246,0.70)' : 'rgba(255,255,255,0.15)'}`,
                                    }}
                                  >
                                    {seed.selected && <Check className="w-2.5 h-2.5 text-white" />}
                                  </div>

                                  <div className="flex-1 min-w-0">
                                    <div className="text-[12px] font-medium" style={{ color: seed.selected ? 'rgba(255,255,255,0.90)' : 'rgba(255,255,255,0.70)' }}>
                                      {seed.title}
                                    </div>
                                    <div className="text-[11px] mt-0.5" style={{ color: 'rgba(255,255,255,0.40)' }}>
                                      {seed.description}
                                    </div>
                                    <div className="flex items-center gap-2 mt-1.5">
                                      <span
                                        className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                                        style={{
                                          color: DEPT_COLORS[seed.suggestedDepartment] || 'rgba(255,255,255,0.50)',
                                          background: DEPT_BG[seed.suggestedDepartment] || 'rgba(255,255,255,0.05)',
                                          border: `1px solid ${DEPT_BORDER[seed.suggestedDepartment] || 'rgba(255,255,255,0.10)'}`,
                                        }}
                                      >
                                        {seed.suggestedDepartment}
                                      </span>
                                      <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.30)' }}>
                                        {seed.roughScope}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Commit button */}
            <button
              onClick={handleCommit}
              disabled={phase === 'committing' || !editedTitle.trim()}
              className="w-full text-[13px] font-medium py-2.5 rounded-lg cursor-pointer transition-all disabled:opacity-40 mt-2"
              style={{
                background: 'rgba(139,92,246,0.60)',
                color: '#fff',
                border: '1px solid rgba(139,92,246,0.40)',
              }}
            >
              {phase === 'committing' ? 'Committing Direction...' : 'Commit Direction'}
            </button>
          </div>
        )}
      </div>

      {/* Spin animation */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @keyframes commitModalSpin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
            @keyframes commitModalPulse {
              0%, 100% { opacity: 0.3; }
              50% { opacity: 0.8; }
            }
          `,
        }}
      />
    </div>
  );
}
