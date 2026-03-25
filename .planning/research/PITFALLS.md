# Pitfalls Research

**Domain:** TypeScript AI Agent Operating System (multi-agent orchestration with Claude Agent SDK, Next.js, SQLite, A2A, SSE)
**Researched:** 2026-03-25
**Confidence:** HIGH (SDK docs verified via official Anthropic documentation; SQLite WAL from sqlite.org; Next.js from nextjs.org; filesystem and SSE patterns from established Node.js patterns)

## Critical Pitfalls

### Pitfall 1: Claude Agent SDK Spawns Subprocesses, Not Threads

**What goes wrong:**
Each `query()` call spawns a separate Claude Code CLI subprocess. Running 4 concurrent agents (Tamir, CTO, CMO, COO) means 4 separate Node.js child processes. Temp employee hires via `AgentDefinition` subagents spawn additional processes nested inside the parent agent's subprocess. Under load, you get a process tree that consumes significant memory (each Claude Code subprocess loads its own Node.js runtime) and can exhaust system resources on a single-user localhost machine.

**Why it happens:**
The SDK documentation confirms: "Creates an async generator that streams messages as they arrive" but the underlying mechanism is a spawned CLI process communicating via stdio. Developers assume `query()` is an API call (lightweight HTTP request) when it is actually a heavyweight subprocess spawn. The `Query` object wraps `AsyncGenerator<SDKMessage, void>` but the generator is fed by a child process.

**How to avoid:**
- Limit concurrent agent executions. The worker loop should have a configurable concurrency cap (start with 2 concurrent task_runs, not unlimited).
- Never fire-and-forget `query()` calls. Always consume the full async generator to completion or call `query.close()` explicitly on abort.
- Track active subprocess count in the worker loop. Log process spawns/exits. Set a hard ceiling.
- Use `maxTurns` and `maxBudgetUsd` on every `query()` call to prevent runaway agent loops that keep the subprocess alive indefinitely.
- Consider `persistSession: false` for short-lived operations like Tamir's routing decisions to avoid accumulating session files on disk.

**Warning signs:**
- Memory usage climbing steadily during multi-agent runs
- `ps aux | grep claude` shows many orphaned processes
- Agent heartbeats stop but no crash is logged (process zombie)
- System becomes sluggish after several task executions

**Phase to address:**
Foundation phase (invokeAgent wrapper + worker loop). The `invokeAgent()` wrapper must enforce subprocess lifecycle from day one.

---

### Pitfall 2: Session ID Mismanagement and CWD Coupling

**What goes wrong:**
Claude Agent SDK sessions are stored at `~/.claude/projects/<encoded-cwd>/<session-id>.jsonl`, where `<encoded-cwd>` replaces every non-alphanumeric character with `-`. If the `cwd` option passed to `query()` differs between the initial run and a `resume` call, the SDK silently creates a new session instead of resuming. The project uses per-task workspaces (`data/departments/{dept}/desks/{taskId}/`), so every task has a unique cwd. Resuming a session with the wrong cwd causes context loss -- the agent starts fresh without knowing what it already did.

**Why it happens:**
The SDK docs explicitly warn: "If a resume call runs from a different directory, the SDK looks in the wrong place." Developers build resume logic that stores session_id but forgets to store and restore the exact cwd. Path normalization differences (trailing slash, symlink resolution, relative vs absolute) can also cause cwd mismatches.

**How to avoid:**
- Store both `session_id` AND the absolute `cwd` used in the original query in the `task_runs` table.
- Always resolve paths with `path.resolve()` before passing as `cwd` to the SDK.
- Never use `continue: true` in a multi-agent system (it resumes the "most recent" session in the directory, which is ambiguous when multiple agents share a parent directory). Always use explicit `resume: sessionId`.
- Add a validation check: before resuming, verify the session file exists at the expected path.
- Normalize the cwd: strip trailing slashes, resolve symlinks with `fs.realpathSync()`.

