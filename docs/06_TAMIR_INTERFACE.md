# 06 -- Tamir Interface: Plan Mode (Chat + Canvas + Gallery)

## Overview

The Tamir tab (/tamir) is the CEO's primary interaction point in the Cortex. It provides a chat interface that evolves into a split-pane plan editor when the CEO initiates a task. This is where tasks are born.

The key architectural principle: **Tamir only routes. Department heads own the planning conversation.** Communication between CEO and dept head is direct -- Tamir creates an A2A Task, hands off, and gets notified asynchronously when status changes.

**Canonical clarification**:

- `Plan with CTO/CMO/COO` means the selected department head becomes `planningAgentId`
- `Plan with Tamir` is an explicit alternate planning path where Tamir becomes the `planningAgentId` and `currentActorId` for planning only
- The UI must render from explicit backend structured output, not natural-language heuristics

## Layout Evolution

The interface has TWO states:

### State 1: Chat Only (before plan)
```
+--------------------------------------------------+
|                                                  |
|                    Chat                          |
|               (full width)                       |
|                                                  |
|  [CEO types task]                                |
|  [Tamir acknowledges + routing buttons]          |
|  [CEO picks "Plan with CTO"]                     |
|  --- handoff: chat switches to CTO session ---   |
|  [CTO greets + asks clarifying questions]        |
|  [CEO answers]                                   |
|                                                  |
|  [input box] [Send]                              |
+--------------------------------------------------+
```

### State 2: Split Pane (after plan generated)
```
+------- 40% -------+---------- 60% ----------+
|                    |                          |
|     Chat           |   Canvas (plan MD)       |
|     (with CTO)     |   Rendered markdown      |
|                    |   with typewriter fx     |
|                    |                          |
|                    |   [Approve] [Cancel]     |
|                    |   [Edit]                 |
|                    |                          |
|                    |   -- CONFIGURATION --    |
|                    |   [===o===] Autonomy     |
|                    |   [$10] Max Budget      |
|                    |   [constraints text]     |
|                    |                          |
|                    |   -- TOOLS & SKILLS --   |
|                    |   [Skills] [Tools] tabs  |
|  [input] [Send]    |   VS Code gallery grid   |
+--------------------+--------------------------+
```

## A2A Task Flow (How It Actually Works)

The entire planning flow is driven by A2A task states plus SDK structured output. The frontend renders based on those contracts -- no hacky signal detection.

```
CEO types message
  |
  v
POST /api/tamir/route
  |-- Tamir agent analyzes request via LLM with structured output (routing schema)
  |-- Creates A2A Task: { contextId, fromAgent: tamir, toAgent: <department_head>, status: submitted }
  |-- Notifies selected department head (internal): TaskHandoff with CEO's message + config
  |-- Returns: { taskId, contextId, department, route_reason }
  |-- Tamir is NOW DONE. Goes idle. Gets async notifications only.
  |
  v
Frontend switches to: POST /api/tasks/{taskId}/message
  |-- All further messages go directly to the dept head's planning desk
  |-- That planner agent instance handles the session
  |-- No Tamir involvement in any message
  |
  v
Department head clarifies (task status: input-required)
  |-- Agent returns structured output with type: 'ask_for_input'
  |-- CEO answers -> POST /api/tasks/{taskId}/message
  |-- Agent satisfied -> returns type: 'execution_update' or 'plan_ready'
  |
  v
Department head generates plan (task status: working -> has artifact)
  |-- Plan appears as A2A Artifact on the task
  |-- API returns: { state: 'working', turn: { type: 'plan_ready', planMarkdown: '...' } }
  |-- Frontend opens canvas with typewriter effect
  |
  v
CEO reviews, edits, configures
  |-- PUT /api/tasks/{taskId}/config  (autonomy, budget, tools, skills)
  |-- PUT /api/tasks/{taskId}/artifact  (edited plan markdown)
  |
  v
CEO approves
  |-- POST /api/tasks/{taskId}/approve
  |-- A NEW task desk is created for execution
  |-- Tamir notified: saves summary (task title, dept, budget, CEO involvement level)
  |-- Deliverable + workspace created
  |-- Execution starts in background
  |-- Frontend redirects to /deliverables/{id}
```

## Step-by-Step User Experience

