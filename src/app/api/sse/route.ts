import { eventBus } from '@/lib/events';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      // Send initial connection event
      const hello = `event: connected\ndata: ${JSON.stringify({ timestamp: new Date().toISOString() })}\n\n`;
      controller.enqueue(encoder.encode(hello));

      const handler = (event: { type: string; data: unknown }) => {
        try {
          const chunk = `event: ${event.type}\ndata: ${JSON.stringify(event.data)}\n\n`;
          controller.enqueue(encoder.encode(chunk));
        } catch {
          // Client disconnected -- cleanup will happen via abort
        }
      };

      eventBus.on('event', handler);

      // Clean up on disconnect
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
      'X-Accel-Buffering': 'no',  // Disable nginx buffering if behind proxy
    },
  });
}
