import { randomBytes } from 'crypto';

/**
 * Generate a prefixed ID: ${prefix}_${randomBytes(4).hex}
 * Example: generateId('task') => 'task_a1b2c3d4'
 */
export function generateId(prefix: string): string {
  return `${prefix}_${randomBytes(4).toString('hex')}`;
}
