# Acceptance Scenario C: Mode 1 Full Task Delegation

> Tests the hiring & delegation system per docs/17_HIRING_DELEGATION.md, Phase 1.

## Preconditions
- System is running (`pnpm dev`)
- System has been reset (POST /api/system/reset)
- At least one permanent employee exists in the tech department (seeded or hired)
- Worker loop is active

## Steps

### 1. Submit Task via Tamir
- Navigate to `/tamir`
- Type: "Build a REST API health check endpoint with uptime monitoring"
- Verify: Tamir routes to CTO / tech department
- Verify: Task created with `department = "tech"`

### 2. Planning Phase
- CTO (Amir) enters planning conversation
- CTO calls `list_my_employees` to check department roster
- Verify: Plan references employee capabilities
- Verify: CTO sets `metadata.recommendedExecutor` to an employee agentId

### 3. Check Executor Dropdown
- GET /api/tasks/{taskId}/employees
- Verify: Response has `employees` array with at least one entry
- Verify: Response has `recommendedExecutor` field (non-null)
- Verify: Response has `department` field equal to "tech"
- Verify: Department head (CTO) appears with `isHead: true`
- Verify: Non-executive employees appear with `isHead: false`

### 4. Approve with Executor Override
- POST /api/tasks/{taskId}/approve with `{ executorAgentId: employeeAgentId }`
- Verify: 200 response with `deliverableId` and `redirect`
- Verify: task.executorAgentId = employee's agentId (not the head)
- Verify: task.supervisorAgentId = head's agentId (CTO)
- Verify: task_run created with employee's DB id as employeeId
- Verify: task_run.workspaceCwd points to data/workspaces/{taskId}/desk/

### 5. Execution
- Worker claims the task_run and invokes the employee agent
- Verify: Employee executes in standard workspace at data/workspaces/{taskId}/desk/
- Verify: Build Log shows employee activity (not head)

### 6. Supervisor Review
- On employee completion, CTO reviews as supervisor
- Verify: Existing review flow works with employee as executor
- Verify: task.currentActorId switches to head during review

## Pass Criteria
- Employee executed the task (executorAgentId != supervisorAgentId)
- CTO supervised the task
- Executor dropdown returned correct department employees
- task_run.employeeId matches the selected employee's DB id
- Task completed through the standard pipeline with Mode 1 delegation
