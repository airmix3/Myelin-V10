'use client';

import { useState, useEffect, useRef } from 'react';
import { marked } from 'marked';
import ConfigPanel from './ConfigPanel';

export interface CanvasPanelProps {
  planMarkdown: string;
  taskId: string;
  department: string; // For cross-dept gallery logic
  isNewPlan: boolean; // true = typewriter effect, false = render immediately (rehydration per D-17)
  onApprove: () => void;
}

export default function CanvasPanel({
  planMarkdown,
  taskId,
  department,
  isNewPlan,
  onApprove,
}: CanvasPanelProps) {
  const [renderedContent, setRenderedContent] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editContent, setEditContent] = useState(planMarkdown);
  const [isSaving, setIsSaving] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Typewriter effect for new plans (D-08: 40-70ms/line)
  useEffect(() => {
    if (!isNewPlan || !planMarkdown) return;
    setIsTyping(true);
    const lines = planMarkdown.split('\n');
    let i = 0;
    let accumulated = '';

    const timer = setInterval(() => {
      if (i >= lines.length) {
        clearInterval(timer);
        setIsTyping(false);
        return;
      }
      accumulated += lines[i] + '\n';
      setRenderedContent(accumulated);
      i++;
      // Auto-scroll during typewriter
      if (containerRef.current) {
        containerRef.current.scrollTop = containerRef.current.scrollHeight;
      }
    }, 40 + Math.random() * 30); // 40-70ms per line

    return () => clearInterval(timer);
  }, [isNewPlan, planMarkdown]);

  // Immediate render for rehydrated plans (D-17)
  useEffect(() => {
    if (!isNewPlan && planMarkdown) {
      setRenderedContent(planMarkdown);
    }
  }, [isNewPlan, planMarkdown]);

  // Update editContent when planMarkdown changes
  useEffect(() => {
    setEditContent(planMarkdown);
  }, [planMarkdown]);

  const handleEditToggle = () => {
    if (isEditMode) {
      // Save plan via PUT /api/tasks/[taskId]/artifact
      handleSave();
    } else {
      // Enter edit mode
      setEditContent(renderedContent || planMarkdown);
      setIsEditMode(true);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const res = await fetch(`/api/tasks/${taskId}/artifact`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan_markdown: editContent }),
      });
      if (res.ok) {
        setRenderedContent(editContent);
        setIsEditMode(false);
      }
    } catch {
      // Keep in edit mode on failure
    } finally {
      setIsSaving(false);
    }
  };

  const displayContent = renderedContent || planMarkdown;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '16px' }}>
      {/* Canvas content area */}
      <div
        ref={containerRef}
        style={{ flex: 1, overflowY: 'auto' }}
      >
        {isEditMode ? (
          <textarea
            style={{
              width: '100%',
              minHeight: '400px',
              background: 'var(--bg-3)',
              color: 'var(--text)',
              border: '1px solid var(--border)',
              fontFamily: 'var(--font)',
              fontSize: '13px',
              padding: '16px',
              resize: 'vertical',
              borderRadius: 'var(--radius)',
            }}
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
          />
        ) : (
          <div>
            <div
              className="md-render"
              dangerouslySetInnerHTML={{
                __html: marked.parse(displayContent) as string,
              }}
            />
            {isTyping && (
              <span style={{ animation: 'blink 0.6s infinite', fontSize: '16px', color: 'var(--accent)' }}>|</span>
            )}
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: '8px', marginTop: '16px', borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
        <button
          className="btn"
          onClick={handleEditToggle}
          disabled={isTyping || isSaving}
        >
          {isEditMode ? 'Save Plan' : 'Edit Plan'}
        </button>
        <button
          className="btn-approve"
          onClick={onApprove}
          disabled={isTyping}
        >
          Approve Plan
        </button>
      </div>

      {/* Config section - shown when plan is ready (per Plan 06: TAMIR-05) */}
      {!isTyping && (
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: '16px', marginTop: '16px' }}>
          <ConfigPanel taskId={taskId} currentDepartment={department} />
        </div>
      )}
    </div>
  );
}
