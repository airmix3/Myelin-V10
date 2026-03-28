import { sqlite } from '@/lib/db';
import { generateId } from '@/lib/id';
import { eventBus } from '@/lib/events';

export interface ActivityLogEntry {
  id: string;
  taskId: string | null;
  agentId: string | null;
  actionType: string;
  description: string | null;
  metadata: string | null;
  createdAt: string;
}

interface InsertActivityLogOptions {
  taskId?: string | null;
  agentId?: string | null;
  actionType: string;
  description?: string | null;
  metadata?: unknown;
}

export function insertActivityLog({
  taskId = null,
  agentId = null,
  actionType,
  description = null,
  metadata,
}: InsertActivityLogOptions): ActivityLogEntry {
  const id = generateId('log');
  const metadataJson = metadata === undefined ? null : JSON.stringify(metadata);
  const createdAt = new Date().toISOString();

  sqlite.prepare(`
    INSERT INTO activity_log (id, taskId, agentId, actionType, description, metadata, createdAt)
    VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
  `).run(id, taskId, agentId, actionType, description, metadataJson);

  const entry: ActivityLogEntry = {
    id,
    taskId,
    agentId,
    actionType,
    description,
    metadata: metadataJson,
    createdAt,
  };

  eventBus.emit('task:activity', entry);
  return entry;
}
