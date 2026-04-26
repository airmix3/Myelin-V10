'use client';

import { useState, useEffect } from 'react';
import AgentLogPanel from '@/components/AgentLogPanel';
import ScreenshotGallery from './ScreenshotGallery';

interface RunSummary {
  id: string;
  scenario: string;
  timestamp: string;
  allPassed: boolean;
  taskCount: number;
  passedCount: number;
  verdict: { status: string; notes: string; timestamp: string } | null;
}

interface StepResult {
  task: string;
  passed: boolean;
  reasoning: string;
}

interface ChatMessage {
  role: string;
  content: string;
  ts: string;
  agentId?: string;
  turnType?: string;
  planMarkdown?: string;
}

interface LogEntry {
  id: string;
  taskId: string;
  agentId: string;
  actionType: string;
  description: string;
  metadata: string | null;
  createdAt: string;
}

interface TaskRecord {
  id: string;
  title: string;
  state: string;
  department: string;
  planMarkdown: string | null;
  createdAt: string;
  completedAt: string | null;
}

interface DeliverableRecord {
  id: string;
  taskId: string;
  title: string;
  type: string | null;
  status: string;
  primaryFile: string | null;
  workspacePath: string | null;
  createdAt: string;
}

interface ScreenshotEntry {
  step: number;
  name: string;
  filename: string;
}

interface RunDetailData {
  id: string;
  scenario: string;
  timestamp: string;
  allPassed: boolean;
  results: StepResult[];
  tasks: TaskRecord[];
  activityLog: LogEntry[];
  chatMessages: Record<string, ChatMessage[]>;
  deliverables: DeliverableRecord[];
  screenshots: ScreenshotEntry[];
  memory: Record<string, string>;
  verdict: RunSummary['verdict'];
}

function verdictBadgeColor(status: string): string {
  if (status === 'pass') return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
  if (status === 'fail') return 'bg-red-500/20 text-red-400 border-red-500/30';
  return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
}

function MarkdownPreview({ url }: { url: string }) {
  const [html, setHtml] = useState<string | null>(null);
  useEffect(() => {
    fetch(url).then(r => r.ok ? r.text() : '').then(text => {
      if (text) {
        import('marked').then(({ marked }) => {
          setHtml(marked.parse(text) as string);
        });
      }
    }).catch(() => {});
  }, [url]);
  if (!html) return null;
  return <div className="prose prose-invert prose-sm max-w-none mt-1 text-xs" dangerouslySetInnerHTML={{ __html: html }} />;
}

