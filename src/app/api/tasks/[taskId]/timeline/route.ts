/**
 * GET /api/tasks/[taskId]/timeline
 * Returns grouped session timeline for the Task Flow visualization.
 * Triggers background LLM summarization on first request; returns cached on subsequent.
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { groupActivityLogsIntoSessions, type TaskTimeline } from '@/lib/timeline';
import { summarizeTimeline } from '@/lib/summarize-timeline';

// In-memory cache for summarized timelines (experimental feature)
const timelineCache = new Map<string, TaskTimeline>();
const summarizationInProgress = new Set<string>();

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ taskId: string }> },
) {
  const { taskId } = await params;

  // Check cache first
  const cached = timelineCache.get(taskId);
  if (cached?.summarized) {
    return NextResponse.json({ timeline: cached });
  }

  // Load activity logs from DB
  const logs = await prisma.activityLog.findMany({
    where: { taskId },
    orderBy: { createdAt: 'asc' },
  });

  if (logs.length === 0) {
    return NextResponse.json({
      timeline: {
        taskId,
        nodes: [],
        connectors: [],
        summarized: true,
      },
    });
  }

  // Convert Prisma result to plain objects with string dates
  const plainLogs = logs.map((l) => ({
    id: l.id,
    taskId: l.taskId,
    agentId: l.agentId,
    actionType: l.actionType,
    description: l.description,
    metadata: l.metadata,
    createdAt: l.createdAt.toISOString(),
  }));

  const timeline = groupActivityLogsIntoSessions(taskId, plainLogs);

  // If we have a cached version that just isn't summarized yet, return that
  if (cached && !cached.summarized) {
    return NextResponse.json({ timeline: cached });
  }

  // Store unsummarized version
  timelineCache.set(taskId, timeline);

  // Fire-and-forget background summarization (only once per taskId)
  if (!summarizationInProgress.has(taskId)) {
    summarizationInProgress.add(taskId);
    summarizeTimeline(timeline)
      .then((summarized) => {
        timelineCache.set(taskId, summarized);
      })
      .catch(() => {
        // Leave unsummarized in cache
      })
      .finally(() => {
        summarizationInProgress.delete(taskId);
      });
  }

  return NextResponse.json({ timeline });
}
