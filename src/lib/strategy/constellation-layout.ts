/**
 * Orbital layout engine for the strategic constellation.
 *
 * Distributes direction nodes in a circle around the viewport center,
 * then orbits each direction's goals around it at fixed radii.
 * No force simulation -- deterministic trigonometric positioning (D-03).
 */

export interface OrbitNode {
  id: string;
  label: string;
  type: 'direction' | 'goal';
  parentId?: string;   // For goals: the direction they orbit
  size: number;        // Radius: derived from activity/progress
  color: string;       // Primary color for the node
  status: string;      // For visual styling
  goalCount?: number;  // For directions: number of goals
  seedProgress?: number; // For goals: completed/total seeds (0-1)
}

export interface PositionedNode {
  x: number;
  y: number;
  r: number; // Rendered radius
}

export const STATUS_COLORS: Record<string, string> = {
  active: '#8b5cf6',     // Purple
  paused: '#6b7280',     // Gray
  completed: '#22c55e',  // Green
  abandoned: '#ef4444',  // Red
};

export const GOAL_STATUS_COLORS: Record<string, string> = {
  planned: '#6b7280',    // Gray
  active: '#3b82f6',     // Blue
  'at-risk': '#f59e0b',  // Amber
  completed: '#22c55e',  // Green
  abandoned: '#ef4444',  // Red
};

/**
 * Calculate orbital positions for all direction and goal nodes.
 *
 * - Directions are placed in a circle around the viewport center.
 * - Goals orbit their parent direction at a fixed radius.
 * - Returns a Map keyed by node id with { x, y, r }.
 */
export function calculateOrbitalPositions(
  directions: OrbitNode[],
  goals: OrbitNode[],
  width: number,
  height: number,
): Map<string, PositionedNode> {
  const positions = new Map<string, PositionedNode>();

  if (directions.length === 0) return positions;

  const cx = width / 2;
  const cy = height / 2;

  // Group goals by parentId for efficient lookup
  const goalsByDirection = new Map<string, OrbitNode[]>();
  for (const goal of goals) {
    if (!goal.parentId) continue;
    const existing = goalsByDirection.get(goal.parentId) || [];
    existing.push(goal);
    goalsByDirection.set(goal.parentId, existing);
  }

  // Direction circle radius: 30% of the smaller viewport dimension
  const directionOrbitRadius = Math.min(width, height) * 0.3;

  for (let i = 0; i < directions.length; i++) {
    const dir = directions[i];
    const dirGoals = goalsByDirection.get(dir.id) || [];
    const goalCount = dirGoals.length;

    // Single direction goes to center; multiple spread evenly
    let dx: number, dy: number;
    if (directions.length === 1) {
      dx = cx;
      dy = cy;
    } else {
      const angle = (2 * Math.PI * i) / directions.length - Math.PI / 2;
      dx = cx + directionOrbitRadius * Math.cos(angle);
      dy = cy + directionOrbitRadius * Math.sin(angle);
    }

    // Direction node radius: base 24, scales by goal count
    const dirRadius = 24 + Math.min(goalCount, 8) * 3;
    positions.set(dir.id, { x: dx, y: dy, r: dirRadius });

    // Distribute goals around the direction
    if (dirGoals.length === 0) continue;

    const goalOrbitRadius = 60 + goalCount * 12;
    for (let j = 0; j < dirGoals.length; j++) {
      const goal = dirGoals[j];
      const goalAngle = (2 * Math.PI * j) / dirGoals.length - Math.PI / 2;
      const gx = dx + goalOrbitRadius * Math.cos(goalAngle);
      const gy = dy + goalOrbitRadius * Math.sin(goalAngle);

      // Goal node radius: base 10, scales by seed progress
      const goalRadius = 8 + (goal.seedProgress ?? 0) * 8;
      positions.set(goal.id, { x: gx, y: gy, r: goalRadius });
    }
  }

  return positions;
}
