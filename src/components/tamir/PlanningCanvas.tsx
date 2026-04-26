'use client';

import { useState, useCallback } from 'react';
import { motion } from 'motion/react';
import { X, Pencil, Save, Check } from 'lucide-react';
import { marked } from 'marked';

// ── Types ────────────────────────────────────────────────────────────────────

interface PlanStep {
  id: string;
  title: string;
  body: string;
}

// ── Parser functions ─────────────────────────────────────────────────────────

export function parseMarkdownToSteps(markdown: string): PlanStep[] {
  // Try splitting on ## headings first
  const sections = markdown.split(/^## /m).filter(Boolean);
  if (sections.length > 1) {
    return sections.map((sec, i) => {
      const lines = sec.split('\n');
      return { id: `step-${i}`, title: lines[0].trim(), body: lines.slice(1).join('\n').trim() };
    });
  }
  // Fallback: split on numbered list items
  const numbered = markdown.split(/^(\d+)\.\s+/m).filter(Boolean);
  if (numbered.length > 2) {
    const steps: PlanStep[] = [];
    for (let i = 0; i < numbered.length; i += 2) {
      const title = numbered[i + 1]?.split('\n')[0]?.trim() ?? `Step ${numbered[i]}`;
      const body = numbered[i + 1]?.split('\n').slice(1).join('\n').trim() ?? '';
      steps.push({ id: `step-${Math.floor(i / 2)}`, title, body });
    }
    return steps;
  }
  // Final fallback: single card
  return [{ id: 'step-0', title: 'Plan', body: markdown }];
}

export function stepsToMarkdown(steps: PlanStep[]): string {
  return steps.map(s => `## ${s.title}\n\n${s.body}`).join('\n\n');
}

// ── Step Card ────────────────────────────────────────────────────────────────

function StepCard({
  step,
  index,
  onUpdateTitle,
  onUpdateBody,
}: {
  step: PlanStep;
  index: number;
  onUpdateTitle: (title: string) => void;
  onUpdateBody: (body: string) => void;
}) {
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(step.title);

  const saveTitle = () => {
    if (titleDraft.trim()) onUpdateTitle(titleDraft.trim());
    setEditingTitle(false);
  };

  const bodyHtml = marked.parse(step.body, { async: false }) as string;

  return (
    <div
      className="glass-card rounded-xl px-4 py-3 space-y-2"
    >
      {/* Step number + title */}
      <div className="flex items-center gap-2">
        <span
          className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0"
          style={{ background: 'var(--color-accent, #38bdf8)' }}
        >
          {index + 1}
        </span>
        {editingTitle ? (
          <div className="flex-1 flex items-center gap-1">
            <input
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') saveTitle(); if (e.key === 'Escape') setEditingTitle(false); }}
              onBlur={saveTitle}
              autoFocus
              className="flex-1 text-[14px] font-semibold text-white bg-transparent outline-none border-b"
              style={{ borderColor: 'var(--color-accent, #38bdf8)' }}
            />
            <button onClick={saveTitle} className="text-emerald-400 cursor-pointer">
              <Check size={14} />
            </button>
          </div>
        ) : (
          <button
            onClick={() => { setEditingTitle(true); setTitleDraft(step.title); }}
            className="text-left flex-1 text-[14px] font-semibold text-white hover:text-sky-300 transition-colors cursor-text"
            title="Click to edit title"
          >
            {step.title}
          </button>
        )}
      </div>

      {/* Body rendered as markdown */}
      <div
        className="text-[13px] text-slate-300 leading-relaxed pl-7 prose prose-sm prose-invert max-w-none"
        dangerouslySetInnerHTML={{ __html: bodyHtml }}
      />
    </div>
  );
}

// ── Main PlanningCanvas ──────────────────────────────────────────────────────

export default function PlanningCanvas({
  taskId,
  planMarkdown,
  onPlanChange,
  onClose,
  children,
}: {
  taskId: string;
  planMarkdown: string;
  onPlanChange: (markdown: string) => void;
  onClose: () => void;
  children?: React.ReactNode;
}) {
  const [editMode, setEditMode] = useState(false);
  const [editSource, setEditSource] = useState<'cards' | 'markdown' | null>(null);
  const [rawDraft, setRawDraft] = useState(planMarkdown);
  const [saving, setSaving] = useState(false);

  const steps = parseMarkdownToSteps(planMarkdown);

  // ── Card editing (bidirectional sync) ────────────────────────────────────

  const handleUpdateStepTitle = useCallback((index: number, title: string) => {
    const updated = steps.map((s, i) => i === index ? { ...s, title } : s);
    setEditSource('cards');
    onPlanChange(stepsToMarkdown(updated));
  }, [steps, onPlanChange]);

  const handleUpdateStepBody = useCallback((index: number, body: string) => {
    const updated = steps.map((s, i) => i === index ? { ...s, body } : s);
    setEditSource('cards');
    onPlanChange(stepsToMarkdown(updated));
  }, [steps, onPlanChange]);

  // ── Raw markdown editing ─────────────────────────────────────────────────

  const handleRawChange = useCallback((value: string) => {
    setRawDraft(value);
    setEditSource('markdown');
    onPlanChange(value);
  }, [onPlanChange]);

  // ── Save to server ───────────────────────────────────────────────────────

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      await fetch(`/api/tasks/${taskId}/artifact`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planMarkdown }),
      });
    } catch (err) {
      console.error('Failed to save plan:', err);
    } finally {
      setSaving(false);
    }
  }, [taskId, planMarkdown]);

  // Keep raw draft in sync when planMarkdown changes externally
  if (editSource !== 'markdown' && rawDraft !== planMarkdown) {
    setRawDraft(planMarkdown);
  }

  return (
    <motion.div
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="glass-panel shrink-0 w-1/2 h-full flex flex-col overflow-hidden"
      style={{ borderLeft: '1px solid rgba(255,255,255,0.06)' }}
    >
      {/* ── Header ── */}
      <div
        className="glass-deep shrink-0 px-4 py-3 flex items-center gap-2"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
      >
        <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--color-accent, #38bdf8)' }}>
          Mission Plan
        </span>
        <span
          className="px-1.5 py-0.5 rounded text-[8px] font-bold uppercase"
          style={{ background: 'rgba(245,158,11,0.12)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.25)' }}
        >
          Draft
        </span>
        <div className="flex-1" />
        <button
          onClick={() => { setEditMode(!editMode); if (!editMode) setRawDraft(planMarkdown); }}
          className="p-1.5 rounded-lg text-slate-400 hover:text-white transition-colors cursor-pointer"
          style={{ background: editMode ? 'rgba(255,255,255,0.08)' : 'transparent' }}
          title={editMode ? 'Switch to card view' : 'Edit raw markdown'}
        >
          {editMode ? <Save size={14} /> : <Pencil size={14} />}
        </button>
        <button
          onClick={onClose}
          className="p-1.5 text-slate-500 hover:text-white transition-colors cursor-pointer"
        >
          <X size={14} />
        </button>
      </div>

      {/* ── Content ── */}
      <div
        className="flex-1 overflow-y-auto px-4 py-3"
        style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.06) transparent' }}
      >
        {editMode ? (
          /* Raw markdown editor */
          <textarea
            value={rawDraft}
            onChange={(e) => handleRawChange(e.target.value)}
            className="glass-deep w-full h-full rounded-xl p-3 text-[13px] text-slate-200 outline-none resize-none"
            style={{ fontFamily: 'var(--font-geist-mono, monospace)', minHeight: '400px' }}
            spellCheck={false}
          />
        ) : (
          /* Card-per-step view */
          <div className="space-y-3">
            {steps.map((step, i) => (
              <StepCard
                key={step.id}
                step={step}
                index={i}
                onUpdateTitle={(title) => handleUpdateStepTitle(i, title)}
                onUpdateBody={(body) => handleUpdateStepBody(i, body)}
              />
            ))}
          </div>
        )}
        {children}
      </div>

      {/* ── Footer with save ── */}
      <div
        className="shrink-0 px-4 py-3 flex items-center gap-2"
        style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
      >
        <span className="text-[10px] text-slate-600 flex-1">
          {steps.length} step{steps.length !== 1 ? 's' : ''} in plan
        </span>
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-3 py-1.5 rounded-lg text-[11px] font-semibold text-white cursor-pointer transition-colors"
          style={{
            background: saving ? 'rgba(255,255,255,0.05)' : 'var(--color-accent, #38bdf8)',
            opacity: saving ? 0.6 : 1,
          }}
        >
          {saving ? 'Saving...' : 'Save Plan'}
        </button>
      </div>
    </motion.div>
  );
}
