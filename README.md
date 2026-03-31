# Cortex -- AI Company Operating System

A TypeScript/Next.js operating system for running a one-person company with autonomous AI agents. Agents (Chief of Staff, CTO, CMO, COO, and dynamically hired temps) execute real business tasks end-to-end: research, code, deployment, content, analysis. The CEO interacts through The Cortex -- a web dashboard -- and the agents do the work.

This is not a chatbot. It is a functioning company with hierarchy, budgets, skills, deliverables, task state machines, and accountability. Every task flows through planning, approval, execution, supervisor review, and delivery.

## Requirements

### Required

| Dependency | Version | Purpose |
|-----------|---------|---------|
| Node.js | 20+ | Runtime |
| pnpm | 10+ | Package manager |
| Claude Code | latest | Agent SDK runtime (`@anthropic-ai/claude-agent-sdk` spawns Claude Code subprocesses) |

Claude Code must be installed and accessible. Set `CLAUDE_CODE_PATH` in `.env` to the binary path, or ensure `claude` is on your `PATH`.

### LLM Provider (one required)

| Provider | Env vars needed |
|----------|----------------|
| Anthropic API | `ANTHROPIC_API_KEY` |
| AWS Bedrock | `CLAUDE_CODE_USE_BEDROCK=1`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION` |
| Claude OAuth | Log in via `claude` CLI -- no env vars needed |

### Optional

| Service | Env vars | Purpose |
|---------|----------|---------|
| Langfuse | `LANGFUSE_PUBLIC_KEY`, `LANGFUSE_SECRET_KEY`, `LANGFUSE_BASE_URL` | Agent observability -- traces, cost tracking, prompt analytics. Free tier at cloud.langfuse.com. Disabled if keys not set. |
| Composio | `COMPOSIO_API_KEY` | Tool gallery search (third-party MCP tool discovery). Disabled if key not set. |

## Platform

- **OS:** Linux, macOS, WSL2
- **Runtime:** Persistent self-hosted Node.js (not serverless, not edge)
- **Database:** SQLite (local file, zero external services)

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

## Setup

Run the setup script from the repo root:

```bash
./setup.sh
```

This will check prerequisites, install dependencies, configure `.env`, initialize the database, create runtime directories, and set up your company DNA template.

### Manual setup

If you prefer to set up manually:

```bash
# 1. Install dependencies
pnpm install

# 2. Create .env from template
cp .env.example .env
# Edit .env with your API keys

# 3. Initialize database
npx prisma migrate deploy

# 4. Set up company DNA
cp config/company-dna.template.md data/vault/company-dna.md
# Edit data/vault/company-dna.md with your company details

# 5. Start
pnpm dev
```

## Quick Start

After setup, start the dev server:

```bash
pnpm dev
```

Visit `http://localhost:3000` to open The Cortex dashboard.

On first startup, the server seeds agent employees (Tamir, CTO, CMO, COO), creates planning desks, and starts the background worker loop.

## Company DNA

Edit `data/vault/company-dna.md` to describe your company. The setup script copies a template -- fill it in with your company name, mission, target customers, and context. This is what your AI agents will know about your business.

The template is at `config/company-dna.template.md`. You can re-copy it at any time to start fresh.

## Project Structure

```
src/
  agents/          Agent definitions (soul.md, agent.ts, card.json)
  app/             Next.js pages and API routes
  lib/             Core libraries (worker, orchestrator, state machine, MCP tools)
  a2a/             A2A protocol types
  components/      React components (dashboard, workspace, gallery)
data/              Runtime data (gitignored -- created by setup.sh)
  vault/           Company knowledge vault
  departments/     Department desks, skills, tools
  workspaces/      Task execution workspaces
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
