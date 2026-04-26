/**
 * Acceptance tests for Hiring & Delegation system (doc 17, Phases 1-3).
 * Tests API endpoints and DB state against http://localhost:3011.
 *
 * Does NOT invoke real LLM agents -- creates records directly and tests
 * API endpoint contracts, DB state, and wiring.
 *
 * Run: npx tsx tests/acceptance/test-hiring-delegation.ts
 */

const BASE = 'http://localhost:3011';

let passed = 0;
let failed = 0;
const results: { name: string; status: 'PASS' | 'FAIL'; detail?: string }[] = [];

function assert(condition: boolean, name: string, detail?: string) {
  if (condition) {
    passed++;
    results.push({ name, status: 'PASS' });
    console.log(`  [PASS] ${name}`);
  } else {
    failed++;
    results.push({ name, status: 'FAIL', detail });
    console.log(`  [FAIL] ${name}${detail ? ` -- ${detail}` : ''}`);
  }
}

async function fetchJson(path: string, options?: RequestInit) {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options?.headers },
  });
  const body = await res.json();
  return { status: res.status, body };
}

// ---------------------------------------------------------------------------
// Test 1: System Reset
// ---------------------------------------------------------------------------
async function testSystemReset() {
  console.log('\n--- Test 1: System Reset ---');
  const { status, body } = await fetchJson('/api/system/reset', { method: 'POST' });
  assert(status === 200, 'Reset returns 200', `got ${status}`);
  assert(body.success === true, 'Reset body has success=true', JSON.stringify(body));
}

// ---------------------------------------------------------------------------
// Test 2: Employee Seeding
// ---------------------------------------------------------------------------
async function testEmployeeSeeding() {
  console.log('\n--- Test 2: Employee Seeding ---');

  // Use a direct task query trick: create a temporary tech task to access employees endpoint
  // First, let's verify the seeded employees exist by creating a minimal task
  // and hitting the employees endpoint.

  // Insert a test task directly via the system -- we'll use a custom test endpoint
  // Alternative: just hit a known task-independent way to check employees.
  // The employees endpoint requires a taskId, so we need to create a task first.

  // Create a minimal task by inserting directly via a test helper approach:
  // POST to a special endpoint or use the existing task creation path.
  // Since Tamir routing needs LLM, we'll create the task via a workaround.

  // Let's check employees by creating a task and using the employees endpoint.
  const taskId = `test_task_${Date.now()}`;

  // We need to insert a task record. Let's do it via the system reset + direct creation.
  // Use POST /api/system/reset first, then we need another way to insert a task.
  // The cleanest way: hit GET /api/tasks/{fakeId}/employees which just needs a task with a department.

  // For now, check that we can at least access the API by testing with a non-existent task
  const { status, body } = await fetchJson(`/api/tasks/nonexistent/employees`);
  assert(status === 404, 'Employees endpoint returns 404 for missing task', `got ${status}`);

  // We'll verify seeding as part of Test 3 where we create a real task
  console.log('  (Full seeding verification in Test 3 with real task)');
}

// ---------------------------------------------------------------------------
// Test 3: Create Test Task + Employees Endpoint
// ---------------------------------------------------------------------------
let testTaskId: string | null = null;

