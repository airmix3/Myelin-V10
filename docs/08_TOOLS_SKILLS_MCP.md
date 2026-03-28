# 08 -- Tools, Skills, MCP & External Search

## Overview

Agents in Myelin v10 have three kinds of capabilities:
1. **Tools** -- Native SDK capabilities (code execution, file ops, web) + custom Myelin tools for company resources
2. **Skills** -- Reusable knowledge/procedures stored as SKILL.md files (learned from past tasks)
3. **MCP Servers** -- External tool providers connected via Model Context Protocol

The CEO can also hint tools and skills during plan mode via the gallery UI (see Doc 06).

## Tools: Two Categories

### Principle

Agents have TWO kinds of tools:

1. **Native SDK tools** -- Claude Agent SDK's built-in capabilities. The agent uses these freely to think and work. We do NOT wrap these in custom tools.
2. **Custom Myelin tools** -- Company-specific tools for accessing shared resources with access control and policy enforcement. In the SDK, these are exposed through an **in-process MCP server** created with `tool()` + `createSdkMcpServer()`.

## Built-In First Policy

Before adding any new Myelin abstraction, ask:

1. Can the Claude Agent SDK already do this with built-in tools?
2. Can it be solved with `settingSources`, skills, hooks, permissions, subagents, or MCP?
3. Is the only missing part Myelin-specific policy or access control?

If the answer to 1 or 2 is yes, use the SDK feature. Only create new Myelin code when the behavior is specific to company resources or business workflow.

### Native SDK Tools (Built-In -- NOT custom implementations)

The Claude Agent SDK provides these natively. Agents use them automatically when their session runs. **For the starter version, all native SDK tools are available to all agents** (no per-role restrictions yet).

| Capability | How | Notes |
|-----------|-----|-------|
| Code execution | SDK built-in (runs in desk CWD) | Python, shell, Node -- agent writes and runs freely |
| File read/write/list | SDK built-in (scoped to desk CWD) | Agent has full filesystem access within its desk |
| Web fetch | SDK built-in | Agent can browse URLs, download data |
| Search | SDK built-in | Web search via agent's native capabilities |

**Why native, not custom?** Because Claude's built-in tool loop handles multi-step reasoning: write code -> run it -> read error -> fix -> rerun. A custom `python_exec` tool would be a single-shot call that loses this iterative capability. The agent should work in its desk exactly like Claude Code works in your project directory.

Other built-in SDK capabilities we should prefer instead of reimplementing:

- **Skills** for reusable procedures and specialized guidance
- **Hooks** for intercepting or constraining tool execution
- **Permissions** for approval policy
- **Subagents** for isolated delegated work
- **MCP** for external service/tool integration

```typescript
// query() configuration uses THREE separate concepts:
// 1. tools        -> built-in SDK tools visible in Claude's context
// 2. mcpServers   -> custom Myelin tools + external MCP servers
// 3. allowedTools -> pre-approves tool execution
query({
  prompt,
  options: {
    cwd: taskPaths.desk,
    tools: ['Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep', 'WebSearch', 'WebFetch', 'Skill'],
    mcpServers: { myelin: myelinServer },
    allowedTools: [
      'Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep', 'WebSearch', 'WebFetch', 'Skill',
      'mcp__myelin__read_memory',
      'mcp__myelin__search_knowledge'
    ]
  }
});
```

### Canonical SDK Registration Model

Myelin custom tools must be defined and registered like this:

```typescript
import { tool, createSdkMcpServer } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';

const readMemory = tool(
  'read_memory',
  'Read the agent personal MEMORY.md file.',
  {},
  async () => ({
    content: [{ type: 'text', text: '(memory contents here)' }]
  })
);

const myelinServer = createSdkMcpServer({
  name: 'myelin',
  version: '1.0.0',
  tools: [readMemory]
});
```

When exposed to Claude, that tool's fully qualified name becomes:

```text
mcp__myelin__read_memory
```

That is the name used in `allowedTools`.

### Custom Myelin Tools (Company Resources + Access Control)

These are the ONLY custom tools we define. They exist because they access shared resources outside the agent's CWD and need policy enforcement. Each one is implemented as an SDK `tool()` and mounted on the `myelin` in-process MCP server.

**All tools are registered on a single shared MCP server.** Access control is NOT enforced by building different tool sets per role. Instead, all tools exist on one server, and the SDK's `canUseTool` callback enforces role-based permissions at invocation time (see Access Control below).

