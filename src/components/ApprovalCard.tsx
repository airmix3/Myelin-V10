'use client';

import { useState } from 'react';

interface ApprovalCardProps {
  type: 'hire_approval' | 'budget_increase';
  data: Record<string, unknown>;
  onAction: (action: string, payload?: Record<string, unknown>) => void;
}

export default function ApprovalCard({ type, data, onAction }: ApprovalCardProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [budgetValue, setBudgetValue] = useState<number>(
    type === 'budget_increase' ? (data.currentBudget as number) || 10 : 0
  );

  const handleAction = async (action: string, payload?: Record<string, unknown>) => {
    setIsProcessing(true);
    try {
      await onAction(action, payload);
    } catch { /* ignore */ }
  };

  if (type === 'hire_approval') {
    const hireRequestId = data.id as string;
    const roleName = data.employeeRole as string || 'assistant';
    const agentName = data.requestedBy as string || 'Agent';

    return (
      <div className="approval-card">
        <div className="approval-card-header">
          <strong>Hire Request: {roleName}</strong>
        </div>
        <div className="approval-card-body">
          <p>{agentName} is requesting to hire a {roleName} to assist with this task.</p>
          {data.justification && (
            <p style={{ color: 'var(--text-dim)', fontSize: '10px', marginTop: '4px' }}>
              {data.justification as string}
            </p>
          )}
          <div className="approval-card-actions">
            <button
              className="btn btn-approve btn-sm"
              disabled={isProcessing}
              onClick={() => handleAction('hire_approve', { hireRequestId })}
            >
              {isProcessing ? 'Processing...' : 'Approve Hire'}
            </button>
            <button
              className="btn btn-cancel btn-sm"
              disabled={isProcessing}
              onClick={() => handleAction('hire_reject', { hireRequestId })}
            >
              {isProcessing ? 'Processing...' : 'Reject Hire'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Budget increase card
  const taskId = data.taskId as string;
  const currentBudget = data.currentBudget as number || 0;

  return (
    <div className="approval-card">
      <div className="approval-card-header">
        <strong>Budget Limit Reached</strong>
      </div>
      <div className="approval-card-body">
        <p>
          I&apos;ve hit the budget limit set for this task (${currentBudget.toFixed(2)}).
          I can continue if you authorize additional budget.
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px' }}>
          <label style={{ fontSize: '10px', color: 'var(--text-dim)' }}>New max ($):</label>
          <input
            type="number"
            value={budgetValue}
            onChange={(e) => setBudgetValue(parseFloat(e.target.value) || 0)}
            style={{ width: '100px' }}
            min={currentBudget}
            step={1}
            disabled={isProcessing}
          />
        </div>
        <div className="approval-card-actions">
          <button
            className="btn btn-approve btn-sm"
            disabled={isProcessing || budgetValue <= 0}
            onClick={() => handleAction('budget_increase', { taskId, maxBudgetUsd: budgetValue })}
          >
            {isProcessing ? 'Processing...' : 'Approve Increase'}
          </button>
        </div>
      </div>
    </div>
  );
}
