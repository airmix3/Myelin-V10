# Quick Task 260328-vll: Fix Take His Role Black Screen

## What was wrong

The "Take His Role" terminal overlay showed a black screen because:

1. **`require('@/lib/events')` inside SSE stream callback** — Next.js webpack only resolves `@/` path aliases for `import` statements, not `require()`. The `eventBus` reference inside the `ReadableStream.start()` callback was using `require('@/lib/events')` which silently failed at runtime, breaking terminal exit detection.

2. **PTY output race condition** — `spawnTerminal()` was called before `addListener()` was attached in the stream's `start()` callback. The PTY outputs its initial banner/content immediately on spawn, but the SSE listener wasn't ready yet, causing all initial output to be silently dropped.

3. **No error handling on PTY spawn** — If `spawnTerminal()` threw, the error was swallowed and the client got a hanging SSE connection with no data.

## What was fixed

- Moved `eventBus` to a top-level `import` statement (line 14) instead of `require()` inside the callback
- Added early-output buffering: a `bufferOrForward` listener is attached right after spawn, buffering PTY data until the SSE stream's `start()` runs, then flushing and swapping to the real SSE forwarder
- Added try/catch around `spawnTerminal()` and `pauseRun()` with proper error responses

## Files changed

- `src/app/api/terminal/[runId]/route.ts` — Fixed all three issues

## Commit

Single direct fix, no plan/executor needed.
