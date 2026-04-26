const fs = require('fs');
const path = require('path');
const db = require('better-sqlite3')('data/myelin.db');

const BASE = 'tmp/scenarios';

// Clean and create
if (fs.existsSync(BASE)) fs.rmSync(BASE, { recursive: true });
fs.mkdirSync(BASE, { recursive: true });

// Get all tasks that have workspaces (completed work)
const tasks = db.prepare(`
  SELECT t.id, t.title, t.state, t.department, t.planningAgentId, t.executorAgentId,
         t.chatFilePath, t.planMarkdown, t.createdAt, t.completedAt, t.description
  FROM tasks t
  WHERE EXISTS (SELECT 1 FROM task_runs tr WHERE tr.taskId = t.id)
  ORDER BY t.createdAt
`).all();

// Get task_runs
const runs = db.prepare(`
  SELECT tr.*, e.agentId as agentName 
  FROM task_runs tr 
  LEFT JOIN employees e ON tr.employeeId = e.id
`).all();

const runsByTask = {};
for (const r of runs) {
  if (!runsByTask[r.taskId]) runsByTask[r.taskId] = [];
  runsByTask[r.taskId].push(r);
}

// Get deliverables from DB
const deliverables = db.prepare('SELECT * FROM deliverables').all();
const delivsByTask = {};
for (const d of deliverables) {
  if (!delivsByTask[d.taskId]) delivsByTask[d.taskId] = [];
  delivsByTask[d.taskId].push(d);
}

for (const task of tasks) {
  const taskDir = path.join(BASE, task.id);
  fs.mkdirSync(taskDir, { recursive: true });

  // 1. Build agent log JSON
  const agentLog = { 
    task: {
      id: task.id,
      title: task.title,
      description: task.description,
      state: task.state,
      department: task.department,
      planningAgent: task.planningAgentId,
      executorAgent: task.executorAgentId,
      createdAt: task.createdAt,
      completedAt: task.completedAt,
      plan: task.planMarkdown
    },
    runs: (runsByTask[task.id] || []).map(r => ({
      id: r.id,
      agent: r.agentName,
      status: r.status,
      claimedAt: r.claimedAt,
      completedAt: r.completedAt,
      failedAt: r.failedAt,
      failureReason: r.failureReason,
      sessionId: r.sessionId,
    })),
    deliverables: (delivsByTask[task.id] || []).map(d => ({
      id: d.id,
      title: d.title,
      primaryFile: d.primaryFile,
      status: d.status,
    })),
    chatLog: []
  };

  // Read chat log (JSONL) - includes all agents (tamir routing, planning agent, execution)
  if (task.chatFilePath && fs.existsSync(task.chatFilePath)) {
    const lines = fs.readFileSync(task.chatFilePath, 'utf-8').split('\n').filter(Boolean);
    for (const line of lines) {
      try {
        const entry = JSON.parse(line);
        // Add agent attribution
        if (entry.agentId) {
          entry._agent = entry.agentId;
        } else if (entry.role === 'user') {
          entry._agent = 'ceo';
        }
        agentLog.chatLog.push(entry);
      } catch {}
    }
  }

  // Also check for chat logs in other departments for this task
  const chatDirs = [
    'data/departments/marketing/planning-desk/chat',
    'data/departments/tech/planning-desk/chat',
    'data/departments/operations/planning-desk/chat',
    'data/departments/cos/planning-desk/chat',
    'data/departments/cos/chat',
  ];
  for (const chatDir of chatDirs) {
    const chatFile = path.join(chatDir, `${task.id}.jsonl`);
    if (chatFile !== task.chatFilePath && fs.existsSync(chatFile)) {
      const lines = fs.readFileSync(chatFile, 'utf-8').split('\n').filter(Boolean);
      for (const line of lines) {
        try {
          const entry = JSON.parse(line);
          if (entry.agentId) entry._agent = entry.agentId;
          else if (entry.role === 'user') entry._agent = 'ceo';
          entry._source = chatDir;
          agentLog.chatLog.push(entry);
        } catch {}
      }
    }
  }

  fs.writeFileSync(path.join(taskDir, 'agent-log.json'), JSON.stringify(agentLog, null, 2));

  // 2. Copy desk files (no dot dirs, max 20 files)
  const deskSrc = path.join('data/workspaces', task.id, 'desk');
  if (fs.existsSync(deskSrc)) {
    const deskDst = path.join(taskDir, 'desk');
    fs.mkdirSync(deskDst, { recursive: true });
    
    let fileCount = 0;
    function copyDir(src, dst) {
      if (fileCount >= 20) return;
      const entries = fs.readdirSync(src, { withFileTypes: true });
      for (const entry of entries) {
        if (fileCount >= 20) break;
        if (entry.name.startsWith('.')) continue;
        if (entry.name === 'node_modules') continue;
        if (entry.name === 'venv') continue;
        
        const srcPath = path.join(src, entry.name);
        const dstPath = path.join(dst, entry.name);
        
        if (entry.isDirectory()) {
          fs.mkdirSync(dstPath, { recursive: true });
          copyDir(srcPath, dstPath);
        } else {
          fs.copyFileSync(srcPath, dstPath);
          fileCount++;
        }
      }
    }
    copyDir(deskSrc, deskDst);
  }

  // 3. Copy deliverables
  const delivSrc = path.join('data/workspaces', task.id, 'deliverables');
  if (fs.existsSync(delivSrc)) {
    const delivDst = path.join(taskDir, 'deliverables');
    fs.mkdirSync(delivDst, { recursive: true });
    
    let fileCount = 0;
    const entries = fs.readdirSync(delivSrc);
    for (const entry of entries) {
      if (fileCount >= 20) break;
      if (entry.startsWith('.')) continue;
      const srcPath = path.join(delivSrc, entry);
      if (fs.statSync(srcPath).isFile()) {
        fs.copyFileSync(srcPath, path.join(delivDst, entry));
        fileCount++;
      }
    }
  }

  console.log(`✓ ${task.id} — ${task.title} (${task.state}) [${agentLog.chatLog.length} chat entries, desk+deliverables copied]`);
}

// Write an index file
const index = tasks.map(t => ({
  id: t.id,
  title: t.title,
  state: t.state,
  department: t.department,
  planningAgent: t.planningAgentId,
  executorAgent: t.executorAgentId,
  createdAt: t.createdAt,
  completedAt: t.completedAt,
}));
fs.writeFileSync(path.join(BASE, 'index.json'), JSON.stringify(index, null, 2));
console.log(`\n✓ Index written with ${tasks.length} tasks`);
console.log(`✓ Output: ${BASE}/`);
