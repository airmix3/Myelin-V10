'use client';

import { useState, useCallback } from 'react';
import DeliverableDetail from '@/components/deliverables/DeliverableDetail';
import PromoteToAssetModal from '../PromoteToAssetModal';

interface WorkspaceClientProps {
  deliverable: Record<string, unknown>;
  task: Record<string, unknown>;
  initialChat: Array<Record<string, unknown>>;
  activityLog: Array<Record<string, unknown>>;
  hireRequests: Array<Record<string, unknown>>;
}

export default function WorkspaceClient({
  deliverable,
  task,
  initialChat,
  activityLog,
  hireRequests,
}: WorkspaceClientProps) {
  const taskId = task.id as string;
  const [promoteModalOpen, setPromoteModalOpen] = useState(false);
  const [promotionDone, setPromotionDone] = useState(false);

  const handleHireApprove = useCallback(async (hireRequestId: string) => {
    try {
      await fetch(`/api/hire_requests/${hireRequestId}/approve`, { method: 'POST' });
    } catch { /* ignore */ }
  }, []);

  const handleHireReject = useCallback(async (hireRequestId: string) => {
    try {
      await fetch(`/api/hire_requests/${hireRequestId}/reject`, { method: 'POST' });
    } catch { /* ignore */ }
  }, []);

  const handleBudgetIncrease = useCallback(async () => {
    try {
      await fetch(`/api/tasks/${taskId}/budget`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ maxBudgetUsd: 10 }),
      });
    } catch { /* ignore */ }
  }, [taskId]);

  const handleTaskApprove = useCallback(async () => {
    try {
      await fetch(`/api/tasks/${taskId}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve' }),
      });
      window.location.href = '/';
    } catch { /* ignore */ }
  }, [taskId]);


  return (
    <>
      <DeliverableDetail
        deliverable={deliverable}
        task={task}
        initialChat={initialChat}
        activityLog={activityLog}
        hireRequests={hireRequests}
        onPromoteClick={() => setPromoteModalOpen(true)}
        onHireApprove={handleHireApprove}
        onHireReject={handleHireReject}
        onBudgetIncrease={handleBudgetIncrease}
        onTaskApprove={handleTaskApprove}
      />

      <PromoteToAssetModal
        isOpen={promoteModalOpen}
        onClose={() => setPromoteModalOpen(false)}
        deliverableId={deliverable.id as string}
        deliverableTitle={(deliverable.title as string) || 'Untitled'}
        onPromoted={() => {
          setPromotionDone(true);
          setPromoteModalOpen(false);
        }}
      />
    </>
  );
}
