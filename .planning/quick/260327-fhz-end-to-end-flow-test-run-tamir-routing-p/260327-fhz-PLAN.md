---
phase: quick
plan: 260327-fhz
type: execute
wave: 1
depends_on: []
files_modified:
  - .planning/quick/260327-fhz-end-to-end-flow-test-run-tamir-routing-p/260327-fhz-SUMMARY.md
autonomous: false
requirements: [E2E-TEST]
must_haves:
  truths:
    - "Dev server responds at http://localhost:3011"
    - "CEO can submit a task and Tamir routes it with department buttons"
    - "Clicking a department button opens planning session"
    - "Agent responds with a plan visible on canvas"
    - "Approving the plan creates a task_run for worker execution"
  artifacts:
    - path: ".planning/quick/260327-fhz-end-to-end-flow-test-run-tamir-routing-p/260327-fhz-SUMMARY.md"
      provides: "End-to-end test report with pass/fail per step and screenshots"
---

<objective>
Run a comprehensive end-to-end browser test of the Myelin v10 Cortex system using agent-browser to verify the full CEO task flow works after overnight fixes.

Purpose: Validate that the complete user journey (submit task -> Tamir routing -> planning session with split-pane canvas -> approval -> worker execution) functions correctly.
Output: Test report with screenshots at each milestone and pass/fail status per step.
</objective>

<execution_context>
@/home/omersh/myelin-gsd/.claude/get-shit-done/workflows/execute-plan.md
@/home/omersh/myelin-gsd/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.claude/skills/agent-browser/SKILL.md
@src/app/tamir/page.tsx
@src/app/page.tsx
</context>

<tasks>

<task type="auto">
  <name>Task 1: End-to-end browser test of full CEO task flow</name>
  <files>.planning/quick/260327-fhz-end-to-end-flow-test-run-tamir-routing-p/screenshots/</files>
  <action>
Use agent-browser to test the full Myelin v10 Cortex flow. Create a screenshots directory first at `.planning/quick/260327-fhz-end-to-end-flow-test-run-tamir-routing-p/screenshots/`.

**Step 0: Health check**
- Run `curl -s -o /dev/null -w "%{http_code}" http://localhost:3011` to verify the dev server is running. If not 200, STOP and report server is down.

**Step 1: Dashboard load**
- `agent-browser open http://localhost:3011` then `agent-browser wait --load networkidle`
- Take screenshot: `agent-browser screenshot .planning/quick/260327-fhz-end-to-end-flow-test-run-tamir-routing-p/screenshots/01-dashboard.png`
- `agent-browser snapshot -i` to verify dashboard elements render (stats cards, agent list, activity feed)

**Step 2: Navigate to Tamir page**
- Navigate to `http://localhost:3011/tamir`
- Wait for networkidle, take screenshot: `02-tamir-page.png`
- Snapshot to find the chat input. The placeholder is "What would you like to get done?"

**Step 3: Submit a test task to Tamir**
- Find the chat input element via snapshot refs
- Fill with a test message like: "Write a brief competitive analysis of Neuralink vs other BCI companies"
- Find and click the send button
- Wait for response (use `agent-browser wait 15000` to allow for Tamir LLM routing call, then `agent-browser wait --load networkidle`)
- Take screenshot: `03-tamir-routing-response.png`
- Snapshot to verify: Tamir's response message appears AND routing buttons are visible (buttons for department heads like CTO, CMO, COO)

**Step 4: Click a department head button**
- From snapshot, identify the routing buttons (they should be visible in the chat area)
- Click the CTO button (or whichever department head button is available for this task type)
- Wait for agent response (use `agent-browser wait 30000` for the planning LLM call, then `agent-browser wait --load networkidle`)
- Take screenshot: `04-planning-response.png`
- Snapshot to check: the split-pane layout should now be visible (40% chat / 60% canvas), OR at minimum the agent's planning response should appear in chat