async function testCreateTaskAndEmployeesEndpoint() {
  console.log('\n--- Test 3: Create Test Task + Employees Endpoint ---');

  // We cannot use Tamir routing (requires LLM), so we create a task record
  // by calling a workaround: POST to /api/tasks/{taskId}/message also requires LLM.
  // Instead, create the task via a direct approach using system internals.
  //
  // Approach: We'll POST to a known endpoint that creates tasks as a side effect.
  // Since no such simple endpoint exists, we'll test the employees endpoint
  // by manually inserting a task via a fetch to our "test helper" -- actually,
  // let's take a different approach: import and use the DB directly.
  //
  // Better approach for a fetch-only test: Use POST /api/tamir/route which
  // creates a task even if routing fails. But it needs LLM.
  //
  // Pragmatic approach: POST to /api/system/reset, then use SQLite WAL to
  // insert a task. But we can't run SQL from fetch.
  //
  // Best approach: Create a minimal test helper API endpoint.
  // BUT -- we're testing existing endpoints. Let's just test what we can.

  // We'll create a task by directly using the test helper we'll add:
  // POST /api/test/create-task
  //
  // Actually, let's test by inserting a task via the existing flow:
  // We can check if a task exists from a previous run, or we can test
  // the employees endpoint behavior with edge cases.

  // PRAGMATIC: Use POST /api/test/seed-test-task (we'll create this route)
  // OR: Just test with the 4 seeded employees through an alternative path.

  // Let's use an alternative: check the employees via a GET /api/org-graph
  // or similar. But that doesn't exist.

  // Final approach: create a helper in this script that hits multiple endpoints
  // to set up state. Create task via POST body to a new lightweight endpoint.

  // Since we can't create tasks without LLM, let's create a temporary
  // test-only helper endpoint. BUT that modifies the codebase.
  //
  // DECISION: Create a test helper API route at /api/test/seed-task
  // that inserts a test task record without LLM. This is acceptable
  // for acceptance testing infrastructure.

  const { status, body } = await fetchJson('/api/test/seed-task', {
    method: 'POST',
    body: JSON.stringify({
      title: 'Test task for delegation acceptance tests',
      department: 'tech',
      description: 'A test task to validate hiring and delegation APIs',
    }),
  });

  if (status !== 200) {
    assert(false, 'Seed test task', `Got ${status}: ${JSON.stringify(body)}`);
    return;
  }

  testTaskId = body.taskId;
  assert(!!testTaskId, 'Test task created', `taskId: ${testTaskId}`);

  // Now test the employees endpoint
  const empRes = await fetchJson(`/api/tasks/${testTaskId}/employees`);
  assert(empRes.status === 200, 'Employees endpoint returns 200', `got ${empRes.status}`);

  const empBody = empRes.body;
  assert(Array.isArray(empBody.employees), 'Response has employees array', typeof empBody.employees);
  assert(empBody.department === 'tech', 'Department is tech', `got ${empBody.department}`);
  assert(empBody.recommendedExecutor !== undefined, 'Has recommendedExecutor field');

  // Check that CTO (head) appears with isHead=true
  const headEntry = empBody.employees?.find((e: Record<string, unknown>) => e.isHead === true);
  assert(!!headEntry, 'Department head appears with isHead=true', JSON.stringify(empBody.employees));
  assert(headEntry?.agentId === 'cto', 'Head agentId is cto', `got ${headEntry?.agentId}`);
}

// ---------------------------------------------------------------------------
// Test 4: Approve with Executor Override (Mode 1)
// ---------------------------------------------------------------------------
let testDeliverableId: string | null = null;

async function testApproveWithExecutorOverride() {
  console.log('\n--- Test 4: Approve with Executor Override ---');

  if (!testTaskId) {
    assert(false, 'Skip - no test task', 'Task creation failed in Test 3');
    return;
  }

  // First transition the task to a state where approval works.
  // The approve endpoint expects the task to exist and have a planMarkdown.
  // We need to update the task to have planMarkdown set.
  const setupRes = await fetchJson('/api/test/update-task', {
    method: 'POST',
    body: JSON.stringify({
      taskId: testTaskId,
      planMarkdown: '# Test Plan\n\nBuild a health check endpoint.',
      state: 'working',
      planningAgentId: 'cto',
      executorAgentId: 'cto',
    }),
  });

  if (setupRes.status !== 200) {
    assert(false, 'Setup task for approval', `Got ${setupRes.status}: ${JSON.stringify(setupRes.body)}`);
    return;
  }

  // Approve with CTO as executor (head executor, not an override to employee)
  const approveRes = await fetchJson(`/api/tasks/${testTaskId}/approve`, {
    method: 'POST',
    body: JSON.stringify({ executorAgentId: 'cto' }),
  });

  assert(approveRes.status === 200, 'Approve returns 200', `got ${approveRes.status}: ${JSON.stringify(approveRes.body)}`);
  assert(!!approveRes.body.deliverableId, 'Response has deliverableId', JSON.stringify(approveRes.body));
  assert(!!approveRes.body.redirect, 'Response has redirect', JSON.stringify(approveRes.body));

  testDeliverableId = approveRes.body.deliverableId;

  // Verify task state via GET
  const taskRes = await fetchJson(`/api/tasks/${testTaskId}`);
  assert(taskRes.status === 200, 'Task GET returns 200');

  // Check that a task_run was created
  // We can verify indirectly through the task metadata (approvedAt should be set)
  const meta = taskRes.body.metadata;
  assert(!!meta?.approvedAt, 'Task metadata has approvedAt', JSON.stringify(meta));
  assert(meta?.deliverableId === testDeliverableId, 'Task metadata has correct deliverableId');
}