| Tool | Restricted To | Purpose | Why Custom? |
|------|-------------|---------|-------------|
| promote_to_deliverable | -- | Copy file from desk to deliverables/ | Writes outside CWD to CEO-visible directory |
| read_inbox | Tamir only | Read and clear `data/agents/tamir/inbox.jsonl`. Returns all pending notification events as text, then truncates the file. | Inbox lives outside desk CWD; Tamir must process notifications into his own MEMORY.md. |
| read_memory | -- | Read personal `MEMORY.md` | Memory lives outside desk CWD; use tool boundary |
| write_memory | -- | Update personal `MEMORY.md` | Memory lives outside desk CWD; use tool boundary |
| read_knowledge | -- | Read from department knowledge library | Shared resource, read access controlled by dept |
| write_knowledge | Dept heads only | Write to department knowledge library + update FTS5 index | Shared resource, only dept heads can modify; keeps search index in sync |
| search_knowledge | -- | FTS5 search across vault + knowledge + past tasks | Queries DB, not filesystem |
| file_to_vault | Tamir, Dept heads | Save document to permanent vault | Company-critical permanent storage |
| consult_agent | CTO, CMO, COO only (NOT temps) | Ask another dept head a question. Wrapper around A2A -- creates a Task, routes message, handles multi-turn via contextId. See Doc 03 for full spec. | A2A cross-department communication. Temp employees cannot use this -- they escalate to their dept head. |
| hire_employee | Dept heads only | Request a temp employee for this task. Creates HireRequest (with taskId), pauses task (`input-required` with `metadata.inputType = 'hire_approval'`). CEO must approve. See Doc 02 for full flow. | Provisioning is orchestrator-level. Agent just requests. |
| submit_for_review | -- | Signal that deliverables are ready for dept head review. Keeps task in `working` state but changes `currentActorId` to the supervisor. | Workflow state transition -- dept head must review before completing. |
| approve_deliverable | Dept heads only | After reviewing employee work, mark task as completed. | Only supervisors can approve. |
| request_changes | Dept heads only | Send deliverable back to employee with feedback. Changes `currentActorId` back to employee. | Only supervisors can reject and request rework. |
| propose_skill | -- | Propose a new skill learned from this task. Creates SKILL.md + supporting files with status: pending. | Everyone can learn. Approval chain: dept head -> CEO. |
| get_dept_status | Tamir | Get department overview | Cross-department visibility |

### Access Control Policy

All custom tools are registered on ONE MCP server. Access control is enforced via the SDK's `canUseTool` callback, which checks the current agent's role at invocation time. This replaces the old pattern of building different tool sets per role.

```typescript
import { tool, createSdkMcpServer } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';

// ALL tools are registered on one server -- no per-role filtering
const myelinServer = createSdkMcpServer({
  name: 'myelin',
  version: '1.0.0',
  tools: [
    readMemory, writeMemory, promoteToDeliverable,
    readKnowledge, writeKnowledge, searchKnowledge,
    fileToVault, consultAgent, hireEmployee,
    submitForReview, approveDeliverable, requestChanges,
    proposeSkill, readInbox, getDeptStatus,
  ]
});

// Access control via canUseTool callback on query()
// Use the buildCanUseTool factory from src/tools/access-control.ts (see Doc 02)
import { buildCanUseTool } from '../tools/access-control';

query({
  prompt,
  options: {
    cwd: taskPaths.desk,
    mcpServers: { myelin: myelinServer },
    // buildCanUseTool returns an async callback matching SDK's CanUseTool type:
    //   (toolName: string, input: unknown) => Promise<{ behavior: 'allow' | 'deny', message?: string }>
    canUseTool: buildCanUseTool(agentId, department),
  }
});
```

**Key policy: Temp employees are sandboxed.** They have full native SDK capabilities within their desk (code, files, web) but cannot modify shared company resources. A temp employee cannot:
- Overwrite department knowledge files
- Write to the vault
- Consult agents in other departments
- Send messages to the CEO directly
- Access files outside their desk CWD

They CAN:
- Read department knowledge (read-only)
- Search all indexed content (FTS5)
- Promote their work to deliverables
- Propose skills (via `propose_skill`)
- Submit work for review (via `submit_for_review`)
- Use all native Claude tools (code, web, files) within their desk

> **Note: Temp employees as SDK subagents.** Temp employees are implemented as SDK subagents (`AgentDefinition`) rather than custom provisioned processes. When a dept head's hire request is approved, the dept head's `query()` call can define inline agents via the SDK's subagent mechanism. This means the temp employee runs within the dept head's agent session as a delegated subagent, inheriting the MCP server but subject to `canUseTool` restrictions based on its own role.

### Tool Definitions

All tool definitions use Zod schemas (required by the SDK `tool()` function) and return the standard `{ content: [{ type: 'text', text: '...' }] }` format.

