/**
 * summarize-timeline.ts -- Lightweight LLM summarization for task flow timelines.
 * Uses Claude Agent SDK query() directly (no invokeAgent) to avoid activity log pollution.
 * The system-maintainer's calls are housekeeping and never appear in timelines.
 */
import { query } from '@anthropic-ai/claude-agent-sdk';
import type { SDKResultSuccess, SDKResultError } from '@anthropic-ai/claude-agent-sdk';
import type { TaskTimeline, TimelineNode } from './timeline';
import { logger } from './logger';

const log = logger.child({ module: 'summarize-timeline' });

const SYSTEM_PROMPT = `You are a system maintainer agent that summarizes agent activity logs.
Given a list of agent sessions (each with raw action logs), produce concise labels and summaries.

For each session:
- nodeLabel: 2-4 word label describing what the session accomplished (e.g., "Planning", "Code Execution", "Reviewing Deliverables", "Clarified Requirements")
- summary: 1-2 sentence description of what happened
- connectorLabel: if the default transition label is inaccurate, provide a better one; otherwise return null

Be concise and factual. Focus on what the agent DID, not what it IS.`;

interface SessionSummary {
  sessionIndex: number;
  nodeLabel: string;
  summary: string;
  connectorLabel: string | null;
}

export async function summarizeTimeline(timeline: TaskTimeline): Promise<TaskTimeline> {
  if (timeline.nodes.length === 0) {
    return { ...timeline, summarized: true };
  }

  try {
    // Build a compact representation for the LLM
    const sessionsForLLM = timeline.nodes.map((node: TimelineNode) => ({
      sessionIndex: node.sessionIndex,
      agentId: node.agentId,
      agentName: node.agentName,
      actionCount: node.actionCount,
      actions: node.rawActions.slice(0, 20).map((a) => ({
        type: a.actionType,
        desc: a.description,
      })),
      defaultConnectorLabel: timeline.connectors.find((c) => c.fromIndex === node.sessionIndex)?.label ?? null,
    }));

    const prompt = `Summarize these agent sessions:\n\n${JSON.stringify(sessionsForLLM, null, 2)}\n\nRespond with a JSON array of objects, one per session. Each object must have: sessionIndex (number), nodeLabel (string, 2-4 words), summary (string, 1-2 sentences), connectorLabel (string or null).`;

    const q = query({
      prompt,
      options: {
        pathToClaudeCodeExecutable: process.env.CLAUDE_CODE_PATH ?? '/home/omersh/.npm-global/bin/claude',
        systemPrompt: SYSTEM_PROMPT,
        cwd: process.cwd(),
        tools: [],
        maxBudgetUsd: 0.05,
        permissionMode: 'acceptEdits',
        settingSources: [],
      },
    });

    let resultText = '';
    for await (const msg of q) {
      if (msg.type === 'result') {
        const res = msg as SDKResultSuccess | SDKResultError;
        if ('result' in res && typeof res.result === 'string') {
          resultText = res.result;
        }
      }
    }

    if (!resultText) {
      log.warn('Summarization returned empty result');
      return { ...timeline, summarized: false };
    }

    // Extract JSON from the response (may be wrapped in markdown code blocks)
    const jsonMatch = resultText.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      log.warn('Could not parse JSON from summarization result');
      return { ...timeline, summarized: false };
    }

    const summaries: SessionSummary[] = JSON.parse(jsonMatch[0]);

    // Apply summaries to nodes
    const updatedNodes = timeline.nodes.map((node) => {
      const s = summaries.find((sum) => sum.sessionIndex === node.sessionIndex);
      if (s) {
        return {
          ...node,
          nodeLabel: s.nodeLabel,
          summary: s.summary,
        };
      }
      return node;
    });

    // Apply updated connector labels
    const updatedConnectors = timeline.connectors.map((conn) => {
      const s = summaries.find((sum) => sum.sessionIndex === conn.fromIndex);
      if (s?.connectorLabel) {
        return { ...conn, label: s.connectorLabel };
      }
      return conn;
    });

    return {
      ...timeline,
      nodes: updatedNodes,
      connectors: updatedConnectors,
      summarized: true,
    };
  } catch (err) {
    log.error({ err }, 'Timeline summarization failed');
    return { ...timeline, summarized: false };
  }
}
