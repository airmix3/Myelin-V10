import { NextRequest, NextResponse } from 'next/server';
import { existsSync } from 'fs';
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
  console.log('[terminal] GET request for runId:', runId);

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
    console.error('[terminal] Run not found:', runId);
    return NextResponse.json({ error: 'Run not found' }, { status: 404 });
  }

  console.log('[terminal] Run found:', { id: run.id, status: run.status, sessionId: run.sessionId?.slice(0, 8), workspaceCwd: run.workspaceCwd });

  if (!run.sessionId) {
    console.error('[terminal] No sessionId for run:', runId);
    return NextResponse.json({ error: `No session to resume (run status: ${run.status})` }, { status: 400 });
  }

  if (!run.workspaceCwd) {
    console.error('[terminal] No workspaceCwd for run:', runId);
    return NextResponse.json({ error: `No workspace directory (run status: ${run.status})` }, { status: 400 });
  }

  // Verify workspace directory exists
  if (!existsSync(run.workspaceCwd)) {
    console.error('[terminal] Workspace directory missing:', run.workspaceCwd);
    return NextResponse.json({ error: `Workspace directory not found: ${run.workspaceCwd}` }, { status: 400 });
  }

  // Pause the SDK agent if it's running
  if (run.status === 'executing') {
    try {
      console.log('[terminal] Pausing executing run:', runId);
      await pauseRun(runId);
    } catch (err) {
      console.error('[terminal] Failed to pause run:', err);
      // Continue anyway — the run may have already completed
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

  // Spawn PTY if not already active
  if (!isTerminalActive(runId)) {
    try {
      console.log('[terminal] Spawning PTY for run:', runId, 'session:', run.sessionId!.slice(0, 8), 'cwd:', run.workspaceCwd);
      spawnTerminal(runId, run.sessionId!, run.workspaceCwd);
    } catch (err) {
      console.error('[terminal] Failed to spawn PTY:', err);
      return NextResponse.json({ error: 'Failed to spawn terminal', detail: String(err) }, { status: 500 });
    }
  } else {
    console.log('[terminal] PTY already active for run:', runId);
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

      let exited = false;
      function onTerminalExit(event: unknown) {
        const evt = event as { type: string; data: { runId: string } };
        if (evt.data?.runId === runId && !exited) {
          exited = true;
          console.log('[terminal] PTY exited for run:', runId);
          // Clean up listeners FIRST to prevent re-entry from resumeRun's eventBus emit
          cleanup();
          try {
            controller.enqueue(encoder.encode(`event: exit\ndata: {}\n\n`));
            controller.close();
          } catch {
            // Already closed
          }
          // Resume the SDK agent (after cleanup to avoid infinite loop)
          resumeRun(runId).catch(() => {});
        }
      }

      // Listen for terminal exit via eventBus
      eventBus.on('event', onTerminalExit);

      function cleanup() {
        removeListener(runId, onData);
        eventBus.removeListener('event', onTerminalExit);
      }

      // Handle client disconnect
      _req.signal.addEventListener('abort', () => {
        console.log('[terminal] Client disconnected for run:', runId);
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
  console.log('[terminal] DELETE request for run:', runId);

  if (isTerminalActive(runId)) {
    killTerminal(runId);
  }

  await resumeRun(runId).catch(() => {});

  return NextResponse.json({ ok: true });
}
