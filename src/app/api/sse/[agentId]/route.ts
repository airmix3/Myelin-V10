/**
 * GET /api/sse/[agentId] -- Per-agent SSE stream.
 * Per doc 17: Each employee gets its own SSE stream filtered to its events.
 * Used by the Agent Log tab to show per-agent execution logs.
 */
import { eventBus } from '@/lib/events';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(
  request: Request,
  { params }: { params: { agentId: string } },
) {
  const { agentId } = params;
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      const hello = `event: connected\ndata: ${JSON.stringify({ agentId, timestamp: new Date().toISOString() })}\n\n`;
      controller.enqueue(encoder.encode(hello));

      const handler = (event: { type: string; data: unknown }) => {
        try {
          const data = event.data as Record<string, unknown> | undefined;

          // Filter: only forward events that match this agent
          if (data && 'agentId' in data && data.agentId !== agentId) return;

          // Also filter buildlog events by nested agentId
          if (event.type === 'task:buildlog') {
            const buildlogData = data as { taskId?: string; event?: { agentId?: string } } | undefined;
            if (buildlogData?.event?.agentId && buildlogData.event.agentId !== agentId) return;
          }

          // Also filter activity events by agentId
          if (event.type === 'task:activity') {
            if (data && 'agentId' in data && data.agentId !== agentId) return;
          }

          const chunk = `event: ${event.type}\ndata: ${JSON.stringify(event.data)}\n\n`;
          controller.enqueue(encoder.encode(chunk));
        } catch {
          // Client disconnected
        }
      };

      eventBus.on('event', handler);

      request.signal.addEventListener('abort', () => {
        eventBus.off('event', handler);
        try { controller.close(); } catch { /* already closed */ }
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
