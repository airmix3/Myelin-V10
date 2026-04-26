# Future: Warm Agent Bridge — Keeping Agents Alive Across Wait Points

## The Pattern

When an agent's `query()` is running and it needs to wait for an external event (human approval, another agent's completion, an async operation), there are two approaches:

**Cold suspend/resume (current):** The agent's `query()` ends. Session saved via `session_id`. RAM freed. When the event occurs, the agent is re-invoked cold with `session_id` + results. Cost: ~4-8s cold-start latency per cycle.

**Warm bridge (future):** The agent's `query()` stays alive. The tool handler blocks on a promise. When the event occurs, the promise resolves, the tool returns results, and the agent continues immediately. Cost: RAM held during the wait, but zero latency on resume.

## Where It Already Exists

### Tamir Warm Sessions

Tamir already uses a warm pattern via `AsyncQueue` + `WarmSessionManager`:

- Tamir's `query()` stays alive between CEO conversation turns
- An `AsyncQueue<SDKUserMessage>` bridges HTTP requests to the SDK
- When the queue is empty, the SDK blocks waiting — Tamir is warm but idle
- When the CEO sends a message, it's pushed into the queue, SDK wakes immediately

This gives ~1-3s response time (inference only) vs ~4-8s for a cold invoke (subprocess spawn + inference).

### How It Differs from the Proposed Bridge

Tamir's warm pattern bridges **human messages** (push into AsyncQueue → SDK processes → returns structured output). The generalized warm bridge would handle **any external event** resolved via a promise — not just human input.

## Where It Could Apply