// ---------------------------------------------------------------------------
// Test 5: Hire Request Creation + Approval
// ---------------------------------------------------------------------------
let testHireRequestId: string | null = null;
let hiredEmployeeId: string | null = null;
let hiredAgentId: string | null = null;

async function testHireRequestApproval() {
  console.log('\n--- Test 5: Hire Request + CEO Approval ---');

  if (!testTaskId) {
    assert(false, 'Skip - no test task', 'Task creation failed in Test 3');
    return;
  }

  // Create a hire request via the test helper (simulates what hire_employee tool does)
  const hireSetupRes = await fetchJson('/api/test/create-hire-request', {
    method: 'POST',
    body: JSON.stringify({
      taskId: testTaskId,
      requestedBy: 'cto',
      employeeName: 'Test Data Scientist',
      employeeRole: 'ML/Data Science Specialist',
      justification: 'Need ML expertise for test',
      pendingHire: {
        type: 'temp',
        soulDraft: 'You are a test data scientist.',
        specialty: 'machine learning, testing',
        outputTypes: ['code', 'analysis'],
      },
    }),
  });

  if (hireSetupRes.status !== 200) {
    assert(false, 'Create hire request', `Got ${hireSetupRes.status}: ${JSON.stringify(hireSetupRes.body)}`);
    return;
  }

  testHireRequestId = hireSetupRes.body.hireRequestId;
  assert(!!testHireRequestId, 'Hire request created', `id: ${testHireRequestId}`);

  // Approve the hire request
  const approveRes = await fetchJson(`/api/hire_requests/${testHireRequestId}/approve`, {
    method: 'POST',
  });

  assert(approveRes.status === 200, 'Hire approve returns 200', `got ${approveRes.status}: ${JSON.stringify(approveRes.body)}`);
  assert(approveRes.body.success === true, 'Hire approve success=true');
  assert(!!approveRes.body.employeeId, 'Response has employeeId');
  assert(!!approveRes.body.agentId, 'Response has agentId');

  hiredEmployeeId = approveRes.body.employeeId;
  hiredAgentId = approveRes.body.agentId;

  // Verify agentId starts with "temp_"
  assert(
    typeof hiredAgentId === 'string' && hiredAgentId.startsWith('temp_'),
    'Agent ID starts with temp_',
    `got ${hiredAgentId}`,
  );

  // Verify task metadata updated with hire info
  const taskRes = await fetchJson(`/api/tasks/${testTaskId}`);
  const meta = taskRes.body.metadata;
  assert(meta?.hireApproved === true, 'Task metadata has hireApproved=true', JSON.stringify(meta?.hireApproved));
  assert(meta?.employeeAgentId === hiredAgentId, 'Task metadata has correct employeeAgentId');
  assert(!!meta?.subagentDefinition, 'Task metadata has subagentDefinition');

  // Verify hire request status
  // (no direct GET endpoint for hire requests, so check via task's hireRequests)
  // The task GET endpoint includes hireRequests with status='pending'
  // Since we just approved it, it won't appear in pending anymore.
  // We can check that the task's state went back to "working"
  assert(taskRes.body.state === 'working', 'Task state back to working after hire approval', `got ${taskRes.body.state}`);
}

