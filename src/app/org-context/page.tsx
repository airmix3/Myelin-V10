'use client';

import { useState, useEffect, useRef } from 'react';
import { marked } from 'marked';
import Link from 'next/link';

interface TaskPreview {
  id: string;
  title: string;
  state: string;
  createdAt: string;
}

interface EmployeeData {
  id: string;
  name: string;
  role: string;
  department: string;
  agentId: string | null;
  status: string;
  budgetLimit: number;
  budgetSpent: number;
  tasks: TaskPreview[];
}

interface SkillData {
  id: string;
  name: string;
  department: string;
  description: string | null;
  status: string;
  filePath: string | null;
  proposedBy: string | null;
}

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

interface KnowledgeFile {
  name: string;
  content: string;
}

interface DeptData {
  employees: EmployeeData[];
  agentMemories: Record<string, string>;
  agentCards: Record<string, AgentCard>;
  knowledgeFiles: KnowledgeFile[];
  skills: SkillData[];
}

const DEPT_TABS = [
  { id: 'tech', label: 'Tech' },
  { id: 'marketing', label: 'Marketing' },
  { id: 'operations', label: 'Operations' },
] as const;

const DEPT_COLORS: Record<string, string> = {
  tech: '#6496ff',
  marketing: '#ff64c8',
  operations: '#64c864',
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

function skillStatusBadgeClass(status: string): string {
  switch (status) {
    case 'active': return 'badge-active';
    case 'approved': return 'badge-done';
    case 'pending': return 'badge-pending';
    case 'dismissed': return 'badge-error';
    default: return '';
  }
}

export default function OrgContextPage() {
  const [activeDept, setActiveDept] = useState<string>('tech');
  const [data, setData] = useState<DeptData | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedMemories, setExpandedMemories] = useState<Set<string>>(new Set());
  const [expandedKnowledge, setExpandedKnowledge] = useState<Set<string>>(new Set());
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());
  const [dismissConfirm, setDismissConfirm] = useState<string | null>(null);
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    fetch(`/api/org-context/${activeDept}`)
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
  }, [activeDept]);

  function toggleSet(set: Set<string>, key: string, setter: (s: Set<string>) => void) {
    const next = new Set(set);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setter(next);
  }

  async function handleSkillAction(skillId: string, action: 'approve' | 'submit-to-ceo' | 'dismiss') {
    if (action === 'dismiss' && dismissConfirm !== skillId) {
      setDismissConfirm(skillId);
      if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
      dismissTimerRef.current = setTimeout(() => setDismissConfirm(null), 3000);
      return;
    }

    const res = await fetch(`/api/skills/${skillId}/${action}`, { method: 'POST' });
    if (res.ok) {
      // Refresh data
      const refreshRes = await fetch(`/api/org-context/${activeDept}`);
      if (refreshRes.ok) setData(await refreshRes.json());
    }
    setDismissConfirm(null);
  }

  function renderMarkdown(md: string): string {
    return marked.parse(md, { async: false }) as string;
  }

  function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
    });
  }

  return (
    <div>
      <h1>Org Context</h1>

      <div className="tab-bar">
        {DEPT_TABS.map(tab => (
          <button
            key={tab.id}
            className={`tab ${activeDept === tab.id ? 'active' : ''}`}
            onClick={() => setActiveDept(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading && <p style={{ color: 'var(--text-dim)' }}>Loading...</p>}

      {!loading && data && (
        <div style={{ display: 'flex', gap: '24px', marginTop: '16px' }}>
          {/* Left column - 60% */}
          <div style={{ flex: 3, minWidth: 0 }}>

            {/* Agent Memory section */}
            <div className="card">
              <div className="card-title">Agent Memory</div>
              {data.employees.filter(e => e.agentId).length === 0 ? (
                <div style={{ color: 'var(--text-dim)' }}>
                  <p>No agents in this department.</p>
                </div>
              ) : (
                data.employees.filter(e => e.agentId).map(emp => {
                  const memory = emp.agentId ? data.agentMemories[emp.agentId] : null;
                  const expanded = emp.agentId ? expandedMemories.has(emp.agentId) : false;
                  return (
                    <div key={emp.id} className="card" style={{ marginTop: '8px' }}>
                      <div
                        className="card-title"
                        style={{ cursor: 'pointer', userSelect: 'none' }}
                        onClick={() => emp.agentId && toggleSet(expandedMemories, emp.agentId, setExpandedMemories)}
                      >
                        {expanded ? '\u25BC' : '\u25B6'} {emp.name}
                      </div>
                      {expanded && (
                        memory ? (
                          <div
                            className="md-render"
                            dangerouslySetInnerHTML={{ __html: renderMarkdown(memory) }}
                          />
                        ) : (
                          <p style={{ color: 'var(--text-dim)' }}>No memory recorded yet.</p>
                        )
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Knowledge Library section */}
            <div className="card" style={{ marginTop: '16px' }}>
              <div className="card-title">Knowledge Library</div>
              {data.knowledgeFiles.length === 0 ? (
                <div style={{ color: 'var(--text-dim)' }}>
                  <p>No knowledge articles</p>
                  <p style={{ fontSize: '11px' }}>Agents write knowledge articles as they complete tasks.</p>
                </div>
              ) : (
                data.knowledgeFiles.map(kf => {
                  const expanded = expandedKnowledge.has(kf.name);
                  return (
                    <div key={kf.name} className="card" style={{ marginTop: '8px' }}>
                      <div
                        className="card-title"
                        style={{ cursor: 'pointer', userSelect: 'none' }}
                        onClick={() => toggleSet(expandedKnowledge, kf.name, setExpandedKnowledge)}
                      >
                        {expanded ? '\u25BC' : '\u25B6'} {kf.name}
                      </div>
                      {expanded && (
                        <div
                          className="md-render"
                          dangerouslySetInnerHTML={{ __html: renderMarkdown(kf.content) }}
                        />
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Tools + Skills Gallery */}
            <div className="card" style={{ marginTop: '16px' }}>
              <div className="card-title">Tools + Skills Gallery</div>
              {data.skills.length === 0 ? (
                <div style={{ color: 'var(--text-dim)' }}>
                  <p>No skills registered</p>
                  <p style={{ fontSize: '11px' }}>Skills are proposed by agents after completing tasks and approved by department heads.</p>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: '12px', marginTop: '8px' }}>
                  {data.skills.map(skill => (
                    <div key={skill.id} className="gallery-card">
                      <div style={{ fontWeight: 700, marginBottom: '4px' }}>{skill.name}</div>
                      {skill.description && (
                        <p style={{ fontSize: '11px', color: 'var(--text-dim)', marginBottom: '8px' }}>{skill.description}</p>
                      )}
                      <span className={skillStatusBadgeClass(skill.status)}>{skill.status}</span>
                      {skill.proposedBy && (
                        <span style={{ fontSize: '11px', color: 'var(--text-dim)', marginLeft: '8px' }}>
                          by {skill.proposedBy}
                        </span>
                      )}
                      {skill.status === 'pending' && (
                        <div style={{ marginTop: '8px', display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                          <button
                            className="btn-approve btn-sm"
                            onClick={() => handleSkillAction(skill.id, 'approve')}
                          >
                            Approve
                          </button>
                          <button
                            className="btn btn-sm"
                            onClick={() => handleSkillAction(skill.id, 'submit-to-ceo')}
                          >
                            Submit to CEO
                          </button>
                          <button
                            className="btn-cancel btn-sm"
                            onClick={() => handleSkillAction(skill.id, 'dismiss')}
                            style={dismissConfirm === skill.id ? { color: 'var(--red)', fontWeight: 700 } : undefined}
                          >
                            {dismissConfirm === skill.id ? 'Confirm Dismiss' : 'Dismiss'}
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right column - 40% */}
          <div style={{ flex: 2, minWidth: 0 }}>
            <div className="card-title">Employees</div>
            {data.employees.length === 0 ? (
              <p style={{ color: 'var(--text-dim)' }}>No employees in this department.</p>
            ) : (
              data.employees.map(emp => {
                const card = emp.agentId ? data.agentCards[emp.agentId] : null;
                const memory = emp.agentId ? data.agentMemories[emp.agentId] : null;
                const memoryPreview = memory
                  ? (memory.length > 100 ? memory.substring(0, 100) + '...' : memory)
                  : null;
                const tasksExpanded = expandedTasks.has(emp.id);
                const deptColor = DEPT_COLORS[emp.department] || 'var(--text-dim)';

                return (
                  <div
                    key={emp.id}
                    className={`agent-card ${emp.department}`}
                    style={{ marginTop: '12px' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                      <div
                        className="avatar"
                        style={{ backgroundColor: deptColor }}
                      >
                        {emp.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontWeight: 700 }}>
                          {emp.agentId ? (
                            <Link href={`/agents/${emp.agentId}`} style={{ color: 'var(--text)', textDecoration: 'none' }}>
                              {emp.name}
                            </Link>
                          ) : (
                            emp.name
                          )}
                        </div>
                        <div style={{ display: 'flex', gap: '4px', marginTop: '2px' }}>
                          <span className={`badge-${emp.department === 'operations' ? 'ops' : emp.department}`}>
                            {emp.department}
                          </span>
                          <span className={emp.status === 'active' ? 'badge-active' : 'badge-error'}>
                            {emp.role}
                          </span>
                        </div>
                      </div>
                    </div>

                    {memoryPreview && (
                      <p style={{ fontSize: '11px', color: 'var(--text-dim)', margin: '4px 0 8px' }}>
                        {memoryPreview}
                      </p>
                    )}

                    {/* Past tasks accordion */}
                    {emp.tasks.length > 0 && (
                      <div>
                        <div
                          style={{ cursor: 'pointer', fontSize: '11px', color: 'var(--text-dim)', userSelect: 'none' }}
                          onClick={() => toggleSet(expandedTasks, emp.id, setExpandedTasks)}
                        >
                          {tasksExpanded ? '\u25BC' : '\u25B6'} Past Tasks ({emp.tasks.length})
                        </div>
                        {tasksExpanded && (
                          <div style={{ marginTop: '4px' }}>
                            {emp.tasks.map(task => (
                              <div key={task.id} style={{ fontSize: '11px', padding: '4px 0', borderBottom: '1px solid var(--border)' }}>
                                <span>{task.title}</span>
                                <span className={stateBadgeClass(task.state)} style={{ marginLeft: '8px' }}>
                                  {task.state}
                                </span>
                                <span style={{ color: 'var(--text-dim)', marginLeft: '8px' }}>
                                  {formatDate(task.createdAt)}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