**Warning signs:**
- Agent repeats work it already did (re-reads files, re-analyzes)
- Session file count grows unexpectedly in `~/.claude/projects/`
- `init` message appears when you expected `resume` continuation
- Agent loses context mid-conversation ("I don't see any previous analysis")

**Phase to address:**
Foundation phase (invokeAgent wrapper). Session management must be correct before any agent execution logic is built.

---

### Pitfall 3: Next.js instrumentation.ts is Not a Background Worker Runtime

**What goes wrong:**
The `register()` function in `instrumentation.ts` runs once at server startup and must complete before the server handles requests. Developers treat it as a place to start long-running background workers (job queues, cron loops), but: (1) if `register()` doesn't return, the server never starts; (2) in development, hot module reloading can re-execute `register()`, spawning duplicate workers; (3) Next.js may run `register()` in both Node.js and Edge runtimes.

**Why it happens:**
The Next.js docs say register is "called once when a new Next.js server instance is initiated." This sounds like an ideal hook for background tasks. But it's designed for observability setup (OpenTelemetry), not for spawning persistent worker loops. The docs don't explicitly warn against long-running tasks in register.

**How to avoid:**
- Use `register()` only to fire-and-forget initialization: start worker loops but don't await them. The worker loop should run as a detached async task (e.g., `startWorkerLoop()` without `await`).
- Guard against double-init: use `process.env.NEXT_RUNTIME === 'nodejs'` check AND a module-level singleton flag.
- Use a proper custom server (`server.ts` with `next()`) if you need full control over background process lifecycle. The custom server approach lets you start workers explicitly after `app.prepare()` resolves.
- For the cron (Tamir every 15 min), use `setInterval` started from the worker initialization, not a separate process.
- Implement graceful shutdown: listen for `SIGTERM`/`SIGINT`, drain the worker queue, close SSE connections, then exit.

**Warning signs:**
- Server takes forever to start (register is blocking)
- Duplicate cron executions (register called twice)
- Workers die silently after HMR in development
- Worker loop errors crash the Next.js server process

**Phase to address:**
Foundation phase (instrumentation.ts + worker loop). Must be designed correctly from the start because everything depends on the worker running reliably.

---

### Pitfall 4: SQLite WAL Single-Writer Bottleneck with Concurrent Agents

**What goes wrong:**
SQLite WAL mode allows concurrent reads but only ONE writer at a time. When multiple agents run concurrently (worker processing task_runs, agents writing activity_log entries, Tamir cron updating task states, SSE endpoint reading, UI making API calls), write operations serialize and block. Under load, `SQLITE_BUSY` errors surface. Prisma's default retry behavior may not handle this, leading to transaction failures and lost data.

**Why it happens:**
The sqlite.org WAL documentation states: "There can only be one writer at a time." Prisma connects to SQLite but doesn't expose SQLite's busy_timeout pragma by default. Without explicit configuration, a concurrent write attempt gets an immediate SQLITE_BUSY error rather than waiting.

**How to avoid:**
- Enable WAL mode explicitly at startup: `PRAGMA journal_mode=WAL;`
- Set a generous busy_timeout: `PRAGMA busy_timeout=5000;` (5 seconds). This makes SQLite wait for the write lock instead of failing immediately.
- Use Prisma's `$executeRaw` to run these PRAGMAs at startup in the instrumentation hook.
- Keep write transactions short. Never hold a transaction open while waiting for an LLM response.
- Batch activity_log writes: buffer them in memory, flush on interval (every 1-2 seconds) rather than writing each event individually.
- Use a single Prisma client instance (singleton) across the entire application.
- For the FTS5 sync triggers, use SQLite triggers (not application-level sync) so they execute within the same write transaction.

**Warning signs:**
- Intermittent "database is locked" errors in logs
- Activity log entries missing during high concurrency
- Task state transitions failing sporadically
- WAL file growing unboundedly (checkpoint never completes because a long-running reader blocks it)

**Phase to address:**
Foundation phase (Prisma + SQLite setup). WAL mode and busy_timeout must be configured before any concurrent access occurs.

