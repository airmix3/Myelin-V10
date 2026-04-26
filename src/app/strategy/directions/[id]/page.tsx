import { prisma, sqlite } from '@/lib/db';
import { notFound } from 'next/navigation';
import DirectionDetailClient from './DirectionDetailClient';

interface GoalRow {
  id: string;
  title: string;
  definitionOfDone: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}

interface SeedRow {
  id: string;
  goalId: string;
  title: string;
  description: string | null;
  suggestedDepartment: string | null;
  roughScope: string | null;
  dependencies: string | null;
  strategicContext: string | null;
  status: string;
  taskId: string | null;
}

interface AssetRow {
  id: string;
  title: string;
  category: string;
}

interface DecisionRow {
  id: string;
  summary: string;
  createdAt: string;
  canvasChatId: string;
  conversationRef: string | null;
  canvasSnapshotRef: string | null;
  constraints: string | null;
  alternatives: string | null;
  challengeHighlights: string | null;
}

interface LinkedTaskRow {
  id: string;
  title: string;
  state: string;
  department: string;
  goalId: string;
}

export default async function DirectionDetailPage({
  params,
}: {
  params: { id: string };
}) {
  // Fetch direction
  const direction = await prisma.direction.findUnique({
    where: { id: params.id },
  });

  if (!direction) {
    notFound();
  }

  // Goals linked via junction table
  const goals = sqlite
    .prepare(
      `SELECT g.* FROM goals g
       INNER JOIN direction_goals dg ON g.id = dg.goalId
       WHERE dg.directionId = ?
       ORDER BY g.createdAt ASC`,
    )
    .all(params.id) as GoalRow[];

  const goalIds = goals.map((g) => g.id);

  // Seeds for all goals
  const allSeeds: SeedRow[] = [];
  for (const goalId of goalIds) {
    const seeds = sqlite
      .prepare(
        `SELECT id, goalId, title, description, suggestedDepartment, roughScope,
                dependencies, strategicContext, status, taskId
         FROM task_seeds WHERE goalId = ?
         ORDER BY createdAt ASC`,
      )
      .all(goalId) as SeedRow[];
    allSeeds.push(...seeds);
  }

  // Assets per goal
  const goalAssetsMap: Record<string, AssetRow[]> = {};
  for (const goalId of goalIds) {
    const assets = sqlite
      .prepare(
        `SELECT a.id, a.title, a.category
         FROM assets a
         INNER JOIN goal_assets ga ON a.id = ga.assetId
         WHERE ga.goalId = ?`,
      )
      .all(goalId) as AssetRow[];
    goalAssetsMap[goalId] = assets;
  }

  // Decision records linked to this direction
  const decisions = sqlite
    .prepare(
      `SELECT dr.*
       FROM decision_records dr
       INNER JOIN decision_directions dd ON dr.id = dd.decisionId
       WHERE dd.directionId = ?
       ORDER BY dr.createdAt DESC`,
    )
    .all(params.id) as DecisionRow[];

  // Tasks linked to goals in this direction
  let linkedTasks: LinkedTaskRow[] = [];
  if (goalIds.length > 0) {
    const placeholders = goalIds.map(() => '?').join(',');
    linkedTasks = sqlite
      .prepare(
        `SELECT id, title, state, department, goalId
         FROM tasks
         WHERE goalId IN (${placeholders})
         ORDER BY createdAt DESC`,
      )
      .all(...goalIds) as LinkedTaskRow[];
  }

  // Compose goal data with seeds and assets
  const goalsWithData = goals.map((goal) => ({
    ...goal,
    seeds: allSeeds.filter((s) => s.goalId === goal.id),
    assets: goalAssetsMap[goal.id] || [],
  }));

  // All seeds summary for cross-referencing dependencies
  const allSeedsSummary = allSeeds.map((s) => ({
    id: s.id,
    title: s.title,
    status: s.status,
  }));

  return (
    <DirectionDetailClient
      direction={{
        id: direction.id,
        title: direction.title,
        rationale: direction.rationale,
        status: direction.status,
      }}
      goals={goalsWithData}
      allSeeds={allSeedsSummary}
      decisions={decisions}
      linkedTasks={linkedTasks}
    />
  );
}
