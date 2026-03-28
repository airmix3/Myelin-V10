# Myelin v10 -- The Cortex

A TypeScript/Next.js operating system for running a one-person company with autonomous AI agents. Agents (Chief of Staff, CTO, CMO, COO, and dynamically hired temps) execute real business tasks end-to-end: research, code, deployment, content, analysis. The CEO interacts through The Cortex -- a web dashboard -- and the agents do the work.

This is not a chatbot. It is a functioning company with hierarchy, budgets, skills, deliverables, task state machines, and accountability. Every task flows through planning, approval, execution, supervisor review, and delivery.

## Platform

- **Runtime:** Node.js 20+ (persistent, self-hosted -- not serverless)
- **OS:** Linux, macOS, WSL2
- **LLM:** Claude via Anthropic API or AWS Bedrock
- **Database:** SQLite (local file, no external services)

## Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript (strict mode) |
| Agent Engine | @anthropic-ai/claude-agent-sdk |
| ORM | Prisma 7 + better-sqlite3 |
| Search | SQLite FTS5 |
| Styling | Custom CSS variables (no frameworks) |
| Package Manager | pnpm |

## Installation

```bash
git clone <repo-url> myelin-v10
cd myelin-v10
pnpm install
```

### Configure environment

Copy `.env.example` to `.env` (or create `.env`) and set your LLM provider:

```bash
# Option A: Anthropic API directly
ANTHROPIC_API_KEY=sk-ant-...

# Option B: AWS Bedrock
CLAUDE_CODE_USE_BEDROCK=1
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=us-east-1
```

Set the path to the Claude Code binary (required by the Agent SDK):

```bash
CLAUDE_CODE_PATH=/path/to/claude
```

### Initialize database

```bash
npx prisma migrate deploy
```

### Run

```bash
pnpm dev
```

The Cortex dashboard will be available at `http://localhost:3000`.

On first startup, the server seeds agent employees (Tamir, CTO, CMO, COO), creates planning desks, and starts the background worker loop.

## Project Structure

```
src/
  agents/          Agent definitions (soul.md, agent.ts, card.json)
  app/             Next.js pages and API routes
  lib/             Core libraries (worker, orchestrator, state machine, MCP tools)
  a2a/             A2A protocol types
  components/      React components (dashboard, workspace, gallery)
data/
  vault/           Company knowledge vault (persisted)
  departments/     Department desks, skills, tools
  workspaces/      Task execution workspaces (gitignored, created at runtime)
config/
  company-dna.template.md   Company DNA template
prisma/
  schema.prisma    Database schema
docs/              Design documents (architecture, protocol specs, build plan)
```

## How It Works

1. CEO sends a task via the dashboard
2. Tamir (Chief of Staff) routes it to the right department head
3. Department head plans the task with the CEO (multi-turn conversation)
4. CEO approves the plan
5. Worker picks up the task and invokes the agent with full tool access
6. Agent executes in a sandboxed workspace, producing real deliverables
7. Results appear in the deliverables view with follow-up chat

## License

Proprietary. All rights reserved.