### Step 1: CEO Types Task
CEO types a natural language request in the chat input. Examples:
- "Find the ZUNA EEG foundation model, deploy on AWS, test with our lab scans"
- "Write a YouTube script about running a one-man AI company"
- "Create a project timeline for the MVP launch"

### Step 2: Tamir Routes (Only Step Where Tamir is Active)
The message goes to `POST /api/tamir/route`. Tamir's agent uses an LLM call with SDK structured output to analyze the request against the company DNA (organization structure from the vault) and Agent Card capabilities.

Tamir's routing call uses `outputFormat` to guarantee valid JSON:

```typescript
const routingResult = await orch.invoke('tamir', ceoMessage, {
  outputFormat: {
    type: 'json_schema',
    schema: {
      type: 'object',
      properties: {
        department: { type: 'string', enum: ['tech', 'marketing', 'operations'] },
        reason: { type: 'string' },
        suggestedAgent: { type: 'string', enum: ['cto', 'cmo', 'coo'] }
      },
      required: ['department', 'reason', 'suggestedAgent']
    }
  },
  // systemPrompt built internally by invokeAgent() -- do NOT pass here
});

// SDK guarantees valid JSON -- just parse directly
const routing = JSON.parse(routingResult.resultText);
```

No fallbacks, no regex, no default department on parse failure. The SDK guarantees the output conforms to the schema.

Tamir responds in chat (red avatar): short acknowledgment + department suggestion.

Two buttons appear:
```html
<button class="primary" onclick="routeTo('tech')">Plan with CTO</button>
<button class="secondary" onclick="routeTo('tamir')">Plan with Tamir</button>
```

Behind the scenes, Tamir has already created the A2A Task with status `submitted`.

### Step 3: Direct Handoff -- CEO Talks to Department Head

When CEO clicks "Plan with CTO":
1. Frontend stores the `taskId` from the route response
2. Frontend switches its chat endpoint from `/api/tamir/route` to `/api/tasks/{taskId}/message`
3. The first message to this endpoint triggers CTO's agent to greet and start clarifying. Planning happens in the dept head's persistent planning desk at `data/departments/{dept}/planning-desk/`, which has `.claude/skills/` with department skills symlinked, and its own `CLAUDE.md`.
4. **CTO's avatar and color take over the chat.** No more Tamir messages.
5. CTO either asks 1-2 clarifying questions or immediately starts planning

The CTO agent runs in its own session with its own tools, soul, and context. It's not Tamir pretending to be CTO -- it IS the CTO agent.

### Step 3B: "Plan with Tamir" Semantics

When the CEO clicks `Plan with Tamir`:

1. the task keeps the routed `department` recommendation from `POST /api/tamir/route`
2. `planningAgentId` becomes `tamir`
3. `currentActorId` becomes `tamir`
4. no desk/workspace is created yet, because the task is still in planning
5. Tamir plans using his own soul, company context, memory, and available Tamir tools

Important:

- Tamir's planning tools are his normal role tools only; he does **not** gain department-specific execution tools
- if the approved task should execute in a department, approval hands execution to the routed department head by setting `executorAgentId` and `supervisorAgentId` to that department's head
- if the task is truly a chief-of-staff / coordination task, Tamir may remain the executor and supervisor after approval

### Step 4: Clarification (Driven by Structured Output)

The frontend doesn't guess when clarification is done. The SDK structured output tells it directly:

| API Returns | Frontend Renders |
|-------------|-----------------|
| `{ state: 'input-required', turn: { type: 'ask_for_input', message: '...' } }` | Show CTO's question + chat input enabled |
| `{ state: 'working', turn: { type: 'execution_update', message: 'Drafting plan...' } }` | Show working spinner / progress message |
| `{ state: 'working', turn: { type: 'plan_ready', message: 'Plan ready...', planMarkdown } }` | Open canvas with typewriter. Chat input re-enabled. |

The backend updates task state from SDK structured output -- no parsing or interpretation needed:
```typescript
const turn = await runPlanningTurn(taskId, ceoMessage);

if (turn.type === 'ask_for_input') {
  await transitionTask(taskId, 'input-required');
  return { state: 'input-required', turn };
}

if (turn.type === 'plan_ready') {
  await transitionTask(taskId, 'working');
  await addArtifact(taskId, {
    artifactId: generateId('art'),
    name: 'plan',
    parts: [{ kind: 'text', text: turn.planMarkdown! }]
  });
  return { state: 'working', turn };
}
```

