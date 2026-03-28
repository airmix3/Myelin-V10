# 09 -- End-to-End Task Scenarios (6 Walkthroughs)

## Purpose

These scenarios show exactly what happens at every step when the CEO initiates a task via the Cortex. They cover: routing, A2A task handoff, direct dept-head planning, employee hiring, cross-department consultation, and error handling.

## How Tamir Routes (LLM-Based, Not Keywords)

Tamir does NOT use keyword matching. He uses his own LLM reasoning to decide which department should handle a task. His context includes:

1. **Company DNA** -- The organization configuration document from the vault (created during onboarding). This describes:
   - Each department's name, purpose, and responsibilities
   - The department head and their specialties
   - What kinds of tasks each department handles
   - Any custom departments the CEO has created

2. **Agent Cards** -- Each dept head's declared skills (structured, but used as context, not as keyword lists)

3. **His own reasoning** -- Tamir reads the CEO's request, considers the company structure, and decides which department head is the best fit. This is a full LLM call, not string matching.

```typescript
// Tamir's routing is an LLM call, not a score
const routingContext = `
You are Tamir, Chief of Staff at Myelin.

Company organization (from vault):
${companyDNA.departments.map(d => `- ${d.name}: ${d.description}. Head: ${d.head}. Handles: ${d.responsibilities}`).join('\n')}

Agent capabilities:
${Object.values(AGENT_CARDS).map(c => `- ${c.name}: ${c.skills.map(s => s.name).join(', ')}`).join('\n')}

CEO's request: "${ceoMessage}"

Which department should handle this? Respond with ONLY the department id (tech, marketing, or operations) and a one-sentence reason.
`;

const routing = await orch.invoke("tamir", ceoMessage, { extraSystemPrompt: routingContext, outputFormat: routingSchema });
// Returns structured output: { department: "tech", reason: "EEG model evaluation and AWS deployment is CTO's domain." }
```

This means:
- If the CEO adds a new department (e.g., "Legal"), Tamir will route to it after the company DNA is updated
- Tamir can reason about ambiguous requests (e.g., "make a technical blog post" could be marketing OR tech -- Tamir decides based on context)
- No hardcoded keyword lists to maintain

---

## Scenario 1: Technical Research (CTO)

**CEO Request**: "I saw a new ZUNA EEG foundation model on Twitter. Find it, deploy on our AWS, test it with our lab EEG scans. Remove one electrode, predict it, compare to ground truth."

### Step-by-step:

1. **CEO** types message in Tamir chat (/tamir)
2. **POST /api/tamir/route** -- Tamir's LLM reads request + company DNA
3. **Tamir** decides: "tech -- EEG model evaluation and AWS deployment is CTO's domain"
4. **A2A Task created**: `{ taskId: task_a1b2, contextId: ctx_xyz, planningAgentId: cto, supervisorAgentId: cto, currentActorId: cto, status: submitted }`
5. **Response to frontend**: `{ taskId, contextId, department: 'tech', tamir_response: "Technical task. Routing to CTO." }`
6. **UI**: Buttons appear: [Plan with CTO] [Plan with Tamir]
7. **CEO** clicks "Plan with CTO"
8. **Frontend switches endpoint** to `POST /api/tasks/task_a1b2/message` -- now talking directly to CTO
9. **CTO** responds (blue avatar): "Hey Omer. Two quick questions: 1) Which lab EEG scans? 2) Budget ceiling for the GPU instance?"
   - API returns: `{ state: 'input-required', agent_id: 'cto', turn: { type: 'ask_for_input', message: '...' } }`
10. **CEO** types: "Internal recordings from last month. Budget up to $200."
11. **POST /api/tasks/task_a1b2/message** -- goes directly to CTO (Tamir not involved)
12. **CTO** is satisfied. API returns: `{ state: 'working', agent_id: 'cto', turn: { type: 'plan_ready', message: 'Plan ready for review.', plan_markdown: '## Task: ZUNA EEG Evaluation...' } }`
13. **Canvas opens** with typewriter animation rendering the plan
14. **CEO** adjusts autonomy to "High", keeps budget at $200
15. **CEO** clicks "Approve & Execute"
16. **POST /api/tasks/task_a1b2/approve**
    - Task workspace created: `data/departments/tech/tasks/zuna-evaluation-task_a1b2/`
    - Deliverable record created (plan + chat history in metadata)
    - Task status: `working` (execution begins)
    - **Tamir notified asynchronously**: saves summary `{ title, dept, budget, autonomy }`
