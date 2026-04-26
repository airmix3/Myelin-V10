import { NextResponse } from 'next/server';
import { resolve } from 'path';
import { readdirSync, readFileSync, statSync } from 'fs';

const RUNS_DIR = resolve(process.cwd(), 'test_data/runs');

export async function GET() {
  try {
    let entries: string[];
    try {
      entries = readdirSync(RUNS_DIR);
    } catch {
      return NextResponse.json([]);
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

          let verdict: { status: string; notes: string; timestamp: string } | null = null;
          try {
            const verdictRaw = readFileSync(resolve(dirPath, 'verdict.json'), 'utf-8');
            verdict = JSON.parse(verdictRaw);
          } catch {
            // no verdict yet
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
          };
        } catch {
          return null;
        }
      })
      .filter(Boolean);

    // Sort by timestamp descending (newest first)
    runs.sort((a, b) => {
      const ta = a!.timestamp || '';
      const tb = b!.timestamp || '';
      return tb.localeCompare(ta);
    });

    return NextResponse.json(runs);
  } catch (err) {
    return NextResponse.json({ error: 'Failed to list runs' }, { status: 500 });
  }
}