#### read_inbox

```typescript
import { tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';

const readInbox = tool(
  'read_inbox',
  'Read and clear your notification inbox. Returns all pending task status updates since your last invocation. Call this at the START of every invocation before read_memory.',
  {},
  async () => {
    const inboxPath = join(process.env.AGENTS_DATA_PATH || 'data/agents', 'tamir', 'inbox.jsonl');
    if (!existsSync(inboxPath)) {
      return { content: [{ type: 'text', text: '(no pending notifications)' }] };
    }

    // File-level locking prevents race with system code writing new events
    const { lock } = await import('proper-lockfile');
    const release = await lock(inboxPath, { retries: 3 });
    try {
      const content = readFileSync(inboxPath, 'utf-8').trim();
      if (!content) {
        return { content: [{ type: 'text', text: '(no pending notifications)' }] };
      }
      writeFileSync(inboxPath, ''); // clear after reading
      return { content: [{ type: 'text', text: content }] };
    } finally {
      await release();
    }
  }
);
```

#### hire_employee

```typescript
// NOTE: hire_employee uses the ToolContext factory pattern (see Doc 02).
// ctx.taskId, ctx.agentId, ctx.department are injected via closure.
const hireEmployee = tool(
  'hire_employee',
  'Request a temp employee for this task. Creates a HireRequest with the parent taskId, transitions task to input-required state. CEO must approve.',
  {
    name: z.string().describe('Employee name (e.g. "Dr. Neural")'),
    role: z.string().describe('Role/title for the temp employee (e.g. "EEG Research Analyst")'),
    specialty: z.string().describe('What they specialize in for this task'),
  },
  async (args) => {
    // ctx available via closure from buildMyelinMcpServer(ctx) -- see Doc 02 Tool Context Factory
    const hireId = generateId('hire');
    await db.hireRequest.create({
      data: {
        id: hireId,
        taskId: ctx.taskId,
        department: ctx.department,
        requestedBy: ctx.agentId,
        name: args.name,
        role: args.role,
        specialty: args.specialty,
        status: 'pending',
      }
    });

    // Transition task to input-required with metadata
    await transitionTask(ctx.taskId, 'input-required', {
      message: `Hire request for ${args.name} (${args.role})`,
      metadata: { inputType: 'hire_approval', hireId },
    });

    return {
      content: [{
        type: 'text',
        text: `Hire request for "${args.name}" (${args.role}) created. Task paused as input-required. Awaiting CEO approval.`
      }]
    };
  }
);
```

#### submit_for_review

```typescript
// NOTE: submit_for_review uses the ToolContext factory pattern (see Doc 02).
const submitForReview = tool(
  'submit_for_review',
  'Signal that deliverables are ready for dept head review. Keeps task in working state but changes currentActorId to the supervisor.',
  {
    summary: z.string().describe('Brief summary of what was done and what deliverables to review'),
  },
  async (args) => {
    // ctx available via closure from buildMyelinMcpServer(ctx)
    await db.task.update({
      where: { taskId: ctx.taskId },
      data: { currentActorId: ctx.supervisorAgentId },
    });

    await db.activityLog.create({
      data: {
        agentId: ctx.agentId,
        actionType: 'SUBMITTED_FOR_REVIEW',
        description: `Submitted for review: ${args.summary}`,
        taskId: ctx.taskId,
      }
    });

    return {
      content: [{
        type: 'text',
        text: `Deliverables submitted for review. Task remains in working state; currentActorId changed to ${ctx.supervisorAgentId}.`
      }]
    };
  }
);
```

#### propose_skill

