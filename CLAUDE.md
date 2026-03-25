<!-- GSD:project-start source:PROJECT.md -->
## Project

**Myelin v10 — The Cortex**

Myelin v10 is a TypeScript/Next.js "one-man company" operating system for Omer Shalev, sole founder of Myelin (a neurotech startup building BDaS — Brain Data as a Service). It is a system of autonomous AI agents (Tamir as Chief of Staff, CTO, CMO, COO, and dynamically hired temp employees) that execute real business tasks end-to-end: research, code, deployment, content, analysis. The CEO interacts through The Cortex — a web dashboard at localhost:3000 — and the agents do the work.

This is NOT a chatbot. It is a functioning company with hierarchy, budgets, skills, deliverables, task state machines, and accountability. Every task flows through planning (CEO <-> dept head), approval, execution (agent in a sandboxed desk), supervisor review, and delivery.

**Core Value:** Agents actually execute real business tasks end-to-end — write and run real code, call real APIs, produce real deliverables — not just generate text. If everything else fails, this must work.

### Constraints

- **Tech Stack**: TypeScript/Node.js only — no Python in the application layer (agents may run Python scripts via SDK bash tool in their desk)
- **CSS**: Custom CSS variables only — no Tailwind, no Bootstrap, no CSS frameworks
- **LLM Provider**: AWS Bedrock via CLAUDE_CODE_USE_BEDROCK=1 initially
- **Runtime**: Persistent self-hosted Node.js only — not designed for serverless or edge runtimes
- **Database**: SQLite (local file, no external services required) via Prisma
- **A2A States**: Standard A2A states only — submitted, working, input-required, completed, failed, canceled. No custom states.
- **SDK First**: Use Claude Agent SDK built-ins before any custom implementation
<!-- GSD:project-end -->

<!-- GSD:stack-start source:research/STACK.md -->
## Technology Stack

