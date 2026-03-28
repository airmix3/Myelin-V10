import { NextResponse } from 'next/server';
import { sqlite } from '@/lib/db';

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
      // Fetch active tasks for this employee
      const activeTasks = sqlite.prepare(`
        SELECT t.id as taskId, t.title, t.state,
               tr.id as runId, tr.sessionId, tr.workspaceCwd
        FROM tasks t
        LEFT JOIN task_runs tr ON tr.taskId = t.id AND tr.status = 'executing'
        WHERE t.assigneeId = ?
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
