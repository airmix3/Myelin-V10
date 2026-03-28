# 10 -- Configuration, Secrets & Deployment

## LLM Provider Configuration

The Claude Agent SDK handles ALL LLM provider selection via environment variables. **There is ZERO provider-specific code in Myelin.** The SDK reads these env vars and routes to the right provider automatically. You pick ONE provider and set its env vars.

### Option A: Anthropic API Key (Direct)
```bash
ANTHROPIC_API_KEY=sk-ant-...
```
Simplest setup. Direct to Anthropic's API.

### Option B: AWS Bedrock
```bash
CLAUDE_CODE_USE_BEDROCK=1
AWS_ACCESS_KEY_ID=YOUR_AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY=YOUR_AWS_SECRET_ACCESS_KEY
AWS_DEFAULT_REGION=us-east-1
```
Uses your existing AWS infrastructure. See: https://code.claude.com/docs/en/amazon-bedrock

### Option C: Google Vertex AI
```bash
CLAUDE_CODE_USE_VERTEX=1
GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
ANTHROPIC_VERTEX_PROJECT_ID=your-gcp-project
CLOUD_ML_REGION=us-east5
```
See: https://code.claude.com/docs/en/google-vertex-ai

### Option D: Azure AI Foundry
```bash
CLAUDE_CODE_USE_FOUNDRY=1
# Azure credentials configured via Azure CLI or env vars
```
See: https://code.claude.com/docs/en/azure-ai-foundry

**IMPORTANT**: The Agent SDK `query()` function reads these env vars automatically. Our code NEVER instantiates an Anthropic client, NEVER specifies a model ID, NEVER has provider-specific logic. The SDK handles it all. If you want to switch from Bedrock to direct API, change the env vars and restart. Zero code changes.

## Environment Variables (.env)

```bash
# ── LLM Provider (pick ONE section, comment out the rest) ──

# Option A: Direct Anthropic API
# ANTHROPIC_API_KEY=sk-ant-...

# Option B: AWS Bedrock (current setup)
CLAUDE_CODE_USE_BEDROCK=1
AWS_ACCESS_KEY_ID=YOUR_AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY=YOUR_AWS_SECRET_ACCESS_KEY
AWS_DEFAULT_REGION=us-east-1

# Option C: Google Vertex AI
# CLAUDE_CODE_USE_VERTEX=1
# GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
# ANTHROPIC_VERTEX_PROJECT_ID=your-project
# CLOUD_ML_REGION=us-east5

# ── Paths ──
DATABASE_URL=file:./data/myelin.db
# No global DELIVERABLES_PATH in v10.
# Deliverables live per task at data/departments/{dept}/tasks/{slug}/deliverables/
AGENTS_DATA_PATH=./data/agents
DEPARTMENTS_PATH=./data/departments

# ── API ──
MYELIN_API_TOKEN=YOUR_LONG_RANDOM_API_TOKEN
CORTEX_BASE_URL=http://localhost:3000

```

**NEVER commit .env to git.** Add to .gitignore.

## First Boot / Startup Sequence

There is no onboarding wizard. The system is pre-configured for Myelin (the company). On first boot, follow this numbered checklist:

1. Run `pnpm prisma migrate deploy` (or `db push`) to create/update the SQLite database
2. Run `pnpm prisma db seed` to seed the 4 executive employees
3. If `data/vault/company-dna.md` does not exist, copy it from the repo-tracked template at `config/company-dna.template.md`
4. Index the vault copy in FTS5
5. Index department knowledge files (`indexDepartmentKnowledge()`)
6. Start the worker loop (claims queued task runs, executes concurrently)
7. Start Tamir cron (every 15 minutes -- invokes Tamir to process inbox and perform autonomous coordination)
8. Start Next.js server: `pnpm dev` (or `pnpm start` for production)

The system is ready to use immediately. No setup UI needed.

## Company DNA

There are two canonical forms:

1. **Repo-tracked template**: `config/company-dna.template.md`
2. **Runtime/searchable copy**: `data/vault/company-dna.md`

The template is version-controlled. The vault copy is what agents search and quote at runtime. Tamir and other agents load relevant excerpts from the vault/search index when needed. Do not inject the entire document into every prompt by default.