// ---------------------------------------------------------------------------
// Test 6: Employees Endpoint Shows Hired Employee
// ---------------------------------------------------------------------------
async function testEmployeesShowHired() {
  console.log('\n--- Test 6: Hired Employee in Roster ---');

  if (!testTaskId || !hiredAgentId) {
    assert(false, 'Skip - no hired employee', 'Previous tests failed');
    return;
  }

  const empRes = await fetchJson(`/api/tasks/${testTaskId}/employees`);
  assert(empRes.status === 200, 'Employees endpoint returns 200');

  const employees = empRes.body.employees || [];
  const hiredEmp = employees.find((e: Record<string, unknown>) => e.agentId === hiredAgentId);
  assert(!!hiredEmp, 'Hired employee appears in employees list', `looking for ${hiredAgentId}`);
  assert(hiredEmp?.isHead === false, 'Hired employee is not head');
}

// ---------------------------------------------------------------------------
// Test 7: Cancellation Cascade
// ---------------------------------------------------------------------------
async function testCancellationCascade() {
  console.log('\n--- Test 7: Cancellation Cascade ---');

  if (!testTaskId) {
    assert(false, 'Skip - no test task', 'Task creation failed');
    return;
  }

  // The cancel endpoint should cancel the task AND all its runs.
  // First, let's check that there are queued/executing runs for the task.
  const cancelRes = await fetchJson(`/api/tasks/${testTaskId}/cancel`, {
    method: 'POST',
  });

  assert(cancelRes.status === 200, 'Cancel returns 200', `got ${cancelRes.status}: ${JSON.stringify(cancelRes.body)}`);
  assert(cancelRes.body.success === true, 'Cancel success=true');

  // Per doc 17: cancel should cascade to all task_runs
  // The response should include canceledRuns count
  assert(
    cancelRes.body.canceledRuns !== undefined,
    'Cancel response includes canceledRuns count',
    JSON.stringify(cancelRes.body),
  );

  // Verify task state is now canceled
  const taskRes = await fetchJson(`/api/tasks/${testTaskId}`);
  assert(taskRes.body.state === 'canceled', 'Task state is canceled', `got ${taskRes.body.state}`);
}

// ---------------------------------------------------------------------------
// Test 8: System Reset Terminates Temp Employees
// ---------------------------------------------------------------------------
async function testResetTerminatesTemps() {
  console.log('\n--- Test 8: Reset Terminates Temp Employees ---');

  // We already have a temp employee from Test 5 (hired via the approve endpoint)
  // After system reset, temp employees should be terminated.
  const { status, body } = await fetchJson('/api/system/reset', { method: 'POST' });
  assert(status === 200, 'Reset returns 200');
  assert(body.summary?.tempsTerminated >= 1, 'At least 1 temp terminated', `got ${body.summary?.tempsTerminated}`);

  // Verify the temp employee no longer shows in employees endpoint
  // We need a task in tech department to check. Create one.
  const taskRes = await fetchJson('/api/test/seed-task', {
    method: 'POST',
    body: JSON.stringify({
      title: 'Post-reset verification task',
      department: 'tech',
      description: 'Verify temp cleanup',
    }),
  });

  if (taskRes.status === 200) {
    const empRes = await fetchJson(`/api/tasks/${taskRes.body.taskId}/employees`);
    const employees = empRes.body.employees || [];
    const tempEmp = employees.find((e: Record<string, unknown>) =>
      typeof e.agentId === 'string' && (e.agentId as string).startsWith('temp_')
    );
    assert(!tempEmp, 'No temp employees in roster after reset');
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  console.log('=== Hiring & Delegation Acceptance Tests ===');
  console.log(`Target: ${BASE}`);
  console.log(`Time: ${new Date().toISOString()}`);

  try {
    await testSystemReset();
    await testEmployeeSeeding();
    await testCreateTaskAndEmployeesEndpoint();
    await testApproveWithExecutorOverride();
    await testHireRequestApproval();
    await testEmployeesShowHired();
    await testCancellationCascade();
    await testResetTerminatesTemps();
  } catch (err) {
    console.error('\n[FATAL] Test execution error:', err);
    failed++;
  }

  console.log('\n=== Summary ===');
  console.log(`Total: ${passed + failed} tests`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);

  if (failed > 0) {
    console.log('\nFailed tests:');
    for (const r of results.filter(r => r.status === 'FAIL')) {
      console.log(`  - ${r.name}: ${r.detail || 'no detail'}`);
    }
  }

  process.exit(failed > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(2);
});
