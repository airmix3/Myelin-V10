# Acceptance Scenario E: Hiring Flow with CEO Approval

> Tests the hiring & delegation system per docs/17_HIRING_DELEGATION.md, Phase 3.

## Preconditions
- System is running (`pnpm dev`)
- System has been reset (POST /api/system/reset)
- Default config: hiring.tempAutoApprove = false (CEO must approve)

## Steps

### 1. Submit Task via Tamir
- Navigate to `/tamir`
- Type: "Build a machine learning pipeline for EEG classification"
- Verify: Tamir routes to CTO / tech department
- Verify: Task created with `department = "tech"`

### 2. Planning + Approve
- CTO plans the task, CEO approves with CTO as executor
- POST /api/tasks/{taskId}/approve (CTO is executor)
- Verify: task.state = "working", task_run queued for CTO

### 3. CTO Calls hire_employee
- During execution, CTO calls `hire_employee` with:
  - employee_name: "Data Scientist"
  - employee_role: "ML/Data Science Specialist"
  - justification: "Task requires specialized ML expertise for EEG pipeline"
  - type: "temp"
  - soul_draft: "You are a data scientist specializing in EEG/BCI data..."
  - specialty: "machine learning, EEG classification, signal processing"
  - output_types: ["code", "model", "analysis"]
- Verify: HireRequest created with status = "pending"
- Verify: Task transitions to "input-required"
- Verify: task.metadata has pendingHire with:
  - type: "temp"
  - soulDraft: non-empty
  - specialty: non-empty

### 4. CEO Sees Hire Request
- GET /api/escalations?status=pending or check task metadata
- Verify: Task shows inputType = "hire_approval"
- Verify: hireRequestId present in task metadata
- Verify: Hire request details accessible (employee name, role, justification)

### 5. CEO Approves Hire
- POST /api/hire_requests/{id}/approve
- Verify: Employee record created with:
  - capabilities JSON containing specialty and outputTypes
  - role: "temp"
  - status: "active"
  - agentId starts with "temp_"
  - toolWhitelist: JSON array of allowed tools
- Verify: orchestrator.register called (employee registered for runtime)
- Verify: Hire request status = "approved", resolvedAt set
- Verify: Task transitions back to "working"
- Verify: task.metadata updated with:
  - hireApproved: true
  - employeeAgentId: matches created employee's agentId
  - subagentDefinition: non-empty object
- Verify: New task_run queued for CTO with:
  - sessionId: CTO's saved session (for resume)
  - agents: JSON containing subagent definition

### 6. CTO Resumes with Subagent
- Worker claims new CTO task_run, re-invokes CTO
- Verify: task.metadata has hireApproved = true
- Verify: task.metadata has employeeAgentId
- Verify: task.metadata has subagentDefinition

### 7. CTO Can Delegate to New Employee
- CTO calls `list_my_employees`
- Verify: New temp employee appears in roster
- Verify: Employee has correct specialty from hire request
- Verify: Employee status = "active"

### 8. Task Completes
- CTO completes the task (possibly after delegating to the temp)
- Verify: Temp employee status set to "terminated" (temp cleanup per doc 17)
- Verify: Terminated temp does not appear in list_my_employees results
- Verify: Task state = "completed"

## Pass Criteria
- Full hire lifecycle completed: request -> CEO approval -> employee creation -> available for delegation
- Employee record has capabilities JSON with correct specialty and outputTypes
- orchestrator registration happened (agentId starts with "temp_")
- Temp employee cleanup on task completion (status = "terminated")
- Task transitioned correctly: working -> input-required -> working -> completed