**Step 5: Check canvas / plan display**
- If the plan_ready turn was returned, the canvas panel should be visible with the plan markdown
- Take screenshot: `05-canvas-plan.png`
- Snapshot to verify canvas content is rendering
- If no canvas visible yet (agent asked a clarifying question instead of plan_ready), take a screenshot of the current state and note this in the report -- this is expected behavior since the agent may need multiple turns

**Step 6: Approve the plan (if plan is ready)**
- If canvas is showing with an "Approve" button visible, click it
- Wait for redirect (approval redirects to dashboard or task detail page)
- Take screenshot: `06-post-approval.png`
- If no approve button (agent still in planning turns), note this in report as expected

**Step 7: Verify worker pickup**
- After approval, check the database for the task_run record:
  `curl -s http://localhost:3011/api/tasks | head -100` or check via the dashboard UI
- Take a final screenshot: `07-final-state.png`

**Important notes:**
- Between each major step, always re-snapshot (`agent-browser snapshot -i`) to get fresh refs
- If any step fails, capture a screenshot of the failure state and continue to the next step
- The Tamir routing call and planning call both invoke real LLM calls via AWS Bedrock, so expect 10-30 second waits
- Close the browser session when done: `agent-browser close`

Record pass/fail for each step along with observations.
  </action>
  <verify>
Screenshots exist in the screenshots directory AND the test completed all reachable steps without crashing.
  </verify>
  <done>All 7 steps attempted, screenshots captured at each milestone, pass/fail determined for each step.</done>
</task>

<task type="auto">
  <name>Task 2: Write test report summary</name>
  <files>.planning/quick/260327-fhz-end-to-end-flow-test-run-tamir-routing-p/260327-fhz-SUMMARY.md</files>
  <action>
Based on the results from Task 1, write a comprehensive test report to the SUMMARY file. Structure it as:

```markdown
---
phase: quick
plan: 260327-fhz
status: {completed|partial|failed}
started: {ISO timestamp}
completed: {ISO timestamp}
---

# End-to-End Flow Test Report

## Overview
- **Date:** 2026-03-27
- **Server:** http://localhost:3011
- **Test:** Full CEO task flow (submit -> route -> plan -> approve -> execute)

## Results

| Step | Description | Status | Notes |
|------|-------------|--------|-------|
| 0 | Server health check | PASS/FAIL | {details} |
| 1 | Dashboard load | PASS/FAIL | {details} |
| 2 | Tamir page load | PASS/FAIL | {details} |
| 3 | Task submission + Tamir routing | PASS/FAIL | {details} |
| 4 | Department head selection + planning | PASS/FAIL | {details} |
| 5 | Canvas/plan display | PASS/FAIL | {details} |
| 6 | Plan approval | PASS/FAIL/SKIPPED | {details} |
| 7 | Worker pickup | PASS/FAIL/SKIPPED | {details} |

## Overall Result
{PASS if steps 0-4 pass, PARTIAL if some pass, FAIL if steps 0-2 fail}

## Screenshots
{List all captured screenshots with brief description}

## Issues Found
{Any bugs, UI issues, or unexpected behaviors observed}

## Recommendations
{Any follow-up fixes needed}
```

Fill in actual results from the test run. Be honest about failures -- the purpose is to find issues, not produce a passing report.
  </action>
  <verify>File exists at .planning/quick/260327-fhz-end-to-end-flow-test-run-tamir-routing-p/260327-fhz-SUMMARY.md with all steps documented.</verify>
  <done>Test report written with pass/fail for each step, screenshots referenced, and any issues documented.</done>
</task>

</tasks>

<verification>
- Screenshots directory contains at least 3 screenshots (dashboard, tamir page, routing response)
- SUMMARY.md exists and contains a results table with status for each step
- Browser session is closed (no leaked processes)
</verification>

<success_criteria>
- All reachable test steps executed and documented
- Screenshots captured at each milestone
- Test report written with honest pass/fail assessment
- Any bugs or issues clearly documented for follow-up
</success_criteria>

<output>
Summary already written as part of Task 2 to:
.planning/quick/260327-fhz-end-to-end-flow-test-run-tamir-routing-p/260327-fhz-SUMMARY.md
</output>