17. **Redirect** to /deliverables/deliv_xxxx
18. **Execution** (background):
    - CTO delegates to a temp "data_scientist" employee
    - Hire request created -> task pauses (`input-required`) if CEO approval needed
    - Employee provisioned, works in `desk/` (native SDK tools, cwd = desk)
    - Employee promotes final report + charts to `deliverables/`
    - Supervisor reviews (task stays `working`, `currentActorId` = supervisor): reads deliverables, checks against CEO's original request and plan
      - If satisfactory: supervisor approves -> task status: `completed`
      - If needs work: supervisor sends feedback to employee -> `currentActorId` back to executor, task stays `working`
    - Tamir notified asynchronously on completion
19. **Deliverable workspace**: build log (live), deliverables/ files (CEO view), desk/ (collapsible)

---

## Scenario 2: Content Creation (CMO)

**CEO Request**: "Create a YouTube script about running a one-man AI company. Make it technical but accessible. 10-minute video."

### Step-by-step:

1. **CEO** types in Tamir chat (/tamir)
2. **POST /api/tamir/route** -- Tamir reasons: "marketing -- Content creation and video scripting is CMO's domain"
3. **A2A Task created**: `{ taskId: task_c3d4, contextId: ctx_abc, planningAgentId: cmo, supervisorAgentId: cmo, currentActorId: cmo }`
4. **CEO** clicks "Plan with CMO"
5. **Frontend switches** to `POST /api/tasks/task_c3d4/message`
6. **CMO** (pink avatar) greets, asks: "Any specific angle? And should I include B-roll notes?"
   - API returns: `{ state: 'input-required', agent_id: 'cmo', turn: { type: 'ask_for_input', message: '...' } }`
7. **CEO**: "Focus on the AI agents doing real work. Yes include B-roll."
8. **POST /api/tasks/task_c3d4/message** -> CMO generates plan
   - API returns: `{ state: 'working', agent_id: 'cmo', turn: { type: 'plan_ready', message: 'Plan ready for review.', plan_markdown: '...' } }`
9. **Canvas opens** -> CEO approves
10. **POST /api/tasks/task_c3d4/approve** -> CMO executes directly or hires a temp content writer
11. **CMO (or temp employee)** writes script using native web search
12. **Deliverable**: 10-minute script with timestamps, hooks, B-roll notes

---

## Scenario 3: Cross-Department Consultation (CMO asks CTO)

**Context**: CMO is executing a developer advocacy task and needs technical specs.

**How consultation works**: `consult_agent` is a tool wrapper around A2A. When an agent calls it, the tool creates an A2A Task (same protocol as CEO -> dept head), sends the message to the target agent, and returns the response. The calling agent's LLM sees it as a normal tool call that takes a question and returns an answer. Multi-turn works via the same `contextId`.

### Step-by-step:

1. **CEO** request: "Plan a developer tutorial series showing BDaS integration with popular EEG headsets"
2. **Tamir** routes to CMO -> A2A Task created -> CEO plans directly with CMO, approves
3. **During execution**, CMO's LLM decides it needs hardware specs
4. **CMO's LLM** calls tool: `consult_agent("cto", "Which 3 EEG headsets should we prioritize? Need: price, SDK quality, community size.")`
5. **Under the hood**: A2A Task created `{ taskId: consult_xx, fromAgent: cmo, toAgent: cto, status: submitted }`
6. **CTO's agent** receives the message via `POST /api/tasks/consult_xx/message` (same mechanism as CEO -> agent)
7. **CTO** responds: "Top 3: 1) OpenBCI Cyton ($999, excellent Python SDK) 2) Muse 2 ($250, good JS SDK) 3) Emotiv Insight ($299). Need comparison tables?"
8. **CTO asked a follow-up** -> consultation A2A status: `input-required` -> tool returns question to CMO
9. **CMO's LLM** calls `consult_agent("cto", "Yes, include SDK language support and latency specs")` (same contextId)
10. **CTO** provides detailed table -> consultation A2A status: `completed` -> tool returns table to CMO
11. **CMO** uses the specs in the tutorial deliverable

