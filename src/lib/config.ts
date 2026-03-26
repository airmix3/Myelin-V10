/**
 * Myelin runtime configuration.
 *
 * All tuneable values live here. No magic numbers in application code.
 * Values are grouped by subsystem and annotated with the decision reference
 * that established them.
 */

// ---------------------------------------------------------------------------
// Worker loop (src/lib/worker.ts)
// ---------------------------------------------------------------------------

/** How often the worker polls for queued task_runs (ms). D-09: fixed 2s, no backoff. */
export const WORKER_POLL_INTERVAL_MS = 2000;

/** How often an executing run writes a heartbeat timestamp (ms). FOUND-07. */
export const WORKER_HEARTBEAT_INTERVAL_MS = 15000;

/** Seconds since last heartbeat before a run is considered stale. D-11: 2 minutes. */
export const WORKER_STALE_THRESHOLD_S = 120;

/** Maximum number of SDK subprocesses running concurrently. FOUND-07. */
export const WORKER_MAX_CONCURRENT = 3;
