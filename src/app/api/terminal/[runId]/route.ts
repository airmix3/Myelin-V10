import { NextRequest, NextResponse } from 'next/server';
import { sqlite } from '@/lib/db';
import {
  spawnTerminal,
  writeToTerminal,
  resizeTerminal,
  killTerminal,
  isTerminalActive,
  addListener,
  removeListener,
} from '@/lib/pty-manager';
import { pauseRun, resumeRun } from '@/lib/worker';
import { eventBus } from '@/lib/events';

/**
 * GET /api/terminal/[runId] -- SSE stream that forwards PTY output to the client.
 * On first connection: pauses the SDK run and spawns a PTY session.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: { runId: string } },
) {
  const { runId } = params;

  // Look up the task_run
  const run = sqlite.prepare(
    'SELECT id, taskId, sessionId, workspaceCwd, status FROM task_runs WHERE id = ?'
  ).get(runId) as {
    id: string;
    taskId: string;
    sessionId: string | null;
    workspaceCwd: string | null;
    status: string;
  } | undefined;

  if (!run) {
    return NextResponse.json({ error: 'Run not found' }, { status: 404 });
  }

  if (!run.sessionId) {
    return NextResponse.json({ error: 'No session to resume' }, { status: 400 });
  }

  if (!run.workspaceCwd) {
    return NextResponse.json({ error: 'No workspace directory' }, { status: 400 });
  }

  // Pause the SDK agent if it's running
  if (run.status === 'executing') {
    try {
      await pauseRun(runId);
    } catch (err) {
      console.error('Failed to pause run:', err);
    }
  }

  // Buffer early PTY output so nothing is lost before SSE listener attaches
  const earlyBuffer: string[] = [];
  let sseListener: ((data: string) => void) | null = null;

  function bufferOrForward(data: string) {
    if (sseListener) {
      sseListener(data);
    } else {
      earlyBuffer.push(data);
    }
  }

  // Attach buffer listener BEFORE spawning PTY to catch all output
  if (!isTerminalActive(runId)) {
    // Pre-register the buffer listener on the pty-manager for this runId
    // (addListener is a no-op until spawn creates the entry, so we spawn first
    //  but with a data handler already wired into the PTY via the spawn itself)
    try {
      spawnTerminal(runId, run.sessionId, run.workspaceCwd);
    } catch (err) {
      console.error('Failed to spawn PTY:', err);
      return NextResponse.json({ error: 'Failed to spawn terminal' }, { status: 500 });
    }
  }

  // Immediately attach the buffer listener
  addListener(runId, bufferOrForward);

  // Set up SSE stream
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      function onData(data: string) {
        try {
          const encoded = Buffer.from(data).toString('base64');
          controller.enqueue(encoder.encode(`event: data\ndata: ${encoded}\n\n`));
        } catch {
          // Stream may be closed
        }
      }

      // Flush any buffered early output
      for (const chunk of earlyBuffer) {
        onData(chunk);
      }
      earlyBuffer.length = 0;

      // Swap the buffer listener to the real SSE forwarder
      removeListener(runId, bufferOrForward);
      addListener(runId, onData);
      sseListener = onData;

      function onTerminalExit(event: unknown) {
        const evt = event as { type: string; data: { runId: string } };
        if (evt.data?.runId === runId) {
          try {
            controller.enqueue(encoder.encode(`event: exit\ndata: {}\n\n`));
            controller.close();
          } catch {
            // Already closed
          }
          // Resume the SDK agent
          resumeRun(runId).catch(() => {});
          cleanup();
        }
      }

      // Listen for terminal exit via eventBus (uses top-level import, not require)
      eventBus.on('event', onTerminalExit);

      function cleanup() {
        removeListener(runId, onData);
        eventBus.removeListener('event', onTerminalExit);
      }

      // Handle client disconnect
      _req.signal.addEventListener('abort', () => {
        cleanup();
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}

/**
 * POST /api/terminal/[runId] -- Receives keyboard input or resize commands.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { runId: string } },
) {
  const { runId } = params;
  const body = await req.json();

  if (!isTerminalActive(runId)) {
    return NextResponse.json({ error: 'No active terminal' }, { status: 404 });
  }

  if (body.type === 'input' && typeof body.data === 'string') {
    const decoded = Buffer.from(body.data, 'base64').toString('utf-8');
    writeToTerminal(runId, decoded);
    return NextResponse.json({ ok: true });
  }

  if (body.type === 'resize' && typeof body.cols === 'number' && typeof body.rows === 'number') {
    resizeTerminal(runId, body.cols, body.rows);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
}

/**
 * DELETE /api/terminal/[runId] -- Force-kills the terminal and resumes SDK agent.
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { runId: string } },
) {
  const { runId } = params;

  if (isTerminalActive(runId)) {
    killTerminal(runId);
  }

  await resumeRun(runId).catch(() => {});

  return NextResponse.json({ ok: true });
}