---

### Pitfall 5: SSE Connection Leaks and Event Bus Memory Exhaustion

**What goes wrong:**
The `/api/sse` endpoint opens a long-lived HTTP connection per browser tab. If connections aren't cleaned up when clients disconnect, the server accumulates dead connections. Each connection typically has an event listener registered on an in-memory event bus (EventEmitter). Over time: (1) Node.js `MaxListenersExceededWarning` fires; (2) events broadcast to dead connections waste CPU; (3) if clients reconnect after network blips without the server detecting the old connection is dead, listener count doubles.

**Why it happens:**
SSE in Next.js App Router uses the Web Streams API (ReadableStream). The server-side stream doesn't reliably detect client disconnects in all environments. The `request.signal` (AbortSignal) should fire on disconnect, but there are known edge cases where it doesn't, especially behind proxies or during abrupt client exits.

**How to avoid:**
- Implement a heartbeat: send `:keepalive\n\n` every 15-30 seconds. This serves double duty -- keeps the connection alive through proxies AND detects dead connections (write to a closed socket throws an error you can catch).
- Use `request.signal.addEventListener('abort', cleanup)` but don't rely on it exclusively.
- Maintain a `Map<string, WritableStreamDefaultWriter>` of active connections with timestamps. Periodically sweep (every 60 seconds) and remove connections that haven't acknowledged a heartbeat.
- Set `EventEmitter.defaultMaxListeners` to a reasonable number (e.g., 50) and treat the warning as an error in development.
- Use a single shared EventEmitter instance, NOT one per request.
- On `close` event: remove the listener, close the stream, delete from the connection map.

**Warning signs:**
- `MaxListenersExceededWarning` in console
- Memory usage growing linearly with time (not with active tabs)
- SSE events becoming slower over time
- Dashboard shows stale data despite events being emitted

**Phase to address:**
UI phase (SSE endpoint). Must be designed with cleanup from the start. Retrofitting connection management is painful.

---

### Pitfall 6: Filesystem Workspace Concurrency and Path Traversal

**What goes wrong:**
Multiple agents write to the filesystem concurrently (task desks, MEMORY.md, knowledge directories, JSONL chat files). Without file-level locking: (1) concurrent JSONL appends can interleave, producing corrupt JSON lines; (2) two agents reading the same MEMORY.md, modifying it, and writing back causes last-write-wins data loss; (3) the `GET /api/deliverables/[id]/file?path=...` endpoint is vulnerable to path traversal (`../../etc/passwd`) if not carefully validated.

**Why it happens:**
Node.js `fs.appendFile` is not atomic on all platforms. JSONL append from two processes can interleave partial lines. The SDK agents run as subprocesses with full filesystem access -- if two tasks are assigned to the same department, their desks are separate but they share department-level resources (knowledge library, skills).

**How to avoid:**
- **JSONL writes:** Use `fs.appendFileSync` with exclusive flag, OR use a write queue (async mutex per file path). For chat JSONL, each task has its own file, so concurrent writes to the SAME file should be rare -- but verify this assumption.
- **MEMORY.md:** Each agent has its own MEMORY.md in their desk. The memory-management skill reads/writes at task start/end. Ensure the skill operates on the desk-local copy, not a shared file.
- **Path traversal:** In the file-serving API route, resolve the requested path, then verify it starts with the expected desk root using `resolvedPath.startsWith(deskRoot)`. Use `path.resolve()` (not `path.join()`) to normalize `..` segments. Reject symlinks that escape the desk root.
- **Symlink security:** `createTaskWorkspace()` symlinks department skills into the desk. Ensure the agent's `cwd` is the desk directory and the SDK's `additionalDirectories` doesn't grant access beyond the desk + department.
- **Knowledge writes:** The `write_knowledge` tool should use an async mutex keyed by department to prevent concurrent writes to the same department's knowledge directory.

