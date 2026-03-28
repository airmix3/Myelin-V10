'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import type { TaskConfig } from '@/a2a/types';
import GalleryPanel from './GalleryPanel';

interface ConfigPanelProps {
  taskId: string;
  initialConfig?: Partial<TaskConfig>;
  currentDepartment: string;
}

export default function ConfigPanel({ taskId, initialConfig, currentDepartment }: ConfigPanelProps) {
  const [maxBudget, setMaxBudget] = useState(initialConfig?.maxBudgetUsd ?? 10);
  const [constraints, setConstraints] = useState(initialConfig?.constraints ?? '');
  const [selectedTools, setSelectedTools] = useState<string[]>(initialConfig?.selectedTools ?? []);
  const [selectedSkills, setSelectedSkills] = useState<string[]>(initialConfig?.selectedSkills ?? []);
  const [toolHints, setToolHints] = useState<Record<string, string>>(initialConfig?.toolHints ?? {});
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const saveConfig = useCallback(async () => {
    const config: Partial<TaskConfig> = {
      maxBudgetUsd: maxBudget,
      constraints,
      selectedTools,
      selectedSkills,
      toolHints,
    };
    try {
      await fetch(`/api/tasks/${taskId}/config`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
    } catch {
      // Silent fail — config save is best-effort
    }
  }, [taskId, maxBudget, constraints, selectedTools, selectedSkills, toolHints]);

  // Auto-save with 500ms debounce
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      saveConfig();
    }, 500);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [saveConfig]);

  function handleSelectionChange(tools: string[], skills: string[], hints: Record<string, string>) {
    setSelectedTools(tools);
    setSelectedSkills(skills);
    setToolHints(hints);
  }

  return (
    <div className="config-panel" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <h3 style={{ margin: 0, fontSize: '13px', textTransform: 'uppercase', color: 'var(--text-dim)', letterSpacing: '0.5px' }}>
        Configuration
      </h3>

      {/* Max Budget Input */}
      <div>
        <label className="text-dim" style={{ fontSize: '11px', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>
          Max Budget (USD)
        </label>
        <input
          type="number"
          value={maxBudget}
          onChange={(e) => setMaxBudget(Number(e.target.value))}
          min={1}
          max={100}
          step={1}
          style={{
            width: '100%',
            padding: '8px',
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border)',
            borderRadius: '4px',
            color: 'var(--text-primary)',
            fontSize: '13px',
          }}
        />
      </div>

      {/* Constraints Textarea */}
      <div>
        <label className="text-dim" style={{ fontSize: '11px', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>
          Constraints
        </label>
        <textarea
          className="chat-input"
          value={constraints}
          onChange={(e) => setConstraints(e.target.value)}
          placeholder="Any constraints for the agent..."
          style={{
            width: '100%',
            minHeight: '60px',
            padding: '8px',
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border)',
            borderRadius: '4px',
            color: 'var(--text-primary)',
            fontSize: '13px',
            resize: 'vertical',
          }}
        />
      </div>

      {/* Tool/Skill Gallery */}
      <GalleryPanel
        taskId={taskId}
        department={currentDepartment}
        onSelectionChange={handleSelectionChange}
      />
    </div>
  );
}
