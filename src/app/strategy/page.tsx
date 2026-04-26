import { prisma, sqlite } from '@/lib/db';
import { STATUS_COLORS, GOAL_STATUS_COLORS } from '@/lib/strategy/constellation-layout';
import type { OrbitNode } from '@/lib/strategy/constellation-layout';
import ConstellationPageClient from './ConstellationPageClient';

interface DirectionGoalRow {
  directionId: string;
  goalId: string;
}

interface DirectionPrioritySetRow {
  directionId: string;
  prioritySetId: string;
}

interface SeedProgressRow {
  goalId: string;
  total: number;
  done: number;
}

export default async function StrategyPage() {
  // Fetch all strategic data server-side
  const [directions, goals, prioritySets] = await Promise.all([
    prisma.direction.findMany({ orderBy: { createdAt: 'asc' } }),
    prisma.goal.findMany({ orderBy: { createdAt: 'asc' } }),
    prisma.prioritySet.findMany({ orderBy: { createdAt: 'asc' } }),
  ]);

  // Junction tables via raw SQLite (Prisma cannot query junction tables without model)
  const directionGoals = sqlite
    .prepare('SELECT directionId, goalId FROM direction_goals')
    .all() as DirectionGoalRow[];

  const directionPrioritySets = sqlite
    .prepare('SELECT directionId, prioritySetId FROM direction_priority_sets')
    .all() as DirectionPrioritySetRow[];

  // Seed progress per goal
  const seedProgress = sqlite
    .prepare(
      `SELECT goalId,
              COUNT(*) as total,
              SUM(CASE WHEN status IN ('activated','completed') THEN 1 ELSE 0 END) as done
       FROM task_seeds
       GROUP BY goalId`,
    )
    .all() as SeedProgressRow[];

  const seedProgressMap = new Map(
    seedProgress.map((row) => [row.goalId, { total: row.total, done: row.done }]),
  );

  // Build lookup: goalId -> directionIds
  const goalToDirections = new Map<string, string[]>();
  for (const row of directionGoals) {
    const existing = goalToDirections.get(row.goalId) || [];
    existing.push(row.directionId);
    goalToDirections.set(row.goalId, existing);
  }

  // Count goals per direction
  const goalCountByDirection = new Map<string, number>();
  for (const row of directionGoals) {
    goalCountByDirection.set(
      row.directionId,
      (goalCountByDirection.get(row.directionId) || 0) + 1,
    );
  }

  // Build OrbitNode arrays
  const directionNodes: OrbitNode[] = directions.map((d) => {
    const goalCount = goalCountByDirection.get(d.id) || 0;
    return {
      id: d.id,
      label: d.title,
      type: 'direction' as const,
      size: 20 + goalCount * 4,
      color: STATUS_COLORS[d.status] || STATUS_COLORS.active,
      status: d.status,
      goalCount,
    };
  });

  const goalNodes: OrbitNode[] = goals.map((g) => {
    const progress = seedProgressMap.get(g.id);
    const seedProg = progress && progress.total > 0 ? progress.done / progress.total : 0;
    // A goal can belong to multiple directions; take the first as primary parent for layout
    const parentDirs = goalToDirections.get(g.id) || [];
    return {
      id: g.id,
      label: g.title,
      type: 'goal' as const,
      parentId: parentDirs[0] || undefined,
      size: 8 + seedProg * 8,
      color: GOAL_STATUS_COLORS[g.status] || GOAL_STATUS_COLORS.planned,
      status: g.status,
      seedProgress: seedProg,
    };
  });

  // Build priority set data with direction mappings
  const prioritySetData = prioritySets.map((ps) => ({
    id: ps.id,
    name: ps.name,
    color: ps.color,
    directionIds: directionPrioritySets
      .filter((row) => row.prioritySetId === ps.id)
      .map((row) => row.directionId),
  }));

  return (
    <ConstellationPageClient
      directionNodes={directionNodes}
      goalNodes={goalNodes}
      prioritySets={prioritySetData}
    />
  );
}
