# Cortex -- AI Company Operating System

**Your entire company, running autonomously.**

Cortex is a TypeScript/Next.js operating system that turns a solo founder into a fully staffed company. A Chief of Staff (Tamir), CTO, CMO, COO, and dynamically hired temporary employees work together as real agents -- not chatbots, but autonomous workers who research, write code, deploy, create content, and deliver results. You interact through a web dashboard called The Cortex, and the agents handle everything else.

Think of it as hiring an entire team that lives inside your terminal. Each agent has a soul (personality and expertise), a desk (workspace with tools and files), a memory, and accountability. Tasks flow through planning, approval, execution, supervisor review, and delivery -- just like a real company.

## What makes this different

- **Agents actually do the work.** They write real code, call real APIs, and produce real deliverables -- not just text suggestions.
- **Company hierarchy matters.** There are departments, reporting lines, budgets, and escalation paths. The Chief of Staff routes your requests to the right department head, who plans with you before executing.
- **Everything is visible.** Watch agents work in real time through build logs, activity feeds, and an interactive org graph. Take over any agent's session if you want to steer.
- **Skills grow over time.** Agents learn from past tasks, install new tools from external registries, and share knowledge across the organization.

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

The fastest way to get started is the setup script:

```bash
./setup.sh
```

It checks prerequisites, installs dependencies, configures `.env`, initializes the database, creates runtime directories, and sets up your company DNA template. You will be up and running in under a minute.

### Manual setup

If you prefer to do things step by step:

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

On first startup, the server seeds agent employees (Tamir, CTO, CMO, COO), creates planning desks, and starts the background worker loop. You are ready to send your first task.

## Company DNA

Your agents need to know about your company to do useful work. Edit `data/vault/company-dna.md` to describe your company -- its name, mission, target customers, and anything else your team should know. The setup script copies a starter template; fill it in and your agents will reference it in every task they work on.

The template lives at `config/company-dna.template.md`. You can re-copy it at any time to start fresh.

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

## Design Documents

The `docs/` directory contains the full design specification for Cortex. If you want to understand how everything fits together -- or you are about to contribute -- start here.

| Document | Description |
|----------|-------------|
| [00 - Vision & Product Background](docs/00_VISION_PRODUCT_BACKGROUND.md) | Why Cortex exists, the problem it solves, and the product vision |
| [01 - System Architecture](docs/01_SYSTEM_ARCHITECTURE.md) | High-level architecture, the four subsystems, and data flow |
| [02 - Agent System](docs/02_AGENT_SYSTEM.md) | Agent definitions, souls, agent cards, and the SDK-first execution model |
| [03 - A2A Protocol](docs/03_A2A_PROTOCOL.md) | Agent-to-agent communication using Google's A2A data model |
| [04 - Database Schema](docs/04_DATABASE_SCHEMA.md) | SQLite schema via Prisma, models, relationships, and FTS5 search |
| [05 - Cortex UI](docs/05_CORTEX_UI.md) | Dashboard layout, pages, components, and real-time activity views |
| [06 - Tamir Interface](docs/06_TAMIR_INTERFACE.md) | Chief of Staff chat interface, plan mode, and the tool/skill gallery |
| [07 - Deliverable & Workspace](docs/07_DELIVERABLE_WORKSPACE.md) | Task execution workspaces, build logs, file browser, and deliverable review |
| [08 - Tools, Skills & MCP](docs/08_TOOLS_SKILLS_MCP.md) | Custom tools, reusable skills, MCP servers, and external tool discovery |
| [09 - Task Scenarios](docs/09_TASK_SCENARIOS.md) | Six end-to-end walkthroughs showing exactly how tasks flow through the system |
| [10 - Configuration & Deployment](docs/10_CONFIGURATION_DEPLOYMENT.md) | Environment setup, LLM provider options, secrets, and deployment |
| [11 - Build Plan](docs/11_BUILD_PLAN.md) | Development phases, task dependencies, and build sequence |
| [12 - Visual Guidelines](docs/12_VISUAL_GUIDELINES.md) | CSS design system, color palette, typography, and component styles |
| [13 - Assets System](docs/13_ASSETS_SYSTEM.md) | Company-level asset tracking, dependencies, lifecycle, and promotion |

## How It Works

1. **You send a task** via the dashboard -- anything from "build a landing page" to "research competitor pricing"
2. **Tamir routes it** to the right department head based on what the task needs
3. **You plan together** -- the department head asks clarifying questions and drafts a plan in a multi-turn conversation
4. **You approve the plan** and the task enters the execution queue
5. **The agent works** in a sandboxed workspace with full tool access, producing real files and deliverables
6. **Results appear** in the deliverables view where you can review, chat with the agent, and request follow-ups

The whole flow -- from idea to deliverable -- happens without leaving the dashboard.

## License

Proprietary. All rights reserved.