### Step 5: Plan Appears on Canvas

When the API returns `turn.type === 'plan_ready'` with `planMarkdown`:
1. Canvas panel slides open (40/60 split)
2. Plan renders line-by-line with typewriter effect (40-70ms per line)
3. Raw markdown stored in hidden textarea for editing

Plan template (just example):
```markdown
## Task: ZUNA EEG Foundation Model Evaluation

**Department:** Tech
**Deliverable:** Technical evaluation report with benchmarks
**Deliverable Type:** Report + code + generated plots

### Approach
Download ZUNA model from HuggingFace, deploy on g4dn.xlarge EC2,
run electrode reconstruction experiment on our lab EEG data.

### Steps
1. Locate ZUNA model on HuggingFace (check Zyphra org)
2. Provision g4dn.xlarge EC2 with PyTorch AMI
3. Download and load model weights
4. Transfer lab EEG scans from S3
5. Preprocess with MNE-Python (bandpass 1-45Hz, re-reference)
6. Mask electrode Fp1, predict from remaining channels
7. Compute metrics: Pearson r, RMSE, SNR per band
8. Generate waveform overlay plots
9. Write evaluation report

### Success Criteria
- Pearson r > 0.7 for alpha band reconstruction
- Full report with reproducible methodology

### Resources Needed
- HuggingFace Hub access, AWS g4dn.xlarge, Lab EEG dataset
- MNE-Python, PyTorch, Matplotlib
```

### Step 6: CEO Reviews, Edits, Configures

**Plan Editing:**
- Click "Edit" to switch to raw markdown textarea
- Click "Save" to re-render
- Changes saved via `PUT /api/tasks/{taskId}/artifact`

**Configuration Controls (below plan on canvas):**

1. **Autonomy Slider** -- HTML range input
   - Labels: Minimal | Balanced | High | Full
   - Default: Balanced
   - Minimal = ask CEO before each step
   - Full = complete autonomy

2. **Max Budget** -- Number input in USD (default $10)

3. **Constraints** -- Free text (e.g., "no paid APIs", "use only open-source")

Saved via `PUT /api/tasks/{taskId}/config`

**Tool & Skill Gallery (below config):**

Two tabs: Skills and Tools. VS Code extension gallery layout.

Each card: icon, name, description (80 chars), department badge, source badge for external results. Click to select (highlighted + "SELECTED" badge). Text input appears: "Why use this?" (CEO hint). Cross-department items shown grayed but selectable.

**IMPORTANT: CEO selections are HINTS, not instant installations.** Selected external tools/skills are stored as `selectedTools`/`selectedSkills` on the task record. On approval, they must be injected into execution context in BOTH of these places:

1. appended to `desk/CLAUDE.md` under `## CEO Hints`
2. included in the execution `extraSystemPrompt` as a concise reminder

The executing agent sees them as suggestions ("CEO suggests using HeyGen for video generation"), not mandatory commands. External MCP tools from registries are NOT auto-installed -- if the agent needs one, it creates a `ToolRequest` record for the dept head to evaluate and configure.

**Search** -- Live 300ms debounce:
- Skills: Company DB + ClawHub API (toggleable sources)
- Tools: Company MCP servers + MCP Registry + Glama API (toggleable sources)

### Step 7: CEO Approves

CEO clicks "Approve & Execute":

```
POST /api/tasks/{taskId}/approve
  |
  |-- Task status: working (plan approved, execution starting)
  |-- Tamir notified asynchronously:
  |     Saves compact summary: { title, dept, budget, autonomy, ceo_involvement }
  |     This is how Tamir tracks all company projects without being in the loop
  |
  |-- NEW task desk created for execution:
  |     data/departments/tech/tasks/zuna-eval-task_xxxx/
  |       desk/           -- agent's CWD
  |       chat.jsonl      -- execution chat log
  |       deliverables/   -- CEO-visible outputs
  |
  |-- Deliverable record created in DB (plan + chat history referenced by filesystem paths)
  |-- Task status: working
  |-- CTO delegates to employee or executes directly
  |-- Frontend redirects to /deliverables/{id}
```

## API Endpoints