```typescript
const proposeSkill = tool(
  'propose_skill',
  'Propose a new skill learned from this task. Creates a skill directory with SKILL.md and optional supporting files. Status: pending (needs dept head + CEO approval).',
  {
    name: z.string().describe('snake-case skill name (e.g. eeg-electrode-reconstruction)'),
    description: z.string().describe('When should this skill trigger? Be specific about contexts and phrases.'),
    instructions: z.string().describe('Full markdown body for SKILL.md (instructions, steps, examples)'),
    tags: z.string().optional().describe('Comma-separated tags'),
    files: z.record(z.string()).optional().describe('Map of relative-path -> content for supporting files (scripts, templates, data, etc.)'),
  },
  async (args) => {
    const skillDir = join('data/departments', agentDepartment, 'skills', args.name);
    mkdirSync(skillDir, { recursive: true });

    // Write SKILL.md
    const skillMd = [
      '---',
      `name: ${args.name}`,
      `description: ${args.description}`,
      `version: 1`,
      `status: pending`,
      `department: ${agentDepartment}`,
      `created_by: ${agentId}`,
      `proposed_at: ${new Date().toISOString()}`,
      `tags: ${args.tags || ''}`,
      '---',
      '',
      args.instructions,
    ].join('\n');
    writeFileSync(join(skillDir, 'SKILL.md'), skillMd);

    // Write any supporting files (freeform paths)
    if (args.files) {
      for (const [relPath, content] of Object.entries(args.files)) {
        const filePath = join(skillDir, relPath);
        mkdirSync(dirname(filePath), { recursive: true });
        writeFileSync(filePath, content as string);
      }
    }

    // Create DB record as metadata cache (filesystem is source of truth)
    const skillId = `skill_${args.name}`;
    await db.skill.upsert({
      where: { skillId },
      create: {
        skillId,
        name: args.name,
        description: args.description,
        category: 'learned',
        department: agentDepartment,
        createdBy: agentId,
        tags: args.tags || '',
        status: 'pending',
      },
      update: {
        description: args.description,
        tags: args.tags || '',
        status: 'pending',
      },
    });

    await db.activityLog.create({
      data: { agentId, actionType: 'SKILL_PROPOSED', description: `Proposed skill: ${args.name}` }
    });

    return {
      content: [{
        type: 'text',
        text: `Skill "${args.name}" proposed (status: pending). Awaiting dept head review then CEO approval.`
      }]
    };
  }
);
```

## Skills

### What is a Skill?

A skill is a reusable capability that an agent learned from past work. Skills are **directories** (not single files) following the official Anthropic skill format. The SDK discovers them natively from `.claude/skills/` in the agent's CWD.

### Skill Source of Truth: Filesystem First

**Canonical rule**: The filesystem (`data/departments/{dept}/skills/{name}/SKILL.md`) is the **source of truth** for skill content, instructions, and supporting files. The `skills` database table is a **metadata cache** used for querying, searching, and UI display. The `propose_skill` tool writes to filesystem first, then creates/updates the DB record. The `status` field in SKILL.md frontmatter and the DB must be kept in sync -- when the CEO approves via the API, both the SKILL.md frontmatter and the DB record are updated.

If the DB and filesystem disagree, the filesystem wins. A startup scan reconciles the DB from the filesystem.

### Skill Directory Structure

A skill is a directory. The only required file is `SKILL.md`. Everything else is freeform -- the skill author decides what supporting files to include and how to organize them. The SKILL.md body references them with relative paths.

```
skill-name/
  SKILL.md              # Required: YAML frontmatter + markdown instructions
  ...                   # Everything else is up to the skill author
```

Examples of what a skill directory might contain:

```
eeg-electrode-reconstruction/
  SKILL.md
  preprocess.py
  metrics.py
  example-output.md

aws-deploy-pytorch/
  SKILL.md
  deploy.sh
  instance-types.md
  Dockerfile

youtube-script-template/
  SKILL.md
  template.md
  hooks-database.json
```

There's no rigid convention for subdirectory names. Some skills are just a SKILL.md with inline instructions. Others have scripts, data files, templates, reference docs -- whatever the skill needs. The entire directory is symlinked into the agent's desk, so the agent can access any file via relative path from SKILL.md.

### SKILL.md Format

```markdown
---
name: eeg-electrode-reconstruction
description: This skill should be used when evaluating an EEG foundation model's reconstruction capability, testing electrode prediction accuracy, or benchmarking neural signal models. Use it whenever the task involves masking EEG channels and comparing predicted vs ground truth signals.
version: 1
status: active
department: tech
created_by: cto
approved_by: ceo
tags: eeg, reconstruction, foundation-model, evaluation
---

## Instructions

1. Load EEG data using MNE-Python
2. Select target electrode (default: Fp1)
3. Create masked input: zero out target channel
4. Run foundation model inference on masked input
5. Compare predicted channel to ground truth
6. Compute metrics: Pearson r, RMSE, SNR per frequency band
7. Generate overlay plot (predicted vs actual waveform)

## Scripts

Run the preprocessing script from this skill's directory:
```bash
python scripts/preprocess.py --input <eeg_file> --target-ch Fp1
```

For benchmark metrics, see `references/metrics-guide.md`.

## Example

See `examples/sample-output.md` for expected report format.
```

**Key points about the `description` field:**
- This is the PRIMARY triggering mechanism -- the SDK decides whether to invoke the skill based on this field
- Be specific about WHEN to use it, not just WHAT it does
- Include trigger phrases, keywords, and contexts (Claude tends to "under-trigger" so be slightly pushy)
- All "when to use" logic goes in description, not in the body

