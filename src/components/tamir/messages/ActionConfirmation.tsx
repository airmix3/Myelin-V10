'use client';

import { useState, useEffect } from 'react';

const DEPT_COLORS: Record<string, { bg: string; text: string }> = {
  executive: { bg: 'rgba(245,158,11,0.12)', text: 'text-amber-400' },
  tech: { bg: 'rgba(14,165,233,0.12)', text: 'text-blue-400' },
  marketing: { bg: 'rgba(139,92,246,0.12)', text: 'text-violet-400' },
  operations: { bg: 'rgba(16,185,129,0.12)', text: 'text-emerald-400' },
};

interface EmployeeOption {
  agentId: string;
  name: string;
  isHead: boolean;
  specialty?: string;
}

export interface ActionConfirmationProps {
  actions?: Array<{ label: string; value: string; department?: string }>;
  onAction?: (value: string, extra?: { executorAgentId?: string }) => void;
  taskId?: string;  // Enables executor dropdown on approve actions
}

export default function ActionConfirmation({ actions, onAction, taskId }: ActionConfirmationProps) {
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [selectedExecutor, setSelectedExecutor] = useState<string | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);

  // Check if there's an approve action
  const hasApproveAction = actions?.some(a => a.value.includes('approve')) ?? false;

  useEffect(() => {
    if (!taskId || !hasApproveAction) return;

    fetch(`/api/tasks/${taskId}/employees`)
      .then(res => res.json())
      .then(data => {
        if (data.employees && data.employees.length > 1) {
          setEmployees(data.employees);
          setSelectedExecutor(data.recommendedExecutor || data.employees[0]?.agentId || null);
          setShowDropdown(true);
        }
      })
      .catch(() => { /* Silently fail -- dropdown just won't show */ });
  }, [taskId, hasApproveAction]);

  if (!actions || actions.length === 0) return null;

  return (
    <div className="flex flex-col gap-1 items-start">
      <div className="glass-card max-w-[85%] rounded-2xl p-4 w-full">
        {showDropdown && employees.length > 1 && (
          <div className="mb-3">
            <label className="text-[11px] text-white/50 block mb-1">Executor</label>
            <select
              value={selectedExecutor || ''}
              onChange={(e) => setSelectedExecutor(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-[12px] text-white/80 focus:outline-none focus:border-white/20"
            >
              {employees.map((emp) => (
                <option key={emp.agentId} value={emp.agentId} className="bg-gray-900">
                  {emp.name}{emp.specialty ? ` - ${emp.specialty}` : ''}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          {actions.map((action) => {
            const deptStyle = action.department
              ? DEPT_COLORS[action.department] ?? DEPT_COLORS.executive
              : DEPT_COLORS.executive;

            return (
              <button
                key={action.value}
                onClick={() => {
                  const extra = selectedExecutor ? { executorAgentId: selectedExecutor } : undefined;
                  onAction?.(action.value, extra);
                }}
                className={`px-4 py-2 rounded-xl text-[12px] font-bold cursor-pointer transition-all hover:brightness-125 ${deptStyle.text}`}
                style={{
                  background: deptStyle.bg,
                  border: '1px solid rgba(255,255,255,0.12)',
                }}
              >
                {action.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
