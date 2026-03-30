import { NextResponse } from 'next/server';
import { sqlite } from '@/lib/db';

interface ActivityLogRow {
  id: string;
  actionType: string;
  description: string | null;
  createdAt: string;
}

interface OrgNode {
  id: string;
  name: string;
  role: string;
  department: string;
  agentId: string | null;
  status: string;
  avatarColor: string;
  activeTasks: {
    taskId: string;
    title: string;
    state: string;
    runId: string | null;
    sessionId: string | null;
    workspaceCwd: string | null;
    recentActivity: ActivityLogRow[];
  }[];
}

interface OrgEdge {
  from: string;
  to: string;
}

function isDeptHead(emp: { role: string; agentId: string | null; department: string }): boolean {
  if (emp.agentId === 'tamir') return false;
  const role = emp.role.trim().toLowerCase();
  // Permanent dept heads have role 'executive' (CTO, CMO, COO)
  // Hired dept heads may have 'department head' or 'dept_head'
  if (role === 'department head' || role === 'dept_head') return true;
  if (role === 'executive' && emp.department !== 'cos') return true;
  return false;
}

const DEPT_COLORS: Record<string, string> = {
  tech: '#6496ff',
  marketing: '#ff64c8',
  operations: '#64c864',
  cos: '#ffa500',
};

export async function GET() {
  try {
    // Fetch all employees
    // Only show active employees in the org tree (exclude terminated)
    const employees = sqlite.prepare("SELECT * FROM employees WHERE status = 'active' ORDER BY department, name").all() as Array<{
      id: string;
      name: string;
      role: string;
      department: string;
      agentId: string | null;
      status: string;
    }>;

    const nodes: OrgNode[] = [];
    const edges: OrgEdge[] = [];

    // Virtual CEO node
    nodes.push({
      id: 'ceo',
      name: 'CEO',
      role: 'Chief Executive Officer',
      department: 'exec',
      agentId: null,
      status: 'active',
      avatarColor: '#e94560',
      activeTasks: [],
    });

    // Find Tamir (CoS)
    const tamir = employees.find(e => e.agentId === 'tamir');

    for (const emp of employees) {
      // Fetch active tasks for this employee via task_runs join
      // Include any task with an executing/queued run (not just by task state)
      // so "improve deliverable" runs on completed tasks still show as active
      const activeTaskRows = sqlite.prepare(`
        SELECT t.id as taskId, t.title, t.state,
               tr.id as runId, tr.sessionId, tr.workspaceCwd, tr.status as runStatus
        FROM task_runs tr
        INNER JOIN tasks t ON t.id = tr.taskId
        WHERE tr.employeeId = ?
          AND (tr.status IN ('executing', 'queued') OR t.state IN ('submitted', 'working', 'input-required'))
        ORDER BY tr.claimedAt DESC
      `).all(emp.id) as Array<{
        taskId: string;
        title: string;
        state: string;
        runId: string | null;
        sessionId: string | null;
        workspaceCwd: string | null;
        runStatus: string | null;
      }>;

      // Deduplicate by taskId (a task may have multiple runs — keep the most recent)
      const seen = new Set<string>();
      const dedupedRows = activeTaskRows.filter(r => {
        if (seen.has(r.taskId)) return false;
        seen.add(r.taskId);
        return true;
      });

      // Attach recent activity_log entries to each active task
      const activeTasks = dedupedRows.map(task => {
        const rawActivity = sqlite.prepare(`
          SELECT id, actionType, description, createdAt
          FROM activity_log
          WHERE taskId = ?
          ORDER BY createdAt DESC
          LIMIT 20
        `).all(task.taskId) as ActivityLogRow[];

        // Filter out generic SDK_ASSISTANT noise, then reverse to chronological order
        const recentActivity = rawActivity
          .filter(a => {
            if (a.actionType !== 'SDK_ASSISTANT') return true;
            const desc = a.description;
            return Boolean(desc && desc !== 'Assistant message');
          })
          .reverse();

        return { ...task, recentActivity };
      });

      nodes.push({
        id: emp.id,
        name: emp.name,
        role: emp.role,
        department: emp.department,
        agentId: emp.agentId,
        status: emp.status,
        avatarColor: DEPT_COLORS[emp.department] || '#666',
        activeTasks,
      });

      // Build edges based on hierarchy
      if (emp.agentId === 'tamir') {
        // Tamir reports to CEO
        edges.push({ from: 'ceo', to: emp.id });
      } else if (isDeptHead(emp)) {
        // Dept heads report to Tamir
        if (tamir) {
          edges.push({ from: tamir.id, to: emp.id });
        } else {
          edges.push({ from: 'ceo', to: emp.id });
        }
      } else {
        // Temp employees report to their dept head
        const deptHead = employees.find(
          e => e.department === emp.department && isDeptHead(e)
        );
        if (deptHead) {
          edges.push({ from: deptHead.id, to: emp.id });
        } else if (tamir) {
          edges.push({ from: tamir.id, to: emp.id });
        }
      }
    }

    return NextResponse.json({ nodes, edges });
  } catch (err) {
    console.error('Org graph API error:', err);
    return NextResponse.json({ error: 'Failed to load org graph' }, { status: 500 });
  }
}
