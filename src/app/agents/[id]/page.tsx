'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { marked } from 'marked';
import Link from 'next/link';

interface AgentCard {
  agentId: string;
  name: string;
  department: string;
  role: string;
  description: string;
  tools: string[];
  skills: string[];
  avatarColor: string;
}

interface DeliverableRef {
  id: string;
  title: string;
}

interface TaskData {
  id: string;
  title: string;
  state: string;
  department: string;
  createdAt: string;
  deliverables: DeliverableRef[];
}

interface EmployeeData {
  id: string;
  name: string;
  role: string;
  department: string;
  status: string;
}

interface AgentData {
  card: AgentCard | null;
  memory: string;
  employee: EmployeeData | null;
  tasks: TaskData[];
}

const DEPT_COLORS: Record<string, string> = {
  tech: '#6496ff',
  marketing: '#ff64c8',
  operations: '#64c864',
  global: '#e94560',
};

function stateBadgeClass(state: string): string {
  switch (state) {
    case 'completed': return 'badge-done';
    case 'working': return 'badge-pending';
    case 'failed':
    case 'canceled': return 'badge-error';
    default: return 'badge-active';
  }
}

function deptBadgeClass(dept: string): string {
  if (dept === 'operations') return 'badge-ops';
  if (dept === 'tech') return 'badge-tech';
  if (dept === 'marketing') return 'badge-marketing';
  return '';
}

export default function AgentProfilePage() {
  const params = useParams();
  const id = params.id as string;
  const [data, setData] = useState<AgentData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    fetch(`/api/agents/${id}`)
      .then(res => res.json())
      .then(json => {
        if (!cancelled) {
          setData(json);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [id]);

  function renderMarkdown(md: string): string {
    return marked.parse(md, { async: false }) as string;
  }

  function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
    });
  }

  if (loading) {
    return (
      <div>
        <h1>Agent Profile</h1>
        <p style={{ color: 'var(--text-dim)' }}>Loading...</p>
      </div>
    );
  }

  if (!data || (!data.card && !data.employee)) {
    return (
      <div>
        <h1>Agent Profile</h1>
        <p style={{ color: 'var(--text-dim)' }}>Agent not found.</p>
      </div>
    );
  }

  const card = data.card;
  const emp = data.employee;
  const name = card?.name || emp?.name || id;
  const dept = card?.department || emp?.department || 'global';
  const role = card?.role || emp?.role || '';
  const deptColor = DEPT_COLORS[dept] || 'var(--text-dim)';

  return (
    <div>
      {/* Agent header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
        <div
          className="avatar"
          style={{
            backgroundColor: card?.avatarColor || deptColor,
            width: '48px',
            height: '48px',
            fontSize: '20px',
            lineHeight: '48px',
          }}
        >
          {name.charAt(0).toUpperCase()}
        </div>
        <div>
          <h1 style={{ margin: 0 }}>{name}</h1>
          <div style={{ display: 'flex', gap: '4px', marginTop: '4px' }}>
            <span className={deptBadgeClass(dept)}>{dept}</span>
            <span className="badge-active">{role}</span>
            {emp?.status && (
              <span className={emp.status === 'active' ? 'badge-active' : 'badge-error'}>
                {emp.status}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Card.json data */}
      {card && (
        <div className="card" style={{ marginBottom: '16px' }}>
          <div className="card-title">ABOUT</div>
          {card.description && <p>{card.description}</p>}
          {card.tools.length > 0 && (
            <div style={{ marginTop: '8px' }}>
              <span style={{ fontWeight: 700, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Tools:
              </span>
              <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '4px' }}>
                {card.tools.map(t => (
                  <span key={t} className="badge-active" style={{ fontSize: '11px' }}>{t}</span>
                ))}
              </div>
            </div>
          )}
          {card.skills.length > 0 && (
            <div style={{ marginTop: '8px' }}>
              <span style={{ fontWeight: 700, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Skills:
              </span>
              <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '4px' }}>
                {card.skills.map(s => (
                  <span key={s} className="badge-active" style={{ fontSize: '11px' }}>{s}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Memory */}
      <div className="card" style={{ marginBottom: '16px' }}>
        <div className="card-title">MEMORY</div>
        {data.memory ? (
          <div
            className="md-render"
            dangerouslySetInnerHTML={{ __html: renderMarkdown(data.memory) }}
          />
        ) : (
          <p style={{ color: 'var(--text-dim)' }}>No memory recorded yet.</p>
        )}
      </div>

      {/* Recent Tasks */}
      <div className="card">
        <div className="card-title">RECENT TASKS</div>
        {data.tasks.length === 0 ? (
          <p style={{ color: 'var(--text-dim)' }}>No tasks yet.</p>
        ) : (
          <div>
            {data.tasks.map(task => (
              <div
                key={task.id}
                style={{
                  padding: '8px 0',
                  borderBottom: '1px solid var(--border)',
                  display: 'flex',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '8px',
                }}
              >
                <span style={{ fontWeight: 700 }}>{task.title}</span>
                <span className={stateBadgeClass(task.state)}>{task.state}</span>
                <span className={deptBadgeClass(task.department)}>{task.department}</span>
                <span style={{ color: 'var(--text-dim)', fontSize: '11px' }}>
                  {formatDate(task.createdAt)}
                </span>
                {task.deliverables.map(d => (
                  <Link
                    key={d.id}
                    href={`/deliverables/${d.id}`}
                    style={{ fontSize: '11px', color: 'var(--accent)' }}
                  >
                    {d.title}
                  </Link>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
