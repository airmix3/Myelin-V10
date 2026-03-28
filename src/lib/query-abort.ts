/**
 * Query Abort -- Provides abort functionality for running SDK query() instances.
 * Works with the query registry to stop running agent invocations.
 */
import { getQueryRef, unregisterQueryRef } from '@/lib/mcp/query-registry';
import { logger } from '@/lib/logger';

const log = logger.child({ module: 'query-abort' });

/**
 * Abort a running SDK query by runId.
 * The SDK query object supports .abort() to stop the tool loop gracefully.
 * The session state is preserved via sessionId for later resume.
 */
export function abortQuery(runId: string): void {
  const q = getQueryRef(runId);
  if (!q) {
    log.warn({ runId }, 'No query ref found for abort -- may have already completed');
    return;
  }

  try {
    if (typeof q.abort === 'function') {
      q.abort();
      log.info({ runId }, 'Query aborted successfully');
    } else if (typeof q.return === 'function') {
      // Async generator -- force return
      q.return(undefined);
      log.info({ runId }, 'Query generator returned');
    } else {
      log.warn({ runId }, 'Query ref has no abort or return method');
    }
  } catch (err) {
    log.error({ err, runId }, 'Error aborting query');
  }

  unregisterQueryRef(runId);
}