### Skill File Locations

Skills live inside the department library as directories:

```
data/departments/
  tech/
    knowledge/                                -- Reference docs
      lab-eeg-inventory.md
      aws-infrastructure.md
    skills/                                   -- Department skills (directories, not files)
      eeg-electrode-reconstruction/
        SKILL.md
        scripts/
          preprocess.py
          run_inference.py
        references/
          metrics-guide.md
        examples/
          sample-output.md
      aws-deploy-pytorch/
        SKILL.md
        scripts/
          deploy.sh
        references/
          instance-types.md
    tasks/                                    -- Per-task workspaces
  marketing/
    knowledge/
    skills/
      youtube-script-template/
        SKILL.md
        assets/
          script-template.md
        examples/
          sample-script.md
      content-calendar-planning/
        SKILL.md
    tasks/
  operations/
    knowledge/
    skills/
    tasks/
  global/                                 -- Cross-department skills
    skills/
      system-reset/SKILL.md
```

This means skills are browsable in the Org Context page alongside knowledge, and are department-scoped by default.

### How Agents Discover and Use Skills (Native SDK Discovery)

Skills are discovered **natively by the Claude Agent SDK** -- the same mechanism Claude Code uses for project skills. No prompt injection, no custom tools, no manual loading.

#### How It Works

1. **When a task workspace is created**, department skills (+ global skills) are **symlinked** into `desk/.claude/skills/`
2. **The agent session** is configured with `settingSources: ["project"]` -- this tells the SDK to scan `{cwd}/.claude/skills/` for SKILL.md files
3. **`"Skill"` is included in built-in `tools` and pre-approved in `allowedTools`** -- the agent can invoke any discovered skill
4. **At startup**, the SDK reads all SKILL.md frontmatter (name + description) and holds them in context
5. **During execution**, the SDK autonomously invokes a skill when the task context matches the skill's `description` field
6. **The agent follows** the instructions in the skill body -- executing code, calling tools, producing output

**No `read_knowledge` needed.** No prompt injection. No manual skill index. The SDK does it all natively.

#### Agent Session Configuration

```typescript
import { query } from '@anthropic-ai/claude-agent-sdk';

for await (const message of query({
  prompt: taskDescription,
  options: {
    cwd: taskPaths.desk,
    settingSources: ['project'],
    tools: ['Skill', 'Read', 'Write', 'Bash', 'Glob', 'Grep'],
    mcpServers: { myelin: myelinServer },
    allowedTools: [
      'Skill',
      'Read', 'Write', 'Bash', 'Glob', 'Grep',
      'mcp__myelin__promote_to_deliverable',
      'mcp__myelin__search_knowledge'
    ],
  }
})) {
  // process messages
}
```

**Why `settingSources: ["project"]` and NOT `["user", "project"]`?**
- `"project"` loads from `{cwd}/.claude/skills/` -- our symlinked department skills
- `"user"` would load from `~/.claude/skills/` -- the developer's personal Claude Code skills. We do NOT want these polluting agent behavior.
- Agents only see skills from their own department + global, enforced by which symlinks exist

**Why no restrictions on `"Skill"`?**
- Per official docs: the `allowed-tools` frontmatter field in SKILL.md does NOT work in SDK mode
- Skill visibility comes from the built-in `tools` list, and permission comes from `allowedTools`
- If a skill is symlinked into the desk, the agent should be able to use it -- access control is at the symlink level

### Built-ins vs `mcpServers` vs `allowedTools`

This distinction is critical:

| Option | What it controls |
|--------|------------------|
| `tools` | Which **built-in SDK tools** are visible in Claude's context |
| `mcpServers` | Which **custom / MCP tools** are available |
| `allowedTools` | Which visible tools run without a permission prompt |

Examples:

- `tools: ['Read', 'Write']` means Claude only sees those built-ins
- `mcpServers: { myelin: myelinServer }` exposes Myelin custom tools
- `allowedTools: ['mcp__myelin__read_memory']` pre-approves that custom tool

#### Workspace Setup (symlinks)

When `createTaskWorkspace()` is called (see Doc 02), it symlinks department + global skills:

```
data/departments/tech/tasks/zuna-eval-task_a1b2/
  desk/
    .claude/
      skills/
        eeg-electrode-reconstruction/  -> symlink to ../../../../skills/eeg-electrode-reconstruction/
        aws-deploy-pytorch/            -> symlink to ../../../../skills/aws-deploy-pytorch/
        system-reset/                  -> symlink to ../../../../../global/skills/system-reset/
    scripts/
    ...
  deliverables/
```