### POST /api/tamir/route
Tamir routes using SDK structured output and creates A2A Task. Called ONCE per task.
```typescript
// Request
{ message: string }

// Response
{
  taskId: string;          // A2A task ID
  contextId: string;       // Groups entire lifecycle
  department: string;      // 'tech' | 'marketing' | 'operations'
  route_reason: string;    // 'Matched skills: eeg-research, aws-deploy (score: 28)'
  tamir_response: string;  // Tamir's acknowledgment message
}
```

### POST /api/tasks/{taskId}/message
Send a message to the task's current planning actor. Used for ALL CEO <-> planner communication.
```typescript
// Request
{ message: string }

// Response
{
  state: TaskState;        // 'submitted' | 'working' | 'input-required' | 'completed' | 'failed' | 'canceled'
  agent_id: string;        // Who responded (e.g. 'cto')
  turn: {
    type: 'ask_for_input' | 'plan_ready' | 'execution_update' | 'task_failed';
    message: string;
    planMarkdown?: string;
    inputType?: 'clarification' | 'hire_approval' | 'budget_increase';
    metadata?: Record<string, unknown>;
  };
}
```

**Route runtime guidance**:

- Export `maxDuration = 120` on this route segment for long planning turns
- Show a client-side timeout / retry UI if the request exceeds the frontend timeout budget
- v10 may return one-shot JSON first; streaming plan-turn output over SSE is a recommended enhancement

### GET /api/tasks/{taskId}
Get full task state, history, artifacts, config. Lifecycle stage is derived from timestamps, not stored as an explicit phase field.
```typescript
// Response
{
  taskId: string;
  contextId: string;
  status: string;             // TaskState string directly from DB
  chatPath: string;          // e.g. 'data/departments/tech/planning-desk/chat/{taskId}.jsonl'
  artifacts: A2AArtifact[];
  config: TaskConfig;
  planningAgentId: string;
  executorAgentId?: string;
  supervisorAgentId: string;
  currentActorId: string;
  department: string;
  // Lifecycle derived from timestamps:
  submittedAt: string;
  approvedAt?: string;        // Matches DB field name
  completedAt?: string;
}
```

### PUT /api/tasks/{taskId}/config
Update task configuration (autonomy, budget, constraints, selected tools/skills).
```typescript
// Request
{
  autonomy_level?: string;
  max_budget_cents?: number;
  constraints?: string;
  selected_tools?: Array<{ id: string; name: string; hint: string }>;
  selected_skills?: Array<{ id: string; name: string; hint: string }>;
}
```

### PUT /api/tasks/{taskId}/artifact
Update the plan artifact (CEO edits the plan markdown).
```typescript
// Request
{ plan_md: string }
```

### POST /api/tasks/{taskId}/approve
Approve the plan and start execution. Creates a new task desk for the execution phase.
```typescript
// Response
{
  status: 'working';
  deliverable_id: string;
  task_id: string;
  workspace_path: string;   // e.g. 'data/departments/tech/tasks/zuna-eval-task_xxxx/'
}
```

### GET /api/tasks/{taskId}/chat
Load chat history from filesystem JSONL files for restoring conversations in the UI.
```typescript
// Response
{
  messages: Array<{
    ts: string;
    role: 'user' | 'agent' | 'system';
    agentId?: string;
    content: string;
    turnType?: string;
    costUsd?: number;
  }>;
  chatPath: string;  // Filesystem path for reference
}
```

**Implementation**: reads the JSONL file line-by-line, parses each JSON line, returns the array. For planning chat: `data/departments/{dept}/planning-desk/chat/{taskId}.jsonl`. For execution chat: `data/departments/{dept}/tasks/{slug}/chat.jsonl`. The endpoint derives which file to read from the task's `approvedAt` timestamp: if null, read planning chat; if set, read execution chat (or both, concatenated with a divider).

### POST /api/tasks/{taskId}/cancel
Cancel the task.
```typescript
// Response
{ status: 'canceled' }
```

## Implementation: How the Backend Routes Messages

