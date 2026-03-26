import { prisma } from '@/lib/db';
import { notFound } from 'next/navigation';
import WorkspaceClient from './WorkspaceClient';

export default async function DeliverableWorkspacePage({ params }: { params: { id: string } }) {
  const deliverable = await prisma.deliverable.findUnique({
    where: { id: params.id },
    include: { task: true },
  });
  if (!deliverable) notFound();

  // Load chat history from JSONL via existing API (internal fetch)
  let chatMessages: Array<Record<string, unknown>> = [];
  try {
    const chatRes = await fetch(`http://localhost:3000/api/tasks/${deliverable.taskId}/chat`, { cache: 'no-store' });
    if (chatRes.ok) {
      const chatData = await chatRes.json();
      chatMessages = chatData.messages ?? [];
    }
  } catch { /* empty chat on failure */ }

  // Load activity log for Agent Log tab
  const activityLog = await prisma.activityLog.findMany({
    where: { taskId: deliverable.taskId },
    orderBy: { createdAt: 'asc' },
  });

  // Load hire requests for approval cards
  const hireRequests = await prisma.hireRequest.findMany({
    where: { taskId: deliverable.taskId, status: 'pending' },
  });

  // Serialize dates for client component
  const serializedDeliverable = JSON.parse(JSON.stringify(deliverable));
  const serializedActivityLog = JSON.parse(JSON.stringify(activityLog));
  const serializedHireRequests = JSON.parse(JSON.stringify(hireRequests));

  return (
    <WorkspaceClient
      deliverable={serializedDeliverable}
      task={JSON.parse(JSON.stringify(deliverable.task))}
      initialChat={chatMessages}
      activityLog={serializedActivityLog}
      hireRequests={serializedHireRequests}
    />
  );
}