| Wait Point | Current Approach | Warm Bridge Benefit |
|---|---|---|
| **Sub-task delegation** (head waits for employee) | Cold suspend/resume (doc 17) | Head resumes instantly when employee finishes. Saves ~4-8s per delegation. Tasks with 3-5 delegations save ~20-40s total. |
| **Hire approval** (head waits for CEO) | Cold suspend/resume | Head resumes instantly on approval. But CEO response time is minutes/hours — cold-start latency is negligible vs wait time. Low value. |
| **CEO escalation** (head waits for CEO input) | Cold suspend/resume | Same as hire — CEO response is slow enough that cold-start is irrelevant. Low value. |
| **Cross-department task** (head waits for another dept's task) | Cold suspend via `referenceTaskIds` | Could be high value if cross-dept tasks are quick. But these are typically separate tasks, not sub-tasks. Medium value. |
| **Tamir routing** (Tamir waits between conversation turns) | Already warm (AsyncQueue) | Already implemented. |

**Highest value target: sub-task delegation.** The employee runs for seconds to minutes, and the head resumes immediately when done. Multiple delegations per task compound the savings.

## Architecture

### The Bridge Singleton

A generalized in-memory promise map. Any agent tool can register a wait, and any system component can resolve it.

```typescript
// src/lib/agent-bridge.ts

export interface BridgeResult {
  eventId: string;
  status: 'completed' | 'failed' | 'needs_input';
  data: Record<string, unknown>;  // Event-specific payload
}

class AgentBridge {
  private pending = new Map<string, {
    resolve: (result: BridgeResult) => void;
    reject: (error: Error) => void;
    agentId: string;
    runId: string;
    registeredAt: number;
  }>();

  /**
   * Called by a tool handler that needs to wait for an external event.
   * Blocks until someone calls resolve() or reject().
   */
  waitFor(eventId: string, agentId: string, runId: string): Promise<BridgeResult> {
    return new Promise((resolve, reject) => {
      this.pending.set(eventId, { resolve, reject, agentId, runId, registeredAt: Date.now() });
    });
  }

  /**
   * Called by the system component that produces the event.
   * Resolves the promise that the tool handler is awaiting.
   */
  resolve(eventId: string, result: BridgeResult): boolean {
    const entry = this.pending.get(eventId);
    if (!entry) return false;  // No one waiting
    this.pending.delete(eventId);
    entry.resolve(result);
    return true;
  }

  /**
   * Called on cancellation or error.
   */
  reject(eventId: string, error: Error): boolean {
    const entry = this.pending.get(eventId);
    if (!entry) return false;
    this.pending.delete(eventId);
    entry.reject(error);
    return true;
  }

  /**
   * Check if anyone is waiting for this event.
   * Used to decide warm vs cold path.
   */
  hasWaiter(eventId: string): boolean {
    return this.pending.has(eventId);
  }

  /**
   * Get all pending waits (for diagnostics / restart recovery).
   */
  getPending(): Array<{ eventId: string; agentId: string; runId: string; registeredAt: number }> {
    return Array.from(this.pending.entries()).map(([eventId, entry]) => ({
      eventId, agentId: entry.agentId, runId: entry.runId, registeredAt: entry.registeredAt,
    }));
  }
}

export const agentBridge = new AgentBridge();
```

### Capacity-Aware Dual Path

The system decides at wait-time whether to use warm or cold:

```typescript
// Generic pattern for any tool that waits on an external event
async function waitForEvent(eventId: string, context: { agentId, runId, taskId }) {
  if (canStayWarm()) {
    // Warm path: hold in RAM, block on promise
    workerSlots.markBlocked(context.runId);
    startHeartbeat(context.runId);
    try {
      return await agentBridge.waitFor(eventId, context.agentId, context.runId);
    } finally {
      stopHeartbeat(context.runId);
      workerSlots.markActive(context.runId);
    }
  } else {
    // Cold path: suspend, let worker resume later
    return { action: 'suspend', eventId };
    // Caller (tool handler) signals the SDK to end the query
    // Worker marks run as 'suspended'
    // When event occurs, worker creates new queued run with session_id + results
  }
}

function canStayWarm(): boolean {
  const activeProcesses = workerSlots.getActiveCount() + workerSlots.getBlockedCount();
  const maxProcesses = getMaxProcesses(); // Based on available RAM
  return activeProcesses < maxProcesses;
}
```

### Worker Slot Management

The worker tracks three categories:

```
WORKER_MAX_CONCURRENT = 5  (active agent processes, based on hardware)

Active:  Agents generating tokens / calling tools. Use CPU + RAM + API quota.
Blocked: Agents warm but idle (waiting on bridge). Use RAM only.
Free:    Available for new claims.

Only ACTIVE counts against WORKER_MAX_CONCURRENT for claiming new runs.
ACTIVE + BLOCKED counts against hardware RAM limit for canStayWarm() decision.
```

### Heartbeat During Blocking

The SDK only heartbeats between tool calls, not during. A warm-blocked agent needs its own heartbeat:

```typescript
function startHeartbeat(runId: string): NodeJS.Timeout {
  return setInterval(async () => {
    await updateTaskRunHeartbeat(runId);
  }, HEARTBEAT_INTERVAL_MS);
}
```

### Cancellation

When a task is canceled, all bridge waiters for that task must be unblocked:

```typescript
function cancelTask(taskId: string) {
  // Cancel all runs
  cancelAllRunsForTask(taskId);

  // Unblock any warm-waiting agents
  for (const pending of agentBridge.getPending()) {
    if (getTaskIdForRun(pending.runId) === taskId) {
      agentBridge.reject(pending.eventId, new Error('Task canceled'));
    }
  }
}
```

### Server Restart Recovery

The bridge is in-memory — lost on crash. Recovery depends on the path:

- **Cold path runs:** State is in DB (`suspended` status, `onComplete` action). Standard restart recovery handles it (see `FUTURE_SERVER_RESTART_SUPPORT.md`).
- **Warm path runs:** The agent's query object is gone. The blocked run's `heartbeatAt` will be stale. On startup, detect stale executing runs and mark as failed, or re-queue with session_id for cold resume.

## Event Types

The bridge is generic. Different event types use it differently:

| Event Type | eventId Format | Producer (calls resolve) | Consumer (calls waitFor) |
|---|---|---|---|
| Sub-task completion | `subtask:{subtaskId}` | Worker onRunComplete | `delegate_subtask` tool handler |
| Hire approval | `hire:{hireRequestId}` | CEO approval API route | `request_hire` tool handler |
| CEO input | `input:{taskId}` | CEO message API route | `escalate_to_ceo` tool handler |
| Cross-dept task | `task:{taskId}` | Worker onRunComplete | Future cross-dept tool |

## Relationship to Existing Warm Patterns

| Pattern | Mechanism | Scope | Bridge Candidate? |
|---|---|---|---|
| Tamir standby | Pre-warmed SDK sessions in a pool | Tamir only | No — different pattern (message queue, not event wait) |
| Tamir warm session | AsyncQueue feeding ongoing query() | Tamir multi-turn chat | No — designed for multi-turn conversation, not event wait |
| Agent bridge (this doc) | Promise map, any tool can wait | Any agent, any event | Yes — this is the generalized version |

Tamir's warm pattern and the agent bridge solve different problems:
- **Tamir warm sessions:** Keep a conversation alive across multiple human messages. The SDK blocks on the queue between turns.
- **Agent bridge:** Keep an agent alive across a single wait for a system event. The tool handler blocks on a promise.

They can coexist. A warm Tamir session could internally use the bridge if Tamir ever needs to wait for an agent event mid-conversation.

## Implementation Priority

1. **Sub-task delegation** — highest value, most frequent wait point, shortest wait times (seconds to minutes)
2. **Hire approval** — low value (CEO response is slow, cold-start latency irrelevant)
3. **CEO escalation** — low value (same reason)
4. **Cross-department tasks** — medium value, but architecture needs more design

Implement for sub-task delegation first. Generalize if other wait points benefit.
