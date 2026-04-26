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
      // Silent fail -- config save is best-effort
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
    <div className="flex flex-col gap-4">
      <h3 className="text-[13px] uppercase text-slate-500 tracking-wider font-medium m-0">
        Configuration
      </h3>

      {/* Max Budget Input */}
      <div>
        <label className="text-[11px] uppercase text-slate-500 block mb-1.5">
          Max Budget (USD)
        </label>
        <input
          type="number"
          value={maxBudget}
          onChange={(e) => setMaxBudget(Number(e.target.value))}
          min={1}
          max={100}
          step={1}
          className="glass-deep w-full px-3 py-2 rounded-md border border-white/[0.06] text-[13px] text-white bg-white/[0.03] outline-none"
        />
      </div>

      {/* Constraints Textarea */}
      <div>
        <label className="text-[11px] uppercase text-slate-500 block mb-1.5">
          Constraints
        </label>
        <textarea
          value={constraints}
          onChange={(e) => setConstraints(e.target.value)}
          placeholder="Any constraints for the agent..."
          className="glass-deep w-full min-h-[60px] resize-y px-3 py-2 rounded-md border border-white/[0.06] text-[13px] text-white bg-white/[0.03] outline-none"
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
