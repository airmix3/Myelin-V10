import { prisma } from '@/lib/db';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import WorkspaceClient from './WorkspaceClient';

function isUsefulActivityLogEntry(entry: { actionType: string; description: string | null }): boolean {
  if (entry.actionType !== 'SDK_ASSISTANT') return true;
  const description = entry.description?.trim();
  return Boolean(description && description !== 'Assistant message');
}

export default async function DeliverableWorkspacePage({ params }: { params: { id: string } }) {
  const deliverable = await prisma.deliverable.findUnique({
    where: { id: params.id },
    include: { task: true },
  });
  if (!deliverable) notFound();

  // Load chat history from JSONL via existing API (internal fetch)
  let chatMessages: Array<Record<string, unknown>> = [];
  try {
    const headersList = headers();
    const host = headersList.get('host') || 'localhost:3000';
    const protocol = headersList.get('x-forwarded-proto') || 'http';
    const chatRes = await fetch(`${protocol}://${host}/api/tasks/${deliverable.taskId}/chat`, { cache: 'no-store' });
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
  const filteredActivityLog = activityLog.filter(isUsefulActivityLogEntry);

  // Load hire requests for approval cards
  const hireRequests = await prisma.hireRequest.findMany({
    where: { taskId: deliverable.taskId, status: 'pending' },
  });

  // Serialize dates for client component
  const serializedDeliverable = JSON.parse(JSON.stringify(deliverable));
  const serializedActivityLog = JSON.parse(JSON.stringify(filteredActivityLog));
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
