# Acceptance Scenario B: CTO EEG SVM Classifier

## Preconditions
- System is running (`pnpm dev`)
- `data/test-fixtures/eeg-sample.csv` exists
- System has been reset (clean state)

## Steps

### 1. Submit Task via Tamir
- Navigate to `/tamir`
- Type: "Build an SVM classifier for the EEG motor imagery dataset at data/test-fixtures/eeg-sample.csv. Train on the 4 EEG channels to predict the binary label. Produce accuracy metrics, a confusion matrix plot, and a classification report."
- Verify: Tamir routes to CTO (Tech) department

### 2. Planning Phase
- CTO (Amir) enters planning conversation
- Verify: Plan includes Python SVM implementation with scikit-learn
- Configure: Autonomy=High, Budget=$10

### 3. Hire Decision (optional)
- CTO may request to hire a data scientist temp employee
- If hire request appears: Approve hire in Build Log approval card (UI-09)
- Verify: Worker re-invokes CTO with subagent

### 4. Approve and Execute
- Click "Approve Plan"
- Verify: Redirects to `/deliverables/[id]`
- Verify: Build Log tab shows live agent activity

### 5. Agent Execution (observe)
- Verify: Agent executes real Python code via SDK bash tool (D-04)
- Verify: Python script reads eeg-sample.csv, trains SVM, produces metrics
- Verify: Agent calls promote_to_deliverable for output files

### 6. Supervisor Review
- Verify: submit_for_review triggers supervisor invocation
- Verify: CTO review gate works (approves or requests changes)
- Verify: If request_changes, executor is re-invoked automatically (D-02)

### 7. Deliverable Verification
- Navigate to Files tab
- Verify: Real Python script exists in desk/
- Verify: Real metrics file exists (accuracy, precision, recall, f1)
- Verify: Real confusion matrix plot exists (PNG/SVG)
- Verify: All files viewable in workspace via inline preview

## Pass Criteria (D-03)
- Real Python code executed (not just generated text)
- Real EEG metrics produced (accuracy > 50% indicates actual training occurred)
- Real confusion matrix plot produced (image file, not text description)
- CTO review gate completed
- All files viewable in workspace