```typescript
// app/api/tasks/[taskId]/message/route.ts
export const maxDuration = 120;

export async function POST(req: Request, { params }: { params: { taskId: string } }) {
  const { message } = await req.json();
  const task = await db.task.findUnique({ where: { taskId: params.taskId } });
  if (!task) return Response.json({ error: 'Task not found' }, { status: 404 });

  const orch = getOrchestrator();

  // Planning happens in the dept head's persistent planning desk
  const planningDeskPath = `data/departments/${task.department}/planning-desk`;

  // Invoke the current planning actor via invokeAgent() (Doc 02).
  // invokeAgent() already sets systemPrompt preset + soul content internally.
  // We only pass cwd, sessionId, and outputFormat here.
  // NOTE: Do NOT set systemPrompt here -- invokeAgent() handles it via the preset.
  const actorId = task.currentActorId || task.planningAgentId;
  const result = await orch.invoke(actorId, message, {
    cwd: planningDeskPath,
    sessionId: task.sessionId || undefined,
    outputFormat: {
      type: 'json_schema',
      schema: {
        type: 'object',
        properties: {
          type: { type: 'string', enum: ['ask_for_input', 'plan_ready', 'execution_update', 'task_failed'] },
          message: { type: 'string' },
          planMarkdown: { type: 'string' },
          inputType: { type: 'string', enum: ['clarification', 'hire_approval', 'budget_increase'] },
          metadata: { type: 'object' }
        },
        required: ['type', 'message']
      }
    },
  });

  // Save session_id for future resume
  await db.task.update({
    where: { taskId: params.taskId },
    data: { sessionId: result.sessionId },
  });

  // Append to chat history on filesystem (JSONL)
  const chatPath = `${planningDeskPath}/chat/${params.taskId}.jsonl`;
  appendFileSync(chatPath, JSON.stringify({ role: 'user', content: message, ts: new Date().toISOString() }) + '\n');
  appendFileSync(chatPath, JSON.stringify({ role: 'agent', content: result.resultText, ts: new Date().toISOString() }) + '\n');

  // SDK guarantees valid JSON -- just parse directly
  const turn = JSON.parse(result.resultText);

  const newState =
    turn.type === 'ask_for_input' ? 'input-required' :
    turn.type === 'task_failed' ? 'failed' :
    'working';
  await transitionTask(params.taskId, newState);

  if (turn.type === 'plan_ready' && turn.planMarkdown) {
    await addArtifact(params.taskId, {
      artifactId: generateId('art'),
      name: 'plan',
      parts: [{ kind: 'text', text: turn.planMarkdown }]
    });
  }

  return Response.json({
    state: newState,
    agent_id: task.currentActorId || task.planningAgentId,
    turn,
  });
}
```

## SDK Structured Output Contract

Planning turns use SDK `outputFormat` with a JSON schema, which guarantees valid JSON output. No regex parsing, no HTML comment footers, no `interpretPlanningTurn()` function needed.

The planning turn schema:

```json
{
  "type": "object",
  "properties": {
    "type": { "type": "string", "enum": ["ask_for_input", "plan_ready", "execution_update", "task_failed"] },
    "message": { "type": "string" },
    "planMarkdown": { "type": "string" },
    "inputType": { "type": "string", "enum": ["clarification", "hire_approval", "budget_increase"] },
    "metadata": { "type": "object" }
  },
  "required": ["type", "message"]
}
```

The routing schema (used by Tamir in `POST /api/tamir/route`):

```json
{
  "type": "object",
  "properties": {
    "department": { "type": "string", "enum": ["tech", "marketing", "operations"] },
    "reason": { "type": "string" },
    "suggestedAgent": { "type": "string", "enum": ["cto", "cmo", "coo"] }
  },
  "required": ["department", "reason", "suggestedAgent"]
}
```

Since the SDK guarantees valid JSON conforming to the schema, the backend simply calls `JSON.parse(result.resultText)`. There are no fallbacks, no regex, and no default values on parse failure -- those failure modes do not exist with structured output.

### Chat History: Filesystem JSONL

All chat history is stored as JSONL files on the filesystem, not in database JSON columns:

- **Planning chat**: `data/departments/{dept}/planning-desk/chat/{taskId}.jsonl`
- **Task/execution chat**: `data/departments/{dept}/tasks/{slug}/chat.jsonl`

Each line is a JSON object:
```json
{"role": "user", "content": "Find the ZUNA model...", "ts": "2026-03-24T10:00:00Z"}
{"role": "agent", "content": "{\"type\":\"ask_for_input\",\"message\":\"Which EEG bands...\"}", "ts": "2026-03-24T10:00:02Z"}
```

### Planning Desk vs Task Desk

Planning happens in the department head's **persistent planning desk**:
```
data/departments/{dept}/planning-desk/
  CLAUDE.md                  -- department planning context
  .claude/skills/            -- department skills (symlinked)
  chat/
    {taskId}.jsonl           -- planning conversation per task
```

