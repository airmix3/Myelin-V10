import { resolve } from 'path';
import { readdirSync, readFileSync, statSync } from 'fs';
import RunDetail from './RunDetail';

const RUNS_DIR = resolve(process.cwd(), 'test_data/runs');

interface RunSummary {
  id: string;
  scenario: string;
  timestamp: string;
  allPassed: boolean;
  taskCount: number;
  passedCount: number;
  verdict: { status: string; notes: string; timestamp: string } | null;
}

function loadRuns(): RunSummary[] {
  let entries: string[];
  try {
    entries = readdirSync(RUNS_DIR);
  } catch {
    return [];
  }

  const runs = entries
    .filter((name) => {
      try {
        return statSync(resolve(RUNS_DIR, name)).isDirectory();
      } catch {
        return false;
      }
    })
    .map((dirName) => {
      const dirPath = resolve(RUNS_DIR, dirName);
      try {
        const resultsRaw = readFileSync(resolve(dirPath, 'results.json'), 'utf-8');
        const results = JSON.parse(resultsRaw);

        let verdict: RunSummary['verdict'] = null;
        try {
          verdict = JSON.parse(readFileSync(resolve(dirPath, 'verdict.json'), 'utf-8'));
        } catch {
          // no verdict
        }

        return {
          id: dirName,
          scenario: results.scenario as string,
          timestamp: results.timestamp as string,
          allPassed: results.allPassed as boolean,
          taskCount: Array.isArray(results.tasks) ? results.tasks.length : 0,
          passedCount: Array.isArray(results.tasks)
            ? results.tasks.filter((t: { passed: boolean }) => t.passed).length
            : 0,
          verdict,
        } satisfies RunSummary;
      } catch {
        return null;
      }
    })
    .filter((r): r is RunSummary => r !== null);

  runs.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  return runs;
}

function formatTimestamp(ts: string): string {
  try {
    const d = new Date(ts);
    return d.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  } catch {
    return ts;
  }
}

export default function TestingPage() {
  const runs = loadRuns();

  return (
    <div className="p-6 space-y-5">
      <h1 className="text-lg font-semibold text-white">
        Scenario Test Runs
      </h1>

      {runs.length === 0 && (
        <div className="glass-card rounded-xl p-8 text-center">
          <p className="text-sm text-slate-400">
            No test runs found in test_data/runs/
          </p>
        </div>
      )}

      <div className="space-y-3">
        {runs.map((run) => (
          <RunDetail key={run.id} run={run} formattedTime={formatTimestamp(run.timestamp)} />
        ))}
      </div>
    </div>
  );
}
