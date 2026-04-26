import { prisma, sqlite } from '@/lib/db';
import { generateId } from '@/lib/id';

interface DirectionRow {
  directionId: string;
  title: string;
}

/**
 * Activate a task seed: create a real task with goalId set and
 * return pre-filled context for the Tamir chat (per D-08).
 *
 * The frontend navigates to Tamir with the returned context --
 * we do NOT invoke Tamir routing from the backend.
 */
export async function activateSeed(seedId: string): Promise<{
  taskId: string;
  prefilled: {
    title: string;
    description: string;
    department: string;
    strategicContext: string;
  };
}> {
  // Load seed
  const seed = await prisma.taskSeed.findUnique({ where: { id: seedId } });
  if (!seed) {
    throw new Error(`Seed ${seedId} not found`);
  }
  if (seed.status === 'activated' && seed.taskId) {
    throw new Error(`Seed ${seedId} is already activated (task: ${seed.taskId})`);
  }

  // Load goal for strategic context
  const goal = await prisma.goal.findUnique({ where: { id: seed.goalId } });
  if (!goal) {
    throw new Error(`Goal ${seed.goalId} not found for seed ${seedId}`);
  }

  // Load direction title via junction table
  const dirRow = sqlite.prepare(`
    SELECT dg.directionId, d.title
    FROM direction_goals dg
    INNER JOIN directions d ON dg.directionId = d.id
    WHERE dg.goalId = ?
    LIMIT 1
  `).get(seed.goalId) as DirectionRow | undefined;

  // Build strategic context string
  const contextParts: string[] = [];
  if (dirRow) {
    contextParts.push(`Direction: ${dirRow.title}`);
  }
  contextParts.push(`Goal: ${goal.title}`);
  if (goal.definitionOfDone) {
    contextParts.push(`Definition of Done: ${goal.definitionOfDone}`);
  }
  if (seed.strategicContext) {
    contextParts.push(`Context: ${seed.strategicContext}`);
  }
  if (seed.roughScope) {
    contextParts.push(`Estimated scope: ${seed.roughScope}`);
  }
  const strategicContext = contextParts.join('\n');

  // Build description
  const descriptionParts: string[] = [];
  if (seed.description) descriptionParts.push(seed.description);
  descriptionParts.push(`\n---\nStrategic Context:\n${strategicContext}`);
  const description = descriptionParts.join('\n');

  const department = seed.suggestedDepartment || 'tech';

  // Create real task
  const taskId = generateId('task');
  const now = new Date().toISOString();

  await prisma.task.create({
    data: {
      id: taskId,
      title: seed.title,
      description,
      department,
      state: 'submitted',
      goalId: seed.goalId,
      metadata: JSON.stringify({
        seedId: seed.id,
        activatedAt: now,
        strategicContext,
      }),
      createdAt: now,
      updatedAt: now,
    },
  });

  // Update seed status
  await prisma.taskSeed.update({
    where: { id: seedId },
    data: {
      status: 'activated',
      taskId,
      updatedAt: now,
    },
  });

  return {
    taskId,
    prefilled: {
      title: seed.title,
      description,
      department,
      strategicContext,
    },
  };
}