**Key point**: The entire consultation uses the same A2A task infrastructure as CEO -> dept head planning. `consult_agent` is just the entry point for agent-initiated (vs CEO-initiated) tasks.

---

## Scenario 4: Operations Planning (COO)

**CEO Request**: "Create a 12-week MVP launch timeline. Include EEG pipeline, API, compliance review, and beta launch."

1. **POST /api/tamir/route** -- Tamir: "operations -- Project planning and timelines is COO's domain"
2. **A2A Task created**: `{ taskId: task_e5f6, planningAgentId: coo, supervisorAgentId: coo, currentActorId: coo }`
3. **CEO** clicks "Plan with COO"
4. **Frontend switches** to `POST /api/tasks/task_e5f6/message`
5. **COO** (green avatar) asks: "Priority order? And do we have legal counsel for compliance?"
   - API: `{ state: 'input-required', turn: { type: 'ask_for_input', message: '...' } }`
6. **CEO**: "Pipeline first, then API. No legal counsel -- add as dependency."
7. **COO** generates plan with timeline, dependencies, milestones
   - API: `{ state: 'working', turn: { type: 'plan_ready', message: 'Plan ready for review.', plan_markdown: '...' } }`
8. **CEO** approves -> `POST /api/tasks/task_e5f6/approve`
9. Deliverable: full project plan with Gantt-style layout

---

## Scenario 5: Employee Hiring Flow

**Context**: CTO needs a specialized ML researcher during task execution.

1. **CTO** is executing a task (status: `working`)
2. **CTO** calls tool: `hire_request("Dr. Neural", "ML Researcher", "EEG foundation models")`
3. **Hire request** stored in DB: status `pending`
4. **Task status** -> `input-required` (waiting for CEO approval)
5. **Cortex** shows notification: hire request pending in deliverable workspace build log
6. **CEO** sees in build log: "HIRE_REQUEST: CTO requests ML Researcher for EEG model eval"
7. **CEO** approves via Cortex UI (approve button on hire request)
8. **Employee provisioned**: SDK AgentDefinition created with soul prompt, cwd set to task's desk
9. **Task resumes**: status -> `working`
10. **Employee executes** using native SDK tools in desk
11. **Employee terminated** after deliverable produced, session archived

---

## Scenario 6: Error Recovery

**Context**: Bedrock returns 503 during task execution.

1. **Agent** calls Claude -> 503 Service Unavailable
2. **Agent SDK** catches error -> retries with exponential backoff (2s, 4s, 8s)
3. **If all 3 retries fail**:
   - Task status -> `failed`
   - Activity log: "EXECUTION_ERROR: LLM API unavailable after 3 retries"
   - Tamir notified asynchronously
   - Build log in deliverable workspace shows the error
4. **CEO** sees failure in Cortex (build log + task status badge)
5. **CEO** can retry from deliverable workspace chat
6. **If budget exceeded during execution**:
   - Agent receives "Budget exceeded" instead of LLM response (SDK `maxBudgetUsd` option)
   - Task status -> `input-required` (needs budget increase)
   - CEO sees in build log, can increase budget via task config and resume

---

## Common Patterns Across All Scenarios

| Pattern | Implementation |
|---------|---------------|
| Routing | Tamir uses LLM reasoning + company DNA (not keywords) via `POST /api/tamir/route`. Structured output for routing decisions (not keyword matching or regex). |
| Handoff | A2A Task created, frontend switches to `POST /api/tasks/{id}/message` (direct to dept head) |
| Tamir's role | Route ONCE, then passive. Notified async on major state changes. Cron invoked every 15 minutes. |
| Planning | CEO <-> planning agent directly. Backend uses SDK `outputFormat` structured output for turn routing (not keyword matching or regex). |
| Approval | `POST /api/tasks/{id}/approve` creates workspace + deliverable, starts execution |
| Execution | Agent works in desk/ (native SDK cwd), promotes to deliverables/. Multiple tasks execute concurrently. |
| State tracking | Standard A2A states only: submitted, working, input-required, completed, failed, canceled |
| Supervisor check | When executor finishes, `currentActorId` switches to supervisor. Supervisor checks against plan + CEO request. Task stays `working` throughout -- no separate review state. |
| Chat continuity | Planning chat stored in filesystem JSONL, restored in workspace view |
| Cost tracking | Every LLM call logged with token count and cost |
| CEO briefing | Tamir saves project summary async (viewable in Org Context) |
