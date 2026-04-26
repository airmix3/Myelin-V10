import { orchestrator } from '@/lib/orchestrator';
import { tamirStandby } from '@/lib/tamir-standby';
import { prisma } from '@/lib/db';
import { generateId } from '@/lib/id';
import { buildDynamicRoutingSchema } from '@/a2a/schemas';
import type { RoutingResult } from '@/a2a/types';
import type { SDKUserMessage, SDKResultSuccess, SDKResultError } from '@anthropic-ai/claude-agent-sdk';
import { NextRequest, NextResponse } from 'next/server';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { DATA_ROOT as DATA_DIR } from '@/lib/paths';
import { triggerMemoryReview, readMemoryState, writeMemoryState, checkMemoryToolUsed, MEMORY_REVIEW_TURN_THRESHOLD } from '@/lib/memory-review';

export const maxDuration = 120; // 2 minutes for LLM call

import { getDepartmentHead } from '@/lib/departments';

export async function POST(request: NextRequest) {
  const { message, assetTarget } = await request.json();
  if (!message?.trim()) {
    return NextResponse.json({ error: 'Message is required' }, { status: 400 });
  }

  const taskId = generateId('task');
  const contextId = generateId('ctx');
  const runId = generateId('run');

  // For planning invocations, use a temporary desk context
  // Planning turns don't need a full workspace -- use the planning desk
  // and provide dummy delivDir/manifestPath since planning doesn't produce deliverables
  const tamirDeskDir = join(DATA_DIR, 'departments', 'cos');
  mkdirSync(join(tamirDeskDir, 'chat'), { recursive: true });
  const tmpDelivDir = join(DATA_DIR, 'tmp', taskId);
  mkdirSync(tmpDelivDir, { recursive: true });
  const tmpManifestPath = join(tmpDelivDir, 'manifest.json');
  writeFileSync(tmpManifestPath, '{}', 'utf-8');

  // Invoke Tamir with ROUTING_SCHEMA for immediate routing (per D-04)
  // Try pre-warmed standby first, fall back to cold orchestrator.invoke
  let result;
  try {
    const standby = tamirStandby.acquire('route');
    if (standby) {
      // Use pre-warmed routing session
      const routeMsg: SDKUserMessage = {
        type: 'user',
        message: { role: 'user', content: `The CEO wants to get something done. Route this request to the correct department.\n\nCEO's request: "${message}"` },
        parent_tool_use_id: null,
        session_id: '',
      };
      standby.queue.push(routeMsg);

      // Collect result from the streaming query
      let routingResult: RoutingResult | null = null;
      for await (const msg of standby.query) {
        if (msg.type === 'result') {
          if (msg.subtype === 'success') {
            routingResult = (msg as SDKResultSuccess).structured_output as RoutingResult;
          } else {
            const errMsg = msg as SDKResultError;
            throw new Error(`Standby routing failed: ${errMsg.errors?.join(', ')}`);
          }
          break;
        }
      }
      standby.queue.close();

      if (!routingResult?.department) {
        throw new Error('Standby routing returned no structured output');
      }
      result = { sessionId: '', totalCostUsd: 0, structuredOutput: routingResult };
    } else {
      // Cold fallback -- existing orchestrator.invoke path
      result = await orchestrator.invoke({
        taskId,
        runId,
        agentId: 'tamir',
        prompt: `The CEO wants to get something done. Route this request to the correct department.\n\nCEO's request: "${message}"`,
        deskDir: tamirDeskDir,
        delivDir: tmpDelivDir,
        manifestPath: tmpManifestPath,
        outputFormat: await buildDynamicRoutingSchema(),
        maxBudgetUsd: 1,
      });
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : '';
    console.error('[tamir/route] orchestrator.invoke failed:', msg);
    console.error('[tamir/route] stack:', stack);
    return NextResponse.json({ error: `Tamir invocation failed: ${msg}` }, { status: 500 });
  }

  const routing = result.structuredOutput as RoutingResult;
  if (!routing?.department) {
    console.error('[tamir/route] No structured output returned. Result:', JSON.stringify(result));
    return NextResponse.json(
      { error: 'Tamir could not route this request. Try rephrasing your task description.' },
      { status: 500 },
    );
  }

  const deptHead = await getDepartmentHead(routing.department);
  if (!deptHead) {
    return NextResponse.json({ error: 'No department head found for ' + routing.department }, { status: 500 });
  }
  const chatFilePath = join(
    DATA_DIR, 'departments', routing.department, 'planning-desk', 'chat', `${taskId}.jsonl`,
  );

  // Create task record
  await prisma.task.create({
    data: {
      id: taskId,
      title: routing.suggested_title,
      description: message,
      department: routing.department,
      state: 'submitted',
      planningAgentId: deptHead,
      executorAgentId: deptHead,
      supervisorAgentId: deptHead,
      currentActorId: deptHead,
      contextId,
      chatFilePath,
      metadata: JSON.stringify({
        routingConfidence: routing.confidence,
        ...(assetTarget?.mode ? { targetAssetMode: assetTarget.mode } : {}),
        ...(assetTarget?.mode === 'specific' && assetTarget.assetId
          ? { targetAssetId: assetTarget.assetId, targetAssetTitle: assetTarget.assetTitle }
          : {}),
      }),
    },
  });

  // Write initial JSONL entries: CEO message + Tamir routing response
  const lines = [
    JSON.stringify({ role: 'user', content: message, ts: new Date().toISOString() }),
    JSON.stringify({
      role: 'agent',
      agentId: 'tamir',
      content: routing.reasoning,
      ts: new Date().toISOString(),
      turnType: 'routing',
    }),
  ];
  mkdirSync(
    join(DATA_DIR, 'departments', routing.department, 'planning-desk', 'chat'),
    { recursive: true },
  );
  writeFileSync(chatFilePath, lines.join('\n') + '\n', 'utf-8');

  // Memory review: increment CEO turn counter and check threshold
  try {
    const memState = readMemoryState(chatFilePath);
    // This routing call had 1 CEO turn
    memState.turnsSinceLastSave += 1;

    // Check if Tamir proactively used memory tool during routing
    if (checkMemoryToolUsed(taskId, runId)) {
      memState.turnsSinceLastSave = 0;
      memState.lastReviewAt = new Date().toISOString();
    }

    // Trigger review if threshold reached
    if (memState.turnsSinceLastSave >= MEMORY_REVIEW_TURN_THRESHOLD) {
      triggerMemoryReview({ taskId, chatFilePath });
      memState.turnsSinceLastSave = 0;
      memState.lastReviewAt = new Date().toISOString();
    }

    writeMemoryState(chatFilePath, memState);
  } catch (memErr) {
    // Non-blocking — never fail the routing response
    console.warn('[tamir/route] Memory counter update failed:', memErr);
  }

  // Get agent display info for routing buttons
  const deptHeadAgent = orchestrator.getAgent(deptHead);

  return NextResponse.json({
    taskId,
    contextId,
    department: routing.department,
    tamir_response: routing.reasoning,
    suggested_title: routing.suggested_title,
    confidence: routing.confidence,
    routing_buttons: [
      { agentId: deptHead, label: `Plan with ${deptHeadAgent?.name || deptHead}` },
      { agentId: 'tamir', label: 'Plan with Tamir' },
    ],
  });
}