The SDK scans `desk/.claude/skills/*/SKILL.md`, reads frontmatter, and makes skills available. When a skill is invoked, the agent has access to the entire skill directory (scripts/, references/, assets/, examples/) via relative paths from SKILL.md. The agent never knows they're symlinks.

**Only `status: active` skills are symlinked.** The `createTaskWorkspace()` function skips skills with `status: pending` or `status: pending_ceo` in their SKILL.md frontmatter.

#### Who Gets What Skills

| Agent | Skills in .claude/skills/ | How |
|-------|--------------------------|-----|
| Dept head (CTO/CMO/COO) | Own dept + global | Symlinked at workspace creation |
| Temp employee | Own dept + global (same as dept head) | Same symlinks -- employees share department skills |
| Cross-dept agent | Only own dept + global (not the consulted dept's skills) | Consultation happens via A2A, not skill sharing |

Employees see the SAME skills as their department head. They can discover and use any active skill. They **can propose** new skills via `propose_skill`, but they cannot activate them directly; proposals must go through dept head review and CEO approval.

### Skill Loader

```typescript
// src/skills/loader.ts
import { readdirSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';
import matter from 'gray-matter';  // Parse YAML frontmatter

const DEPTS_DIR = 'data/departments';

export interface SkillDoc {
  name: string;
  description: string;
  department: string;
  status: string;
  tags: string[];
  instructions: string;
  filePath: string;                // Path to SKILL.md
  dirPath: string;                 // Path to skill directory
  supportingFiles: string[];       // All other files in the directory (relative paths)
}

export function listAllSkills(): SkillDoc[] {
  const skills: SkillDoc[] = [];
  const departments = ['tech', 'marketing', 'operations', 'global'];

  for (const dept of departments) {
    const skillsDir = join(DEPTS_DIR, dept, 'skills');
    if (!existsSync(skillsDir)) continue;

    const entries = readdirSync(skillsDir);
    for (const entry of entries) {
      const skillFile = join(skillsDir, entry, 'SKILL.md');
      if (!existsSync(skillFile)) continue;

      const raw = readFileSync(skillFile, 'utf-8');
      const { data, content } = matter(raw);

      skills.push({
        name: data.name || entry,
        description: data.description || '',
        department: data.department || dept,
        status: data.status || 'pending',
        tags: (data.tags || '').split(',').map((t: string) => t.trim()),
        instructions: content,
        filePath: skillFile,
      });
    }
  }

  return skills;
}

export function listPendingSkills(): SkillDoc[] {
  return listAllSkills().filter(s => s.status === 'pending');
}
```

### Skill Creation and Approval Flow

Skills are created through a three-step approval chain: **employee proposes -> dept head reviews/refines -> CEO approves**.

**Minimum implementation rule for v10**: this flow must have explicit API handlers and UI actions. Do not leave approval as an implicit file edit. The minimum endpoints are:

- `POST /api/skills/{skillId}/submit-to-ceo`
- `POST /api/skills/{skillId}/approve`
- `POST /api/skills/{skillId}/dismiss`

The Org Context page is the canonical review surface for these actions.

**Step 1: Skill Extraction (via skill-extractor skill)**

The `skill-extractor` is itself a skill (stored in `global/skills/skill-extractor/`). After a task completes, the dept head's agent can invoke it to analyze the deliverable and identify reusable patterns. It produces candidate skill definitions.

**Implementation note**: In the current v10 implementation, `skill-extractor` is shipped as a real global skill and seeded into `data/departments/global/skills/` during bootstrap. After a task is approved by supervisor review, the supervisor agent performs an explicit post-completion extraction pass using this skill path. The result may be either:
- a `propose_skill` call for a strong reusable pattern, or
- an explicit "no skill proposal" conclusion when the reusable value belongs in deliverables / knowledge rather than a new skill.

Alternatively, any agent can call `propose_skill` directly during or after a task if they recognize a reusable pattern.

**Step 2: `propose_skill` Tool**

See the `propose_skill` tool definition in the Tool Definitions section above. It uses a Zod schema and returns the standard content format.

**Step 3: Approval Chain**

1. **Employee proposes** via `propose_skill` -> creates skill dir with `status: pending`
2. **Dept head reviews** in Org Context page:
   - Can view SKILL.md + all supporting files (scripts, references, examples)
   - Can edit any file (fix instructions, improve description, add scripts)
   - Clicks "Submit to CEO" -> status changes to `pending_ceo`
3. **CEO reviews** in Org Context page:
   - Sees the polished skill with dept head's refinements
   - "Approve" -> status: `active`. Skill is symlinked into future task desks.
   - "Dismiss" -> skill directory deleted

**Important**: Only `status: active` skills get symlinked into task desks. Pending skills exist in the department's skills/ directory but are NOT symlinked -- agents can't discover or use them until approved.

**Skill access control for `propose_skill`:**
- Dept heads: can propose (has `propose_skill` tool)
- Temp employees: can propose (has `propose_skill` tool) -- but their proposals need dept head review first
- Tamir: does not propose skills (routes, doesn't execute)

## Global Skills (Ship with the System)

These skills are installed in `data/departments/global/skills/` and symlinked into EVERY agent's desk. They are core company infrastructure, not department-specific.

### 1. memory-management

**Location**: `data/departments/global/skills/memory-management/SKILL.md`

**Purpose**: Every agent has a personal `MEMORY.md` file at `data/agents/{agent_id}/MEMORY.md`. This skill teaches the agent how to use it -- when to read (start of every task), when to write (end of every task or when discovering something worth remembering), and how to organize entries.

**What gets stored in MEMORY.md** (vs elsewhere):

| Information | Goes in MEMORY.md? | Why / Where Instead |
|------------|-------------------|---------------------|
| "CEO prefers tables over paragraphs" | Yes | Personal behavioral preference |
| "g4dn.xlarge was too slow, use g5" | Yes | Lesson from past experience |
| "auto-subtitle-ai CLI is great for SRT" | Yes | Useful tool discovery |
| Our AWS region is us-east-1 | No -- dept knowledge/ | Shared reference fact |
| EEG preprocessing pipeline steps | No -- Skill (SKILL.md) | Reusable procedure |
| Company mission statement | No -- Vault | Company-wide permanent doc |
| Task plan and constraints | No -- CLAUDE.md in desk | Task-specific, auto-loaded by SDK |

**SKILL.md structure**:
```yaml
---
name: memory-management
description: This skill should be used at the START of every task to check past experiences,
  and at the END of every task to save what was learned. Use whenever the agent needs to
  recall preferences, past decisions, lessons learned, working patterns, or behavioral notes.
version: 1
status: active
department: global
tags: memory, recall, preferences, learning, experience
---
```

The body contains:
- When to read (task start -- scan for relevant entries)
- When to write (task end -- save new lessons, update outdated entries)
- Memory format template (organized by: Preferences, Lessons Learned, Useful Tools, Working Notes)
- Rules: be concise, date everything, prune outdated entries, don't duplicate knowledge/ content
- What goes where (MEMORY.md vs knowledge vs skill vs vault)

**How agents access it**: `read_memory` / `write_memory` custom tools. The file is outside the desk CWD, so memory access must go through those tools.

**Per-agent isolation**: Each agent has its own MEMORY.md. CTO's memories don't leak to CMO. Temp employees get their own file too (archived when terminated).

### 2. skill-extractor

**Location**: `data/departments/global/skills/skill-extractor/SKILL.md`

**Purpose**: After a task completes, this skill helps the agent analyze what was done and identify reusable patterns that should become permanent skills. It's the mechanism for institutional learning -- turning one-off task solutions into repeatable capabilities.

**When it triggers**: After any task that produced useful output -- the agent (or dept head during review) recognizes a pattern worth saving: a script, a workflow, a tool integration, a methodology.

**Shipping rule**: This is not just a documented example. v10 should ship with `skill-extractor` present on disk as an active global skill so it is symlinked into task desks like other core company infrastructure.

**SKILL.md structure**:
```yaml
---
name: skill-extractor
description: This skill should be used after completing a task to identify reusable patterns,
  tools, scripts, or methodologies that could benefit future tasks. Use when reviewing
  completed work and deciding what institutional knowledge to capture. Also use when asked
  to "save this as a skill", "remember how to do this", or "make this reusable".
version: 1
status: active
department: global
tags: skill, extract, learn, pattern, reusable, institutional-knowledge
---
```

The body contains step-by-step instructions:

**Step 1: Analyze the completed work**
- Review the deliverables and desk contents
- Identify: Was there a reusable script? A methodology? A tool integration? A template?
- Ask: "Would this help if a similar task came up in 3 months?"

**Step 2: Draft the skill**
- Pick a descriptive snake-case name
- Write a clear `description` field (remember: this is what triggers the skill in future tasks -- be specific about WHEN to use it)
- Write instructions that a new agent could follow without prior context
- Collect supporting files (scripts, templates, reference docs, examples)
- Save everything to `desk/drafts/skills/{skill-name}/`

**Step 3: Propose via `propose_skill` tool**
- Call `propose_skill` with the name, description, instructions, tags, and supporting files
- This creates the skill directory in the department's `skills/` folder with `status: pending`

**Step 4: (Handled by approval chain)**
- Dept head reviews and refines in Org Context
- CEO approves -> skill becomes active -> symlinked into future desks

**Observed runtime behavior**:
- The skill may decide that the deliverable itself is the institutional knowledge and that no new skill should be proposed.
- This is a correct outcome when the work produced reusable content but not a reusable procedure.

**What makes a good extracted skill**:
- Specific enough to be useful, general enough to apply to multiple tasks
- Includes concrete steps, not vague advice
- Has supporting files when applicable (scripts, templates, config examples)
- Description field is "pushy" -- lists trigger phrases and contexts so the SDK activates it reliably
- Tested -- the agent just used this procedure successfully, so it knows it works

**What should NOT be a skill**:
- One-off task-specific details (goes in deliverables)
- Reference facts about our setup (goes in dept knowledge/)
- Personal preferences (goes in MEMORY.md)
- Company-wide policies (goes in vault)

### 3. system-reset

**Location**: `data/departments/global/skills/system-reset/SKILL.md`

**Purpose**: Clears all operational data (tasks, deliverables, activity logs, etc.) while preserving vault, company DNA, skills, and permanent employees. Used for clean testing.

This is a simple utility skill -- its SKILL.md contains the reset script and safety checks.

---

## MCP (Model Context Protocol)

### What is MCP?

MCP connects agents to external tool providers. An MCP server exposes tools (functions) that agents can call. Examples: database queries, API integrations, file system access, code execution environments.

### MCP Server Registry

```typescript
// Database table: mcp_servers
{
  serverId: 'mcp_web_search',
  name: 'Web Search',
  description: 'Search the web using Brave Search API',
  transport: 'stdio',      // stdio | http
  config: JSON.stringify({
    command: 'npx',
    args: ['-y', '@anthropic/mcp-server-brave-search'],
    env: { BRAVE_API_KEY: '...' },
  }),
  department: null,         // Available to all
  status: 'active',
}
```

### MCP Client

```typescript
// src/mcp/client.ts
import { spawn } from 'child_process';

export class McpClient {
  async connect(config: McpServerConfig): Promise<McpConnection> {
    const proc = spawn(config.command, config.args, {
      env: { ...process.env, ...config.env },
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    // JSON-RPC communication over stdio
    return new McpConnection(proc);
  }
}
```

## External Search APIs

The Tamir plan mode gallery can search external sources in real-time:

### Tool Search

```typescript
// app/api/search/tools/route.ts

// Source: company -- search our MCP server registry
// Source: mcp-registry -- https://registry.mcphub.io/api/v1/servers?q=...
// Source: glama -- https://glama.ai/api/mcp/servers?search=...

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get('q') || '';
  const source = searchParams.get('source') || 'company';
  const department = searchParams.get('department') || '';

  if (source === 'company') {
    // Query local DB
    const tools = await db.mcpServer.findMany({ where: { status: 'active' } });
    return Response.json({ results: filterByQuery(tools, q, department) });
  }

  if (source === 'mcp-registry') {
    const resp = await fetch(`https://registry.mcphub.io/api/v1/servers?q=${q}&limit=20`);
    const data = await resp.json();
    return Response.json({ results: data.servers || [] });
  }

  if (source === 'glama') {
    const resp = await fetch(`https://glama.ai/api/mcp/servers?search=${q}&limit=20`);
    const data = await resp.json();
    return Response.json({ results: data.servers || data.results || [] });
  }
}
```

### Skill Search

```typescript
// app/api/search/skills/route.ts

// Source: company -- search our skills DB + SKILL.md files
// Source: clawhub -- https://hub.openclaw.ai/api/skills?q=...

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get('q') || '';
  const source = searchParams.get('source') || 'company';

  if (source === 'company') {
    const skills = await db.skill.findMany({ where: { status: 'active' } });
    return Response.json({ results: filterByQuery(skills, q) });
  }

  if (source === 'clawhub') {
    const resp = await fetch(`https://hub.openclaw.ai/api/skills?q=${q}&limit=20`);
    const data = await resp.json();
    return Response.json({ results: data.skills || [] });
  }
}
```

### Gallery UI Search Behavior

- **Debounce**: 300ms after user stops typing
- **Local first**: Filter existing company cards immediately
- **External async**: Query enabled external sources in parallel
- **Source toggles**: Checkboxes at top of gallery to enable/disable each source
- **Cross-department graying**: Items from other departments shown grayed but selectable
- **Source badge**: External results show a small colored badge (e.g., "mcp-registry", "clawhub")
