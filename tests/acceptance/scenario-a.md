# Acceptance Scenario A: CMO Brand Video

## Preconditions
- System is running (`pnpm dev`)
- At least one execution cycle has completed (worker loop active)
- System has been reset (clean state)

## Steps

### 1. Submit Task via Tamir
- Navigate to `/tamir`
- Type: "Create a 30-second AI-generated brand video for Myelin's BDaS product launch on X/Twitter"
- Verify: Tamir routes to CMO department

### 2. Planning Phase
- CMO (Maya) enters planning conversation
- Verify: Plan appears on canvas with video production approach
- Review plan, adjust if needed
- Configure: Autonomy=Balanced, Budget=$15

### 3. Approve and Execute
- Click "Approve Plan"
- Verify: Redirects to `/deliverables/[id]`
- Verify: Build Log tab shows live agent activity

### 4. Agent Execution (observe)
- Verify: Agent discovers AI video generation tools via web search (native SDK capability per D-04)
- Verify: Agent attempts to use a video generation tool or creates a video script
- Note: Real video generation depends on available APIs. Agent may produce a script + storyboard as deliverable if no video API is accessible.

### 5. Supervisor Review
- Verify: Agent calls submit_for_review
- Verify: Build Log shows supervisor task_run enqueued
- Verify: Supervisor (CMO) reviews and approves or requests changes

### 6. Skill Extraction
- Verify: After approval, extraction task_run is enqueued
- Verify: Supervisor analyzes deliverables and calls propose_skill (if reusable patterns found)

### 7. Deliverable Verification
- Verify: Deliverable tab shows the primary file (video, script, or storyboard)
- Verify: Files tab shows all workspace files
- Verify: Task state is "completed"

## Pass Criteria (D-03)
- Agent produced a real output artifact (not just text)
- Supervisor review loop completed
- Skill extraction attempted
