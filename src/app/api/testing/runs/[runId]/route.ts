import { NextResponse } from 'next/server';
import { resolve, join } from 'path';
import { readFileSync, readdirSync, existsSync } from 'fs';
import Database from 'better-sqlite3';

const RUNS_DIR = resolve(process.cwd(), 'test_data/runs');

function findJsonlFiles(baseDir: string): string[] {
  const files: string[] = [];
  function walk(dir: string) {
    try {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const fullPath = join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(fullPath);
        } else if (entry.name.endsWith('.jsonl')) {
          files.push(fullPath);
        }
      }
    } catch {
      // skip unreadable dirs
    }
  }
  walk(baseDir);
  return files;
}

export async function GET(
  _request: Request,
  { params }: { params: { runId: string } }
) {
  const { runId } = params;

  // Path traversal check
  if (runId.includes('..') || runId.includes('/') || runId.includes('\\')) {
    return NextResponse.json({ error: 'Invalid run ID' }, { status: 400 });
  }

  const runDir = resolve(RUNS_DIR, runId);
  if (!existsSync(runDir)) {
    return NextResponse.json({ error: 'Run not found' }, { status: 404 });
  }

  // Read results.json
  let results: {
    scenario: string;
    timestamp: string;
    allPassed: boolean;
    tasks: Array<{ task: string; passed: boolean; reasoning: string }>;
    screenshots?: Array<{ step: number; name: string; path: string }>;
  };
  try {
    results = JSON.parse(readFileSync(resolve(runDir, 'results.json'), 'utf-8'));
  } catch {
    return NextResponse.json({ error: 'No results.json found' }, { status: 404 });
  }

  // Read DB
  let tasks: Array<Record<string, unknown>> = [];
  let activityLog: Array<Record<string, unknown>> = [];
  let deliverables: Array<Record<string, unknown>> = [];
  const dbPath = resolve(runDir, 'myelin.db');
  if (existsSync(dbPath)) {
    let db: InstanceType<typeof Database> | null = null;
    try {
      db = new Database(dbPath, { readonly: true, fileMustExist: true });
      tasks = db
        .prepare(
          'SELECT id, title, state, department, planMarkdown, createdAt, completedAt FROM tasks'
        )
        .all() as Array<Record<string, unknown>>;
      activityLog = db
        .prepare(
          'SELECT id, taskId, agentId, actionType, description, metadata, createdAt FROM activity_log ORDER BY createdAt ASC'
        )
        .all() as Array<Record<string, unknown>>;
      try {
        deliverables = db
          .prepare(
            'SELECT id, taskId, title, type, status, primaryFile, workspacePath, createdAt FROM deliverables'
          )
          .all() as Array<Record<string, unknown>>;
      } catch {
        // deliverables table may not exist in older test runs
      }
    } catch {
      // DB read failed, continue without
    } finally {
      if (db) db.close();
    }
  }

  // Read chat JSONL files
  const chatMessages: Record<string, Array<Record<string, unknown>>> = {};
  const deptDir = resolve(runDir, 'departments');
  if (existsSync(deptDir)) {
    const jsonlFiles = findJsonlFiles(deptDir);
    for (const filePath of jsonlFiles) {
      // Extract taskId from filename like task_abc123.jsonl
      const fileName = filePath.split('/').pop() || '';
      const taskId = fileName.replace('.jsonl', '').replace('task_', '');
      try {
        const content = readFileSync(filePath, 'utf-8');
        const messages = content
          .split('\n')
          .filter((line) => line.trim())
          .map((line) => {
            try {
              return JSON.parse(line);
            } catch {
              return null;
            }
          })
          .filter(Boolean);
        chatMessages[taskId] = messages;
      } catch {
        // skip unreadable files
      }
    }
  }

  // Scan for screenshots directory
  let screenshots: Array<{ step: number; name: string; filename: string }> = [];
  const screenshotsDir = resolve(runDir, 'screenshots');
  if (existsSync(screenshotsDir)) {
    try {
      const screenshotFiles = readdirSync(screenshotsDir)
        .filter(f => /\.(png|jpg|jpeg|gif|webp)$/i.test(f))
        .sort();
      screenshots = screenshotFiles.map(filename => {
        // Parse step number from filename like "step-1-route-task.png"
        const stepMatch = filename.match(/^step-(\d+)/);
        const step = stepMatch ? parseInt(stepMatch[1], 10) : 0;
        // Generate human-friendly name from filename
        const name = filename.replace(/^step-\d+-/, '').replace(/\.(png|jpg|jpeg|gif|webp)$/i, '').replace(/-/g, ' ');
        return { step, name, filename };
      });
    } catch {
      // screenshots dir unreadable, continue without
    }

    // Also try loading from results.json screenshots array for richer metadata
    if (results.screenshots && Array.isArray(results.screenshots)) {
      screenshots = (results.screenshots as Array<{ step: number; name: string; path: string }>).map(s => ({
        step: s.step,
        name: s.name,
        filename: s.path.replace(/^screenshots\//, ''),
      }));
    }
  }

  // Read verdict if exists
  let verdict: { status: string; notes: string; timestamp: string } | null = null;
  try {
    verdict = JSON.parse(readFileSync(resolve(runDir, 'verdict.json'), 'utf-8'));
  } catch {
    // no verdict
  }

  // Read memory files from the run's isolated data
  const memory: Record<string, string> = {};
  const memoryFiles = [
    { key: 'tamir/MEMORY', path: 'cos/MEMORY.md' },
    { key: 'tamir/USER', path: 'cos/USER.md' },
    { key: 'tamir/COMPANY', path: 'cos/COMPANY.md' },
    { key: 'cto/MEMORY', path: 'agents/cto/MEMORY.md' },
    { key: 'cmo/MEMORY', path: 'agents/cmo/MEMORY.md' },
    { key: 'coo/MEMORY', path: 'agents/coo/MEMORY.md' },
  ];
  for (const { key, path: relPath } of memoryFiles) {
    const fullPath = resolve(runDir, relPath);
    if (existsSync(fullPath)) {
      const content = readFileSync(fullPath, 'utf-8').trim();
      if (content) memory[key] = content;
    }
  }

  return NextResponse.json({
    id: runId,
    scenario: results.scenario,
    timestamp: results.timestamp,
    allPassed: results.allPassed,
    results: results.tasks,
    tasks,
    activityLog,
    chatMessages,
    deliverables,
    screenshots,
    memory,
    verdict,
  });
}
