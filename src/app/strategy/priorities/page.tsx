import { prisma, sqlite } from '@/lib/db';
import PrioritiesClient from './PrioritiesClient';

interface DirectionGoalRow {
  directionId: string;
  goalId: string;
}

interface DecisionDirectionRow {
  decisionId: string;
  directionId: string;
}

interface DecisionRow {
  id: string;
  summary: string;
  createdAt: string;
}

interface GoalRow {
  id: string;
  title: string;
  status: string;
  definitionOfDone: string | null;
}

export interface DirectionWithRelations {
  id: string;
  title: string;
  rationale: string | null;
  status: string;
  priority: string;
  createdAt: string;
  updatedAt: string;
  goals: Array<{ id: string; title: string; status: string; definitionOfDone: string | null }>;
  decisions: Array<{ id: string; summary: string; createdAt: string }>;
}

export default async function PrioritiesPage() {
  // Fetch all directions
  const directions = await prisma.direction.findMany({
    orderBy: { updatedAt: 'desc' },
  });

  // Fetch all goals
  const allGoals = sqlite
    .prepare('SELECT id, title, status, definitionOfDone FROM goals')
    .all() as GoalRow[];
  const goalsById = new Map(allGoals.map((g) => [g.id, g]));

  // Fetch all decisions
  const allDecisions = sqlite
    .prepare('SELECT id, summary, createdAt FROM decision_records ORDER BY createdAt DESC')
    .all() as DecisionRow[];
  const decisionsById = new Map(allDecisions.map((d) => [d.id, d]));

  // Junction: direction_goals
  const directionGoals = sqlite
    .prepare('SELECT directionId, goalId FROM direction_goals')
    .all() as DirectionGoalRow[];

  // Junction: decision_directions
  const decisionDirections = sqlite
    .prepare('SELECT decisionId, directionId FROM decision_directions')
    .all() as DecisionDirectionRow[];

  // Build lookup maps
  const dirGoalsMap = new Map<string, GoalRow[]>();
  for (const row of directionGoals) {
    const goal = goalsById.get(row.goalId);
    if (goal) {
      const existing = dirGoalsMap.get(row.directionId) || [];
      existing.push(goal);
      dirGoalsMap.set(row.directionId, existing);
    }
  }

  const dirDecisionsMap = new Map<string, DecisionRow[]>();
  for (const row of decisionDirections) {
    const decision = decisionsById.get(row.decisionId);
    if (decision) {
      const existing = dirDecisionsMap.get(row.directionId) || [];
      existing.push(decision);
      dirDecisionsMap.set(row.directionId, existing);
    }
  }

  // Assemble directions with relations
  const directionsWithRelations: DirectionWithRelations[] = directions.map((d) => ({
    id: d.id,
    title: d.title,
    rationale: d.rationale,
    status: d.status,
    priority: d.priority,
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
    goals: (dirGoalsMap.get(d.id) || []).map((g) => ({
      id: g.id,
      title: g.title,
      status: g.status,
      definitionOfDone: g.definitionOfDone,
    })),
    decisions: (dirDecisionsMap.get(d.id) || []).map((dec) => ({
      id: dec.id,
      summary: dec.summary,
      createdAt: dec.createdAt,
    })),
  }));

  return <PrioritiesClient directions={directionsWithRelations} />;
}