**Warning signs:**
- Corrupt JSONL files (JSON.parse fails on individual lines)
- Agent memory losing recently written content
- Security scanner flagging path traversal in file-serving endpoints
- Symlink targets pointing outside expected directories

**Phase to address:**
Foundation phase (workspace creation) and A2A/Tools phase (tool implementations). Path traversal prevention must be in the file-serving API from day one.

---

### Pitfall 7: Structured Output with outputFormat Interacts Poorly with Multi-Turn Tool Use

**What goes wrong:**
When using `outputFormat: { type: 'json_schema', schema }` for routing decisions (e.g., Tamir's LLM-based routing), the structured output is only produced in the FINAL result message, after all tool use is complete. If the agent decides to use tools before producing the structured output, the call takes much longer than expected. Worse, if the schema is complex and the agent can't satisfy it after multiple retries, you get `error_max_structured_output_retries` and no output at all.

**Why it happens:**
The SDK docs confirm: "The agent can use any tools it needs to complete the task, and you still get validated JSON matching your schema at the end." The structured output is NOT produced on each turn -- it's the final answer. For a routing decision that should be instant (no tool use needed), the agent might still decide to read files or search before answering, delaying the structured response.

**How to avoid:**
- For routing decisions (Tamir), use a focused prompt that doesn't require tool use. Provide all necessary context in the prompt itself (inbox content, department descriptions) so the agent can produce the routing decision without tools.
- Set `maxTurns: 1` for pure routing/classification calls where no tool use is desired.
- Keep routing schemas simple: `{ department: string, confidence: number, reasoning: string }`. Complex schemas increase retry risk.
- Always handle `error_max_structured_output_retries` -- fall back to a default route or re-prompt with a simpler schema.
- Don't use `outputFormat` for intermediate decisions within a longer workflow. Use it only for the final deliverable structure or for isolated classification calls.

**Warning signs:**
- Routing decisions taking 30+ seconds (agent is using tools before answering)
- `error_max_structured_output_retries` errors in routing logs
- Agent producing verbose text before the structured output
- Routing accuracy decreasing with complex schemas

**Phase to address:**
A2A Protocol phase (Tamir routing). The routing wrapper must be designed with these constraints in mind.

---

### Pitfall 8: A2A Task State Machine Allows Invalid Transitions Under Concurrency

**What goes wrong:**
The A2A spec defines valid state transitions (submitted -> working -> completed/failed). But concurrent events can cause invalid transitions: an agent finishes (working -> completed) at the same moment the user cancels (working -> canceled). Without a serialization mechanism, both transitions succeed and the task ends up in an inconsistent state. Worse, the supervisor review flow (executor finishes -> supervisor reviews) requires changing `currentActorId` atomically with the state transition.

**Why it happens:**
The `transitionTask()` function reads the current state, validates the transition, then writes the new state. Between the read and write, another request can change the state (classic TOCTOU race). SQLite transactions should prevent this, but only if the transition check and update are in the SAME transaction.

**How to avoid:**
- Implement `transitionTask()` as a single SQL UPDATE with a WHERE clause that includes the expected current state: `UPDATE tasks SET state = 'completed', currentActorId = ? WHERE id = ? AND state = 'working'`. If the update affects 0 rows, the transition was invalid (state already changed).
- Wrap state + currentActorId changes in a single Prisma `$transaction()`.
- Return the affected row count and treat 0 as a conflict (log it, don't retry blindly).
- Don't use optimistic concurrency with version numbers -- the WHERE-on-current-state pattern is simpler and sufficient for this scale.
- Log every transition with the previous state, new state, and actor for debugging.

**Warning signs:**
- Tasks stuck in "working" state forever (transition to completed failed silently)
- Duplicate activity_log entries for the same transition
- Supervisor invoked on an already-completed task
- Race conditions in tests that run transitions in parallel

**Phase to address:**
A2A Protocol phase (transitionTask implementation). Must be atomic from the first implementation.

---

### Pitfall 9: FTS5 Virtual Tables Are Invisible to Prisma Migrations

**What goes wrong:**
Prisma manages the database schema through migrations. FTS5 virtual tables (`CREATE VIRTUAL TABLE ... USING fts5(...)`) and their sync triggers cannot be expressed in the Prisma schema file. If you create them via raw SQL in a migration, Prisma's `prisma migrate dev` will detect schema drift and may try to drop them. If you create them outside of migrations (e.g., in instrumentation.ts at startup), they survive migrations but aren't tracked, and `prisma migrate reset` destroys them.

**Why it happens:**
Prisma's schema language doesn't support SQLite virtual tables. The migration system tracks what it creates and flags anything it didn't create as drift. FTS5 tables are a SQLite-specific extension that ORMs generally don't support.

**How to avoid:**
- Create FTS5 tables and triggers in a Prisma migration file using `prisma migrate --create-only` and then adding raw SQL (`CREATE VIRTUAL TABLE IF NOT EXISTS ...`) to the generated migration.
- Use `IF NOT EXISTS` for both the virtual table and triggers so they're idempotent.
- Additionally, run the FTS5 initialization in the instrumentation hook as a safety net (ensures FTS exists even if migrations are re-run or DB is restored from backup).
- Never use `prisma migrate reset` in production -- use the system-reset skill that preserves the FTS5 structure.
- Test migrations in CI: run `prisma migrate deploy` on a fresh DB and verify FTS5 tables exist.

**Warning signs:**
- FTS5 search returning empty results after a migration
- Prisma warning about schema drift mentioning unknown tables
- `prisma migrate reset` breaking search functionality
- Triggers not firing after database restoration

**Phase to address:**
Foundation phase (Prisma schema + FTS5 setup). Must be solved before any data is written to FTS5 tables.

---

### Pitfall 10: MCP Server Tool Context Leaks Between Concurrent Agent Invocations

**What goes wrong:**
The project uses a single in-process MCP server (`createSdkMcpServer`) with tools like `read_memory`, `write_knowledge`, etc. Each tool needs context (taskId, agentId, department, paths) to know which agent is calling. If the tool context is set globally (e.g., module-level variable), concurrent agent invocations overwrite each other's context. Agent A's `write_memory` call writes to Agent B's memory file.

**Why it happens:**
The `createSdkMcpServer()` creates a single server instance. The PROJECT.md specifies a "ToolContext closure factory: per-invocation context injected into all tools." If implemented as a global mutable state instead of a proper closure, concurrent access corrupts the context.

**How to avoid:**
- Create a NEW MCP server instance per `query()` call, not a shared global. Each agent invocation gets its own server with its own tool context baked into the closures.
- Use the `tool()` function's handler closure to capture the per-invocation context at creation time. The closure captures `taskId`, `agentId`, etc. as immutable values.
- Never store tool context in module-level variables or singleton state.
- Alternative: If creating a server per invocation is too expensive, use the `extra` parameter in the tool handler to pass request-scoped context. But verify the SDK actually passes this through from the agent.
- Test with concurrent agents: run two agents simultaneously and verify each writes to its own files.

**Warning signs:**
- Agent writing to wrong department's knowledge
- Memory files containing entries from different agents
- Tool calls succeeding but affecting the wrong task
- Intermittent test failures that disappear when run sequentially

**Phase to address:**
A2A Protocol + Tools phase (MCP server + tool context factory). This is the core isolation mechanism.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Global Prisma client without connection management | Quick setup | Connection exhaustion under load, no graceful shutdown | MVP only -- add connection lifecycle management before multi-agent execution |
| Storing structured output schemas as inline JSON objects | Fast to iterate | Schema drift, no single source of truth | Never -- use Zod schemas from day one, generate JSON Schema from them |
| `$queryRawUnsafe` for FTS5 queries | Works immediately | SQL injection risk if user input reaches the query | Only if query parameters are hardcoded or validated; never for user-supplied search terms |
| `fire-and-forget` for activity_log writes | Non-blocking agent execution | Lost log entries on crash, no backpressure | MVP only -- add write buffering before production use |
| Single EventEmitter for all SSE events | Simple pub/sub | No per-task event filtering, all clients receive all events | Phase 1 only -- add topic-based filtering before Cortex UI is built |
| Symlinks for skill sharing without validation | Easy filesystem structure | Symlink targets can be changed, broken, or point outside workspace | Never -- validate symlink targets resolve within expected directories |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Claude Agent SDK + AWS Bedrock | Assuming API key auth works -- Bedrock uses IAM | Set `CLAUDE_CODE_USE_BEDROCK=1` + AWS credentials in env. The SDK reads env vars automatically. Verify IAM role has `bedrock:InvokeModel` permission for the required model. |
| Prisma + SQLite FTS5 | Using `$queryRaw` template literals for FTS5 MATCH queries | FTS5 MATCH syntax (`table MATCH 'query'`) conflicts with Prisma's template interpolation. Use `$queryRawUnsafe` with manually sanitized input, or use `Prisma.sql` tagged template for the static parts and `Prisma.raw` for the MATCH expression. |
| Next.js App Router + SSE | Using `Response` with `ReadableStream` but forgetting `Content-Type` and cache headers | Must set `Content-Type: text/event-stream`, `Cache-Control: no-cache`, `Connection: keep-alive`. Also set `X-Accel-Buffering: no` if behind nginx. |
| Claude Agent SDK + MCP Server | Passing MCP server config as `mcpServers` with command-based server when you want in-process | In-process servers use `createSdkMcpServer()` which returns a config object with the server instance. Command-based configs spawn a subprocess. Don't mix them up. |
| Claude Agent SDK + `settingSources` | Omitting `settingSources: ['project']` and wondering why CLAUDE.md isn't loaded | By default, no filesystem settings are loaded. Must explicitly include `'project'` to load CLAUDE.md, skills, and commands from the workspace. |
| SQLite + Prisma migrations + raw SQL | Running raw SQL PRAGMAs inside Prisma migrations | PRAGMAs like `journal_mode=WAL` and `busy_timeout` must be set per-connection at runtime, not in migrations. Migrations run in their own connection context. |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Unbounded WAL file growth | Disk usage climbs, read queries slow down | Ensure checkpoint runs periodically. Don't keep long-running read transactions open. SQLite auto-checkpoints at 1000 pages by default -- don't disable it. | WAL > 100MB; happens when continuous overlapping readers prevent checkpoint completion |
| Broadcasting all SSE events to all clients | CPU spikes when many events fire, clients process irrelevant events | Filter events by taskId/type before sending to each connection. Use a topic-subscription model. | > 10 concurrent events per second with > 3 connected tabs |
| Storing full agent output in activity_log | Database bloats, queries slow | Store summary/type/status in activity_log, write full output to filesystem (task desk). Link via file path. | > 100 task runs; activity_log table exceeds 100MB |
| FTS5 index not using `content_rowid` properly | Full-text search scans entire content table | Use `content=''` (contentless) with manual sync, or use `content=` pointing to the actual table with `content_rowid=` for auto-sync. Triggers must keep FTS in sync on INSERT/UPDATE/DELETE. | > 10,000 documents in vault |
| Session file accumulation in ~/.claude/projects | Disk usage grows, `listSessions()` slows | Periodically prune old session files. After task completion, consider using `persistSession: false` for ephemeral tasks. | > 500 completed tasks; hundreds of JSONL files |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Path traversal in `/api/deliverables/[id]/file?path=...` | Arbitrary file read from the server filesystem | Resolve the full path, verify it starts with the task's desk root using `resolvedPath.startsWith(deskRoot + path.sep)`. Reject paths containing `..` before resolution. Never use `path.join(base, userInput)` alone -- it doesn't prevent traversal. |
| Agent SDK `permissionMode: 'bypassPermissions'` in production | Agent can execute any command, including destructive ones | Never use bypass mode. Use `allowedTools` to pre-approve safe tools and `canUseTool` callback for dynamic approval. The `disallowedTools` list is checked first and overrides everything -- use it to block `rm`, `curl` to external hosts, etc. |
| Symlinks escaping workspace boundaries | Agent accesses files outside its desk via crafted symlinks | After creating symlinks in `createTaskWorkspace()`, verify each symlink's real path (`fs.realpathSync`) starts with an allowed directory. Disallow the agent from creating new symlinks (don't include symlink-creating tools). |
| LLM prompt injection via user-submitted task content | Agent executes injected instructions from task descriptions | Separate user content from system instructions. Use `systemPrompt` for trusted instructions. Place user task content in the `prompt` parameter, not in system prompts or CLAUDE.md files that the agent trusts. |
| Exposing `.env` or credentials through file-serving API | API key leakage | Maintain a blocklist of file patterns (`.env`, `*.key`, `credentials.*`) in the file-serving endpoint. Also: agents should never have `.env` in their `additionalDirectories`. |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| No progress indication during long agent runs | CEO thinks system is frozen, refreshes page, loses SSE connection | Send `task:heartbeat` SSE events every 10 seconds during agent execution. Show elapsed time and last tool used in the UI. |
| Build log showing raw SDK messages | Incomprehensible wall of JSON | Parse `SDKMessage` types and show human-readable summaries: "Reading auth.ts", "Running tests", "Editing line 42". Raw JSON available in expandable detail. |
| Chat history lost on page navigation | CEO loses context, can't reference earlier discussion | Store chat scroll position in session storage. Load full JSONL history on page mount. Paginate for performance (load last 50 messages, lazy-load older). |
| Tamir routing errors shown as technical failures | CEO sees "error_max_structured_output_retries" and doesn't know what to do | Catch routing failures and show: "I couldn't determine the right team for this task. Could you clarify what you need?" Retry with simpler prompt before showing error. |
| Deliverable tab showing nothing while agent is working | Empty white space for minutes | Show a "In progress..." state with the build log visible by default. Switch to deliverable tab automatically when `primaryFile` appears in the manifest. |

## "Looks Done But Isn't" Checklist

- [ ] **Worker loop:** Often missing stale-run recovery. Verify: after process restart, orphaned task_runs (status=running, heartbeat > 2 min old) are detected and reset to "submitted" for retry.
- [ ] **SSE endpoint:** Often missing reconnection handling. Verify: client reconnects after network blip and receives missed events (use `Last-Event-ID` header and event ID tracking).
- [ ] **invokeAgent wrapper:** Often missing abort/timeout handling. Verify: when `maxBudgetUsd` is exceeded, the query returns `error_max_budget_usd` result and the task transitions to `input-required` (not silently dropped).
- [ ] **FTS5 search:** Often missing UPDATE/DELETE sync. Verify: when a document is updated, the old content is removed from FTS5 and new content is indexed. Test: update a document, search for old-only content, expect 0 results.
- [ ] **Task workspace cleanup:** Often missing cleanup after completion. Verify: completed task desks are archived or cleaned up to prevent unbounded disk growth. But don't clean up too eagerly -- deliverables must survive.
- [ ] **CLAUDE.md generation:** Often missing dynamic context. Verify: the generated CLAUDE.md in each desk includes the task description, agent identity, department context, and available skill descriptions -- not just a static template.
- [ ] **Graceful shutdown:** Often missing entirely. Verify: SIGTERM triggers worker drain (finish current task_run, don't pick up new ones), SSE connection closure, and Prisma disconnect.
- [ ] **Error retry with backoff:** Often missing jitter. Verify: the 2s/4s/8s retry for LLM 503 includes randomized jitter (e.g., 2s +/- 500ms) to avoid thundering herd if multiple agents fail simultaneously.

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Orphaned agent subprocesses | LOW | Kill orphaned processes (`pkill -f claude`), reset their task_runs to submitted, restart worker. Add process tracking to prevent recurrence. |
| Corrupt JSONL chat file | MEDIUM | Parse line-by-line, skip corrupt lines, rebuild. Lost messages are unrecoverable but the task can continue from the last valid state. |
| FTS5 index out of sync | LOW | Drop and recreate the FTS5 table, rebuild index from source tables. Add verification cron. |
| WAL file bloated (>500MB) | LOW | Run `PRAGMA wal_checkpoint(TRUNCATE);` during a maintenance window (brief write lock). Investigate what prevented auto-checkpoint. |
| Session files corrupted or missing | MEDIUM | Task can't resume. Create a fresh session with context from the task description and last known state. Lost agent memory of previous tool use. |
| Tool context leaked between agents | HIGH | Audit all completed tasks for cross-contamination. Reset affected agent memories. Rewrite MCP server factory to use proper closures. |
| Path traversal exploited | HIGH | Audit access logs for suspicious paths. Patch the endpoint immediately. Review all file-serving routes. No data loss but potential information disclosure. |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Subprocess lifecycle (Pitfall 1) | Foundation | Worker loop stress test: run 4 concurrent agents, verify process count stays bounded, all processes exit cleanly |
| Session ID + CWD coupling (Pitfall 2) | Foundation | Resume test: create task, execute partially, resume, verify context is preserved. Test with different cwd values. |
| instrumentation.ts misuse (Pitfall 3) | Foundation | Startup test: verify server starts within 5 seconds, worker loop runs, HMR doesn't spawn duplicate workers |
| SQLite WAL contention (Pitfall 4) | Foundation | Concurrency test: 10 parallel write operations, verify 0 SQLITE_BUSY errors with busy_timeout configured |
| SSE connection leaks (Pitfall 5) | Cortex UI | Load test: open 5 tabs, close 3, verify listener count equals 2. Run for 30 minutes, verify stable memory. |
| Filesystem concurrency (Pitfall 6) | Foundation + A2A/Tools | Concurrent write test: two agents write to adjacent files, verify no corruption. Path traversal test: request `../../etc/passwd`, verify 403. |
| Structured output for routing (Pitfall 7) | A2A Protocol | Routing benchmark: 20 routing decisions, verify median latency < 10 seconds, 0 retry failures |
| A2A state machine races (Pitfall 8) | A2A Protocol | Concurrent transition test: fire `complete` and `cancel` simultaneously, verify exactly one succeeds and state is consistent |
| FTS5 + Prisma migration (Pitfall 9) | Foundation | Migration test: run `prisma migrate deploy` on fresh DB, verify FTS5 tables exist and search works |
| MCP tool context isolation (Pitfall 10) | A2A/Tools | Isolation test: two concurrent agents with different taskIds, verify each tool call operates on correct task's files |

## Sources

- Claude Agent SDK official documentation (platform.claude.com/docs/en/agent-sdk/*) -- verified 2026-03-25. Session management, structured outputs, MCP servers, TypeScript API reference.
- SQLite WAL mode documentation (sqlite.org/wal.html) -- verified 2026-03-25. Single-writer constraint, checkpoint behavior, SQLITE_BUSY conditions.
- Next.js instrumentation documentation (nextjs.org/docs/app/api-reference/file-conventions/instrumentation) -- verified 2026-03-25. register() lifecycle, runtime targeting.
- Next.js custom server documentation (nextjs.org/docs/app/guides/custom-server) -- verified 2026-03-25. Programmatic server startup, limitations.
- Prisma SQLite documentation (prisma.io/docs/orm/overview/databases/sqlite) -- verified 2026-03-25. Connection handling, WAL considerations.
- Prisma raw queries documentation (prisma.io/docs/orm/prisma-client/using-raw-sql/raw-queries) -- verified 2026-03-25. Template limitations, $queryRawUnsafe usage.
- Node.js EventEmitter documentation -- established patterns for listener management and memory leak prevention.
- Node.js filesystem documentation -- established patterns for atomic file operations and path security.

---
*Pitfalls research for: TypeScript AI Agent Operating System (Myelin v10 -- The Cortex)*
*Researched: 2026-03-25*
