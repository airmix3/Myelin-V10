import { EventEmitter } from 'events';

/**
 * SSE Event Bus -- single shared instance imported by all emitters and subscribers.
 * Per FOUND-05: all emitters and subscribers import from this one module.
 *
 * Usage:
 *   eventBus.emit('task:transition', { taskId, from, to })  -- emit typed event
 *   eventBus.on('event', handler)  -- subscribe to all events (SSE endpoint)
 */
class SSEEventBus extends EventEmitter {
  /**
   * Override emit to wrap all events in a standard envelope.
   * Callers: eventBus.emit('task:transition', { ...data })
   * Listeners on 'event' receive: { type: 'task:transition', data: { ...data } }
   */
  emit(type: string, data?: unknown): boolean {
    if (type === 'event') {
      // Direct 'event' emission -- pass through
      return super.emit('event', data);
    }
    // Wrap in envelope for SSE subscribers
    return super.emit('event', { type, data });
  }
}

// Singleton -- survives HMR in development
const globalForEvents = globalThis as typeof globalThis & {
  __sseEventBus?: SSEEventBus;
};

export const eventBus: SSEEventBus = globalForEvents.__sseEventBus ??= (() => {
  const bus = new SSEEventBus();
  // Prevent MaxListenersExceededWarning (default is 10)
  // Single-user app, but multiple SSE connections possible during dev/testing
  bus.setMaxListeners(50);
  return bus;
})();