## Recommended Stack
### Core Technologies
| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Next.js | 14.2.35 | Full-stack framework (SSR + API routes) | App Router gives unified server/client architecture. v14 is the stable LTS choice -- v15 exists but v14 is explicitly specified in PROJECT.md and battle-tested. API routes serve SSE, Tamir chat, and all internal endpoints without a separate server. |
| @anthropic-ai/claude-agent-sdk | 0.2.83 | Agent execution engine | Official Anthropic SDK for building autonomous agents. Provides `query()` with tool loop, session resume, cost tracking, MCP server integration, structured output, and subagent provisioning. This IS the agent runtime -- no custom agent loop needed. |
| @anthropic-ai/sdk | 0.80.0 | Anthropic API client (underlying) | Direct API access for cases where the Agent SDK delegates to the base SDK (e.g., structured output with `outputFormat`). The Agent SDK uses this internally; having it as explicit dependency ensures version alignment. |
| Prisma | 7.5.0 | ORM + schema management + migrations | Type-safe database access with migration system. The `@prisma/adapter-better-sqlite3` driver adapter enables using better-sqlite3 as the underlying SQLite driver for performance (WAL mode, FTS5 raw queries). |
| better-sqlite3 | 12.8.0 | SQLite driver (direct access) | Synchronous SQLite binding for Node.js. Required for FTS5 virtual tables + sync triggers (Prisma cannot create FTS5 tables or triggers -- these need raw SQL via better-sqlite3). Also used for the `@prisma/adapter-better-sqlite3` driver adapter. |
| TypeScript | 6.0.2 | Language | Strict mode mandatory. TS 6.0 is current stable with improved type narrowing and performance. |
| pnpm | latest | Package manager | Specified in PROJECT.md. Strict dependency resolution, fast installs, disk-efficient via hard links. |
### A2A Protocol + MCP
| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| @a2a-js/sdk | 0.3.13 | A2A protocol type definitions and utilities | Official Google-maintained A2A SDK. Use for AgentCard, A2ATask, A2AMessage, and TaskState type definitions. v10 uses internal function calls (not HTTP transport), so use this primarily for types and state machine patterns, not the full server/client. |
| @modelcontextprotocol/sdk | 1.28.0 | MCP server implementation | Official MCP SDK for creating the single in-process MCP server that exposes all custom Myelin tools (read_memory, write_memory, promote_to_deliverable, etc.). The Agent SDK consumes MCP servers natively. |
| zod | 4.3.6 | Schema validation + structured output | Required peer dependency of @anthropic-ai/claude-agent-sdk (^4.0.0). Used for all API input validation, SDK structured output schemas (outputFormat), A2A task configs, and tool parameter definitions. Zod v4 is a major rewrite -- do NOT use v3 patterns. |
### Content Processing
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| gray-matter | 4.0.3 | Frontmatter parsing for markdown files | Parsing soul.md, MEMORY.md, vault documents, skill definitions -- any markdown file with YAML frontmatter metadata. |
| marked | 17.0.5 | Markdown to HTML rendering | Server-side rendering of markdown content in the Cortex UI (vault docs, deliverables, MEMORY.md display, plan canvas). Fast, zero-dependency, supports GFM. |
### Infrastructure
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| pino | 10.3.1 | Structured JSON logging | All application logging. Structured JSON format enables querying logs. Use `pino.child()` for per-agent/per-task log contexts. |
| proper-lockfile | 4.1.2 | Filesystem locking | Concurrent access to JSONL chat files, MEMORY.md writes, deliverable_manifest.json updates. Prevents data corruption when multiple agent runs write to the same file. |
| node-cron | 4.2.1 | Cron scheduling | Tamir's 15-minute cron invocation. Lightweight, no external dependencies. Started in `instrumentation.ts`. |
### Development Tools
| Tool | Version | Purpose | Notes |
|------|---------|---------|-------|
| vitest | 4.1.1 | Test framework | Fast, native ESM support, compatible with Next.js. Use for unit tests of agent logic, tool implementations, state machine transitions, routing. |
| pino-pretty | 13.1.3 | Dev log formatting | Dev-only. Pipes pino JSON output to human-readable format. Use via `pino({ transport: { target: 'pino-pretty' } })` in development only. |
| @types/better-sqlite3 | 7.6.13 | TypeScript types for better-sqlite3 | Dev dependency. Provides type safety for raw SQL operations (FTS5, triggers). |
| @types/node | 22.x | Node.js type definitions | Pin to Node 22 LTS types to match runtime. Do not use @types/node@25 unless running Node 25. |
## Installation
# Core framework
# AI + Agent
# Database
# Protocol + Validation
# Content processing
# Infrastructure
# Dev dependencies
## Alternatives Considered
| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| Next.js 14 | Next.js 15 | Never for this project. v14 is explicitly specified. v15 has breaking changes in async request APIs and caching defaults that add migration overhead with zero benefit for a self-hosted single-user app. |
| better-sqlite3 | libsql / Turso | If you needed edge deployment or replication. For persistent self-hosted Node.js, better-sqlite3 is simpler and faster. |
| Prisma + better-sqlite3 | Drizzle ORM | If you wanted thinner ORM overhead. Prisma wins here because its migration system and type generation are more mature, and the driver adapter pattern (`@prisma/adapter-better-sqlite3`) gives raw SQLite access when needed (FTS5). |
| marked | unified/remark | If you needed AST manipulation of markdown (plugins, custom transforms). marked is faster for simple HTML rendering which is all Cortex needs. |
| pino | winston | Never. Winston is heavier, slower, and its transport system is more complex. Pino's JSON-first design is better for structured logging in a system that needs per-agent log contexts. |
| node-cron | cron (npm) | If you needed timezone-aware cron expressions. node-cron is simpler for the 15-minute interval pattern Tamir needs. |
| proper-lockfile | async-mutex | If locks are in-memory only. proper-lockfile is filesystem-based which survives process restarts and protects across concurrent agent processes. |
| @a2a-js/sdk | Custom A2A types | If the SDK adds unwanted transport complexity. Since v10 uses internal function calls only (not HTTP A2A), you may extract just the type definitions from @a2a-js/sdk and skip the server/client runtime. Evaluate at implementation time. |
| vitest | jest | Never. Jest has slower startup, worse ESM support, and requires more configuration for TypeScript projects. Vitest is the standard for modern TS projects. |
## What NOT to Use
| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Tailwind CSS | Explicitly banned in PROJECT.md constraints. Custom CSS variables design system in `public/cortex.css`. | Custom CSS with CSS variables, as specified. |
| Bootstrap / any CSS framework | Same constraint. Single-user localhost app does not need a component library. | Hand-written CSS with the cortex.css design system. |
| Express / Fastify | Next.js API routes handle all HTTP endpoints. A separate server adds deployment complexity and splits routing logic. | Next.js Route Handlers in `app/api/`. |
| Sequelize / TypeORM | Inferior TypeScript support compared to Prisma. Sequelize has poor TS types; TypeORM's decorator pattern is fragile. | Prisma with better-sqlite3 driver adapter. |
| chromadb / mem0 / any vector DB | Explicitly out of scope (PROJECT.md). SQLite FTS5 is sufficient for single-user full-text search. | SQLite FTS5 via better-sqlite3 raw SQL. |
| Socket.IO / ws | Overkill for unidirectional server-to-client updates. SSE is simpler, works with Next.js API routes, no WebSocket upgrade needed. | Server-Sent Events (SSE) via standard Response streaming in Route Handlers. |
| zod v3.x | The Claude Agent SDK requires zod ^4.0.0 as a peer dependency. Zod v4 is a major rewrite with different API patterns (z.string() still works, but advanced features changed). Mixing v3 and v4 will cause runtime errors. | zod@4.3.6 exclusively. |
| dotenv | Next.js has built-in `.env` file loading. Adding dotenv creates duplicate env loading and potential conflicts. | Next.js built-in `.env` / `.env.local` support. |
| Docker | Explicitly out of scope. Persistent self-hosted Node.js only. Docker adds complexity with no benefit for a single-machine dev tool. | Direct `node` / `pnpm dev` execution. |
| React state management (Redux, Zustand, Jotai) | The Cortex UI is primarily server-rendered with SSE for live updates. Client state is minimal (chat input, tab selection). Adding a state management library is overengineering. | React `useState` + `useRef` for local UI state. SSE `EventSource` for live data. Server Components for initial data loading. |
## Stack Patterns by Variant
- Use better-sqlite3 directly (not Prisma) because Prisma cannot create FTS5 virtual tables, triggers, or use `MATCH` syntax
- Wrap in a dedicated `fts.ts` module that initializes FTS5 tables on startup and exposes `search(query)` functions
- Prisma handles all CRUD; better-sqlite3 handles all FTS5
- Use Next.js Route Handler with `ReadableStream` and `TextEncoder`
- Return `new Response(stream, { headers: { 'Content-Type': 'text/event-stream' } })`
- No external SSE library needed -- native Web Streams API is sufficient
- Always go through `invokeAgent()` wrapper that calls Agent SDK `query()`
- Never call the Anthropic API directly -- the Agent SDK handles the tool loop, MCP server connections, session management, and cost tracking
- AWS Bedrock is configured via environment variables (`CLAUDE_CODE_USE_BEDROCK=1`) -- zero provider-specific code
- Use Agent SDK's `outputFormat` with zod schemas
- This gives type-safe JSON responses for Tamir's routing decisions and planning turn classification
- Never parse LLM output with regex
## Version Compatibility
| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| @anthropic-ai/claude-agent-sdk@0.2.83 | zod@^4.0.0 | Peer dependency -- MUST use zod v4. Will fail with zod v3. |
| prisma@7.5.0 | @prisma/client@7.5.0 + @prisma/adapter-better-sqlite3@7.5.0 | All three must be same version. Mismatched Prisma package versions cause cryptic runtime errors. |
| @prisma/adapter-better-sqlite3@7.5.0 | better-sqlite3@^11.0.0 \|\| ^12.0.0 | Verify adapter supports better-sqlite3 v12 at install time. |
| next@14.2.35 | react@18.x, react-dom@18.x | Next.js 14 uses React 18. Do NOT install React 19 -- it requires Next.js 15. |
| next@14.2.35 | typescript@^5.0.0 \|\| ^6.0.0 | Verify Next.js 14.2.35 supports TS 6. If issues arise, pin to typescript@5.8.x. |
| vitest@4.1.1 | typescript@^5.0.0 \|\| ^6.0.0 | Should work with TS 6. Verify at install time. |
| @types/node@22.x | Node.js 22 LTS | Match types to your runtime Node.js version. |
## Critical Notes
### Zod v3 to v4 Migration
- `z.object().strict()` is now the default (use `.passthrough()` for loose objects)
- `z.infer<>` still works but some advanced patterns changed
- `z.enum()` behavior differs for string enums
- Since this is greenfield, write all schemas in zod v4 patterns from day one. Do not copy zod v3 examples from older tutorials.
### Prisma + better-sqlite3 Dual Access Pattern
### Claude Agent SDK is NOT claude-code-sdk
## Sources
- npm registry (direct `npm view` queries, 2026-03-25) -- all version numbers verified against live registry [HIGH confidence]
- @anthropic-ai/claude-agent-sdk npm page -- confirmed package name, version 0.2.83, peer dependency on zod ^4.0.0 [HIGH confidence]
- @a2a-js/sdk npm page -- confirmed as official Google-maintained A2A SDK, v0.3.13 [HIGH confidence]
- PROJECT.md constraints -- technology decisions and explicit exclusions [HIGH confidence]
- Next.js 14 + Prisma + better-sqlite3 stack pattern -- well-established in 2025-2026 TypeScript ecosystem [HIGH confidence]
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

Conventions not yet established. Will populate as patterns emerge during development.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

Architecture not yet mapped. Follow existing patterns found in the codebase.
<!-- GSD:architecture-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd:quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd:debug` for investigation and bug fixing
- `/gsd:execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->



<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd:profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