Recommended structure:

```markdown
# Company DNA -- Myelin

## Company
- Name: Myelin
- Tagline: The Plaid of Brain Data
- Mission: Secure, privacy-first BCI integration layer for enterprises and developers
- Stage: Pre-seed, 300-day sprint
- Founder: Omer Shalev

## Product
- Name: BDaS -- Brain Data as a Service
- Description: Hardware-agnostic BCI middleware that normalizes EEG/neural data across devices with cryptographic privacy.
- Core stack: Edge compute, differential privacy, Claude Agent SDK, TypeScript/Node.js, EEG signal processing pipeline

## Departments
- Tech: Research, code, ML, infra. Head: CTO.
- Marketing: Content, narrative, devrel, video. Head: CMO.
- Operations: Planning, resource allocation, timelines. Head: COO.

## Brand Voice
- Tone: Technical, precise, developer-friendly, no hype
- Avoid: buzzwords, vague claims, overpromising
- Prefer: specific numbers, real benchmarks, honest tradeoffs

## Governance
- Escalation policy: L0=self-resolve, L1=dept-head, L2=Tamir, L3=Tamir+CEO notify, L4=CEO blocks
- Chain of command strict: true
```

This format is easy for humans to edit, easy to index with FTS, and easy for Tamir to quote during routing.

## Claude Code Runtime Dependency

The Agent SDK is built on the same Claude Code runtime foundation and `query()` launches a Claude Code subprocess under the hood. In deployment, ensure that the Claude Code runtime required by the SDK is available in the environment.

Practical options:

```bash
# Option A: install globally
npm install -g @anthropic-ai/claude-code

# Option B: ensure the runtime is available via your package/deployment tooling
# (for example through the SDK package and standard node module resolution)
```

Global install is acceptable, but the important requirement is: the Claude Code runtime used by the SDK must be present in the environment.

## Agent systemPrompt Configuration

Use the SDK preset format to load CLAUDE.md automatically:

```typescript
systemPrompt: {
  type: 'preset',
  preset: 'claude_code',
  append: agentSoul  // Agent-specific soul prompt appended after CLAUDE.md
}
```

This tells the SDK to load the `CLAUDE.md` from the agent's working directory (desk) as the base system prompt, then append the agent's soul. Do not manually read and inject CLAUDE.md contents.

## Tamir Cron Configuration

Tamir runs on a 15-minute cron cycle to process his inbox and perform autonomous coordination:

```typescript
// Tamir cron -- every 15 minutes
setInterval(async () => {
  await invokeTamirCron();
}, 15 * 60 * 1000);
```

The cron invokes Tamir to: check for pending tasks, follow up on stalled work, brief the CEO on completed items, and perform any autonomous coordination tasks.

## Directory Structure

```
myelin-v10/
  .env                         # Secrets (gitignored)
  .gitignore
  package.json
  tsconfig.json
  next.config.js
  config/
    company-dna.template.md      # Repo-tracked Company DNA template
  prisma/
    schema.prisma
    seed.ts
  src/
    agents/                    # Each agent = self-contained directory
      tamir/                   #   agent.ts + soul.md + card.json
      cto/
      cmo/
      coo/
      types.ts                 # AgentConfig + tool policy interfaces
      employee.ts              # Temp employee provisioning
      orchestrator.ts          # Singleton, holds all agents
      invoke.ts                # invokeAgent() wrapper around SDK query()
    a2a/                       # A2A types, state machine, consultation
    tools/                     # Custom Myelin tools only (SDK handles native tools)
    skills/                    # Skill loader, registry
    mcp/                       # MCP client
    db/                        # Prisma client, FTS helpers
    config/                    # Config loader
    lib/                       # Shared utilities (markdown, id gen -- no provider code)
  app/                         # Next.js App Router pages (canonical location: root app/)
  data/
    myelin.db                  # SQLite database (single file)
    agents/                    # Per-agent runtime data (memory + sessions)
      tamir/
        MEMORY.md              # Personal memory
      cto/
        MEMORY.md
    departments/               # Department Libraries (see Doc 02)
      tech/
        knowledge/             # Persistent reference docs
        skills/                # Department skills (SKILL.md files)
        planning-desk/         # Dept head planning workspace
        tasks/                 # Per-task directories
          zuna-eval-task_a1b2/
            deliverables/      # CEO-facing outputs (contains deliverable_manifest.json)
            desk/              # Agent sandbox (scripts, drafts, data)
      marketing/
        knowledge/
        skills/
        planning-desk/
        tasks/
      operations/
        knowledge/
        skills/
        planning-desk/
        tasks/
      global/
        skills/                # Cross-department skills
    vault/                     # Company-wide permanent docs
      company-dna.md           # Runtime/searchable Company DNA copy
  public/
    cortex.css                 # Global CSS
```