export default function RunDetail({
  run,
  formattedTime,
}: {
  run: RunSummary;
  formattedTime: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const [detail, setDetail] = useState<RunDetailData | null>(null);
  const [loading, setLoading] = useState(false);

  const [verdictNotes, setVerdictNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [savedVerdict, setSavedVerdict] = useState(run.verdict);

  async function handleExpand() {
    if (expanded) {
      setExpanded(false);
      return;
    }
    setExpanded(true);
    if (!detail) {
      setLoading(true);
      try {
        const res = await fetch(`/api/testing/runs/${run.id}`);
        const data = await res.json();
        setDetail(data);
        if (data.verdict) {
          setSavedVerdict(data.verdict);
        }
      } catch {
        // fetch failed
      } finally {
        setLoading(false);
      }
    }
  }

  async function submitVerdict(status: string) {
    setSubmitting(true);
    try {
      const res = await fetch(`/api/testing/runs/${run.id}/verdict`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, notes: verdictNotes }),
      });
      if (res.ok) {
        const v = await res.json();
        setSavedVerdict(v);
      }
    } catch {
      // submit failed
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="glass-card rounded-xl overflow-hidden cursor-pointer transition-all hover:border-sky-500/30"
      onClick={!expanded ? handleExpand : undefined}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3">
        <span className="text-sm font-semibold text-white">{run.scenario}</span>
        <div className="flex items-center gap-2">
          <span
            className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${
              run.allPassed
                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                : 'bg-red-500/20 text-red-400 border-red-500/30'
            }`}
          >
            {run.allPassed ? 'PASSED' : 'FAILED'}
          </span>
          <span className="text-[11px] text-slate-500">
            {run.passedCount}/{run.taskCount} steps
          </span>
          {savedVerdict && (
            <span
              className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${verdictBadgeColor(savedVerdict.status)}`}
            >
              {savedVerdict.status.toUpperCase()}
            </span>
          )}
          <span className="text-[11px] text-slate-500">{formattedTime}</span>
        </div>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div
          className="px-4 pb-4 pt-3 border-t border-white/5 cursor-default space-y-4"
          onClick={(e) => e.stopPropagation()}
        >
          {loading && (
            <p className="text-xs text-slate-500 py-3">Loading...</p>
          )}

          {detail && (
            <>
              {/* Deliverables */}
              {detail.deliverables && detail.deliverables.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-slate-400 mb-2">
                    Deliverables ({detail.deliverables.length})
                  </h3>
                  {detail.deliverables.map((d) => {
                    const ext = d.primaryFile ? d.primaryFile.split('.').pop()?.toLowerCase() || '' : '';
                    const isImg = ['png','jpg','jpeg','gif','svg','webp'].includes(ext);
                    const isMd = ext === 'md';
                    const fileUrl = d.primaryFile
                      ? `/api/testing/runs/${detail.id}/file?path=workspaces/${d.taskId}/deliverables/${d.primaryFile}`
                      : null;

                    return (
                      <div key={d.id} className="glass-deep rounded-lg p-3 mb-2">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-semibold text-white">{d.title}</span>
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/5 text-slate-400">
                            {d.type || 'file'}
                          </span>
                        </div>
                        {isImg && fileUrl && (
                          <img src={fileUrl} alt={d.title} className="max-w-full rounded mt-1" />
                        )}
                        {isMd && fileUrl && <MarkdownPreview url={fileUrl} />}
                        {fileUrl && !isImg && !isMd && (
                          <a href={fileUrl} download={d.primaryFile || 'file'} className="text-sky-400 text-xs hover:underline">
                            Download {d.primaryFile}
                          </a>
                        )}
                        {!fileUrl && (
                          <span className="text-[11px] text-slate-500">No primary file</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Screenshots Gallery */}
              {detail.screenshots && detail.screenshots.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-slate-400 mb-2">
                    Screenshots ({detail.screenshots.length})
                  </h3>
                  <ScreenshotGallery screenshots={detail.screenshots} runId={detail.id} />
                </div>
              )}

              {/* Step Results */}
              <div>
                <h3 className="text-xs font-semibold text-slate-400 mb-2">
                  Step Results
                </h3>
                <div className="space-y-1">
                  {detail.results.map((step, i) => (
                    <div key={i} className="flex items-baseline gap-2 text-xs leading-relaxed">
                      <span className={`font-bold ${step.passed ? 'text-emerald-400' : 'text-red-400'}`}>
                        {step.passed ? '\u2713' : '\u2717'}
                      </span>
                      <span className="text-white">{step.task}</span>
                      <span className="text-[11px] text-slate-500">{step.reasoning}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Chat Interaction */}
              {Object.keys(detail.chatMessages).length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-slate-400 mb-2">
                    Chat Interaction
                  </h3>
                  <div className="space-y-2">
                    {Object.entries(detail.chatMessages).map(([taskId, messages]) => (
                      <div key={taskId}>
                        <div className="text-[10px] text-slate-500 mb-1">Task: {taskId}</div>
                        {messages.map((msg, i) => (
                          <div
                            key={i}
                            className={`rounded-lg p-2.5 mb-1.5 text-xs ${
                              msg.role === 'user'
                                ? 'border-l-2 border-sky-400 bg-white/[0.02]'
                                : 'border-l-2 border-emerald-400 bg-white/[0.02]'
                            }`}
                          >
                            <div className="flex items-center gap-1.5 mb-1">
                              <span className={`text-[10px] font-bold ${
                                msg.role === 'user' ? 'text-sky-400' : 'text-emerald-400'
                              }`}>
                                {msg.role === 'user' ? 'CEO' : msg.agentId?.toUpperCase() || 'AGENT'}
                              </span>
                              {msg.turnType && (
                                <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/5 text-slate-400">
                                  {msg.turnType}
                                </span>
                              )}
                            </div>
                            <div className="text-xs leading-relaxed text-slate-300">
                              {msg.content}
                            </div>
                            {msg.planMarkdown && (
                              <pre className="mt-2 p-3 rounded-lg bg-black/30 border border-white/5 text-[11px] text-slate-300 font-mono whitespace-pre-wrap overflow-x-auto">
                                {msg.planMarkdown}
                              </pre>
                            )}
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Agent Activity Log */}
              {detail.activityLog.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-slate-400 mb-2">
                    Agent Activity Log ({detail.activityLog.length} entries)
                  </h3>
                  <div className="glass-deep rounded-lg p-2 max-h-[400px] overflow-y-auto text-[11px]">
                    <AgentLogPanel activityLog={detail.activityLog} />
                  </div>
                </div>
              )}

              {/* Plan Markdown */}
              {detail.tasks.some((t) => t.planMarkdown) && (
                <div>
                  <h3 className="text-xs font-semibold text-slate-400 mb-2">
                    Plan Markdown
                  </h3>
                  {detail.tasks
                    .filter((t) => t.planMarkdown)
                    .map((t) => (
                      <pre key={t.id} className="p-3 rounded-lg bg-black/30 border border-white/5 text-[11px] text-slate-300 font-mono whitespace-pre-wrap overflow-x-auto">
                        {t.planMarkdown}
                      </pre>
                    ))}
                </div>
              )}

              {/* Agent Memory */}
              {detail.memory && Object.keys(detail.memory).length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-slate-400 mb-2">
                    Agent Memory ({Object.keys(detail.memory).length} files)
                  </h3>
                  {Object.entries(detail.memory).map(([key, content]) => {
                    const [agent, file] = key.split('/');
                    const label = agent === 'tamir' ? `Tamir -- ${file}.md` : `${agent.toUpperCase()} -- ${file}.md`;
                    return (
                      <details key={key} className="mb-2">
                        <summary className="cursor-pointer text-xs font-semibold text-white px-3 py-2 rounded-lg glass-deep">
                          {label}
                          <span className="text-[10px] text-slate-500 font-normal ml-2">
                            {content.split('\n').length} lines
                          </span>
                        </summary>
                        <pre className="text-[11px] leading-relaxed p-3 bg-black/30 border border-white/5 border-t-0 rounded-b-lg whitespace-pre-wrap break-words max-h-[300px] overflow-auto m-0">
                          {content}
                        </pre>
                      </details>
                    );
                  })}
                </div>
              )}

              {/* Verdict Section */}
              <div className="border-t border-white/5 pt-4">
                <h3 className="text-xs font-semibold text-slate-400 mb-2">
                  Verdict
                </h3>
                {savedVerdict && (
                  <div className="mb-3 flex items-center gap-2">
                    <span
                      className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${verdictBadgeColor(savedVerdict.status)}`}
                    >
                      {savedVerdict.status.toUpperCase()}
                    </span>
                    {savedVerdict.notes && (
                      <span className="text-xs text-slate-500">
                        {savedVerdict.notes}
                      </span>
                    )}
                  </div>
                )}
                <textarea
                  placeholder="Notes (optional)"
                  value={verdictNotes}
                  onChange={(e) => setVerdictNotes(e.target.value)}
                  className="w-full min-h-[60px] mb-2 rounded-lg p-2 text-xs text-white bg-black/30 border border-white/10 focus:border-sky-500/50 focus:outline-none resize-y"
                />
                <div className="flex gap-2">
                  <button
                    className="px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30 transition-colors cursor-pointer disabled:opacity-50"
                    onClick={() => submitVerdict('pass')}
                    disabled={submitting}
                  >
                    Pass
                  </button>
                  <button
                    className="px-3 py-1.5 rounded-lg text-xs font-medium bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 transition-colors cursor-pointer disabled:opacity-50"
                    onClick={() => submitVerdict('fail')}
                    disabled={submitting}
                  >
                    Fail
                  </button>
                  <button
                    className="px-3 py-1.5 rounded-lg text-xs font-medium bg-amber-500/20 text-amber-400 border border-amber-500/30 hover:bg-amber-500/30 transition-colors cursor-pointer disabled:opacity-50"
                    onClick={() => submitVerdict('needs-work')}
                    disabled={submitting}
                  >
                    Needs Work
                  </button>
                </div>
                {submitting && (
                  <p className="text-[11px] text-slate-500 mt-2">Saving verdict...</p>
                )}
              </div>

              {/* Collapse button */}
              <div className="text-center pt-2">
                <button
                  className="px-4 py-1.5 rounded-lg text-[11px] text-slate-400 bg-white/5 hover:bg-white/10 transition-colors cursor-pointer"
                  onClick={handleExpand}
                >
                  Collapse
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
