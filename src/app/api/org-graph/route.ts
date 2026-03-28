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

const DEPT_COLORS: Record<string, string> = {
  tech: '#6496ff',
  marketing: '#ff64c8',
  operations: '#64c864',
  cos: '#ffa500',
};

export async function GET() {
  try {
    // Fetch all employees
    const employees = sqlite.prepare('SELECT * FROM employees ORDER BY department, name').all() as Array<{
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
      const activeTaskRows = sqlite.prepare(`
        SELECT t.id as taskId, t.title, t.state,
               tr.id as runId, tr.sessionId, tr.workspaceCwd
        FROM task_runs tr
        INNER JOIN tasks t ON t.id = tr.taskId
        WHERE tr.employeeId = ?
          AND t.state IN ('submitted', 'working', 'input-required')
        ORDER BY t.createdAt DESC
      `).all(emp.id) as Array<{
        taskId: string;
        title: string;
        state: string;
        runId: string | null;
        sessionId: string | null;
        workspaceCwd: string | null;
      }>;

      // Attach recent activity_log entries to each active task
      const activeTasks = activeTaskRows.map(task => {
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
      } else if (emp.role === 'Department Head' || emp.role === 'dept_head') {
        // Dept heads report to Tamir
        if (tamir) {
          edges.push({ from: tamir.id, to: emp.id });
        } else {
          edges.push({ from: 'ceo', to: emp.id });
        }
      } else {
        // Temp employees report to their dept head
        const deptHead = employees.find(
          e => e.department === emp.department && (e.role === 'Department Head' || e.role === 'dept_head')
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