On approval, a **new task desk** is created for execution:
```
data/departments/{dept}/tasks/{slug}/
  desk/                      -- agent's CWD during execution
  chat.jsonl                 -- execution conversation
  deliverables/              -- CEO-visible outputs
```

The `systemPrompt` preset ensures the agent loads `CLAUDE.md` from its desk automatically:
```typescript
// systemPrompt built internally by invokeAgent():
  // type: 'preset',
  // preset: 'claude_code',
  // append: soulContent -- handled by invokeAgent()
}
```

### A2A Task States

Standard states only -- no custom states:

| State | Meaning |
|-------|---------|
| `submitted` | Task created, not yet picked up |
| `working` | Agent is actively working (planning or executing) |
| `input-required` | Agent needs CEO input to proceed |
| `completed` | Task finished successfully |
| `failed` | Task failed |
| `canceled` | Task canceled by CEO |

Lifecycle stage (planning vs execution vs done) is **derived from timestamps**, not stored as an explicit phase:
- `approvedAt` is null --> planning
- `approvedAt` is set, `completedAt` is null --> execution
- `completedAt` is set --> done
- status is `failed` or `canceled` --> done

### API Contract: POST /api/tasks/{taskId}/message

| Field | Detail |
|-------|--------|
| **Request** | `{ message: string }` |
| **Response** | `{ state: TaskState, agent_id: string, turn: { type, message, planMarkdown?, inputType?, metadata? } }` |
| **Chat persistence** | Appends to `data/departments/{dept}/planning-desk/chat/{taskId}.jsonl`. Updates `sessionId`. Optionally stores plan artifact. Transitions task state. |
| **State transition** | `submitted -> working` (first message), `working -> input-required` (agent asks question), `input-required -> working` (CEO answers) |
| **Events emitted** | `task:transition` via eventBus |
| **Failure** | On SDK error: returns `{ state: 'working', agent_id, turn: { type: 'execution_update', message: 'Temporary error: ...' } }`. Does NOT transition to failed (transient errors are retryable). |

## How Tamir Gets Notified (Async)

Tamir is NOT in the planning loop. On major state changes, the system appends a structured JSONL line to `data/agents/tamir/inbox.jsonl` -- no LLM call, no agent invocation.

```typescript
// Called from transitionTask() on major state changes
async function notifyTamir(taskId: string, toState: TaskState) {
  if (!['working', 'completed', 'failed', 'canceled'].includes(toState)) return;

  const task = await db.task.findUnique({ where: { taskId } });
  if (!task) return;

  const event = {
    taskId,
    description: task.description.slice(0, 80),
    department: task.department,
    state: toState,
    budget: task.maxBudgetCents,
    ts: new Date().toISOString(),
  };
  appendFileSync('data/agents/tamir/inbox.jsonl', JSON.stringify(event) + '\n');
}
```

## Frontend State Machine

The frontend's behavior is entirely driven by the task state and structured `turn` from the API:

```typescript
// Simplified frontend logic
const { state, turn } = await postMessage(taskId, userMessage);

switch (state) {
  case 'input-required':
    appendAgentMessage(turn.message);
    break;

  case 'working':
    if (turn.type === 'plan_ready' && turn.planMarkdown) {
      appendAgentMessage(turn.message);
      openCanvasWithTypewriter(turn.planMarkdown);
    } else {
      appendAgentMessage(turn.message);
      showWorkingIndicator();
    }
    break;

  case 'completed':
    appendAgentMessage(turn.message);
    break;
}
```

No readiness signal detection. No question-mark matching. The SDK structured output tells the frontend exactly what to do.

## Typewriter Effect

```typescript
function openCanvasWithTypewriter(md: string) {
  document.getElementById('layout').classList.add('split');
  const el = document.getElementById('plan-rendered');
  const lines = md.split('\n');
  let i = 0, accumulated = '';

  function writeLine() {
    if (i >= lines.length) {
      document.getElementById('plan-editor').value = md;
      return;
    }
    accumulated += lines[i] + '\n';
    el.innerHTML = marked.parse(accumulated);
    el.closest('.canvas-pane').scrollTop = el.closest('.canvas-pane').scrollHeight;
    i++;
    setTimeout(writeLine, 40 + Math.random() * 30);
  }
  writeLine();
}
```