## Worker Loop & Tamir Cron Startup

The worker loop and Tamir cron are started from Next.js `instrumentation.ts` (App Router server-side initialization hook). This file runs once when the server starts and is the canonical entry point for all background processes:

```typescript
// instrumentation.ts (project root, alongside next.config.js)
export async function register() {
  // Only run on the server, not during build
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { startWorkerLoop } = await import('./src/workers/task-runner');
    const { startTamirCron } = await import('./src/cron/tamir');
    const { initFTS } = await import('./src/db/fts');
    const { prisma } = await import('./src/db');

    await initFTS(prisma);
    startWorkerLoop();
    startTamirCron();
    console.log('Myelin v10 background processes started');
  }
}
```

## Route `maxDuration` (Long API Calls)

Any API route that invokes `query()` (which spawns an SDK subprocess) can take 30-120+ seconds. All such routes **must** export `maxDuration` to prevent Next.js from killing the request early:

```typescript
// Add to ALL routes that invoke agents:
// - app/api/tamir/route/route.ts
// - app/api/tasks/[taskId]/message/route.ts
// - app/api/tasks/[taskId]/approve/route.ts
// - app/api/deliverables/[id]/chat/route.ts
export const maxDuration = 120;  // seconds
```

## Running the System

**Runtime requirement**: v10 assumes a long-lived Node.js server process. Background task execution and the in-process event bus are designed for `pnpm dev`, `pnpm start`, or equivalent self-hosted Node runtimes. Do **not** deploy the v10 task runner on serverless or edge platforms without introducing a separate durable job system first.

### Development

```bash
# Install dependencies
pnpm install

# Generate Prisma client
pnpm prisma generate

# Run database migrations
pnpm prisma db push

# Seed executives
pnpm prisma db seed

# Start development server (Next.js)
pnpm dev
```

### Production

```bash
# Build
pnpm build

# Start
pnpm start
```

### Docker (optional)

```yaml
# docker-compose.yml
version: '3.8'
services:
  myelin:
    build: .
    ports:
      - "3000:3000"
    volumes:
      - ./data:/app/data
      - ./.env:/app/.env
    environment:
      - NODE_ENV=production
  # No external services needed -- SQLite is a local file, agent memory is MEMORY.md files
```

## System Reset Skill

A built-in skill to clear all operational data (keeping vault + company DNA):

```typescript
// src/skills/system-reset.ts
export async function systemReset() {
  // Delete in dependency order (child tables first)
  const tables = [
    'task_runs', 'cost_events', 'activity_log', 'hire_requests',
    'deliverables', 'tasks',
  ];

  for (const table of tables) {
    await prisma.$executeRawUnsafe(`DELETE FROM ${table}`);
  }

  // Keep vault docs, delete everything else
  await prisma.document.deleteMany({ where: { NOT: { source: 'vault' } } });

  // Reset budgets
  await prisma.employee.updateMany({ data: { spentMonthlyCents: 0 } });

  // Terminate temp employees
  await prisma.employee.updateMany({
    where: { type: 'temp' },
    data: { status: 'terminated' },
  });

  return { status: 'reset_complete', vault_preserved: true };
}
```

## Monitoring

- **Activity Log**: Every agent action stored with timestamp, type, metadata
- **Cost Events**: Every LLM call tracked (input/output tokens, cost in cents)
- **Build Log**: Real-time view in deliverable workspace (auto-refresh)
- **Console**: Structured JSON logs via pino
- **Cortex UI**: Build log + SSE events show completions, errors, hire requests in real-time
