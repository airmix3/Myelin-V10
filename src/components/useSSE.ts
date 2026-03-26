'use client';

import { useEffect, useRef } from 'react';

type SSEHandler = (data: Record<string, unknown>) => void;

export function useSSE(handlers: Record<string, SSEHandler>) {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    const es = new EventSource('/api/sse');
    const eventTypes = Object.keys(handlersRef.current);
    const listeners: Array<[string, EventListener]> = [];

    for (const type of eventTypes) {
      const listener = (evt: Event) => {
        try {
          const data = JSON.parse((evt as MessageEvent).data);
          handlersRef.current[type]?.(data);
        } catch { /* ignore parse errors */ }
      };
      es.addEventListener(type, listener);
      listeners.push([type, listener]);
    }

    // EventSource auto-reconnects per spec; explicit 3s retry as fallback
    let reconnectTimeout: ReturnType<typeof setTimeout>;
    es.onerror = () => {
      reconnectTimeout = setTimeout(() => {
        // EventSource handles reconnection natively
      }, 3000);
    };

    return () => {
      clearTimeout(reconnectTimeout);
      for (const [type, listener] of listeners) {
        es.removeEventListener(type, listener);
      }
      es.close();
    };
  }, []); // handlers must be stable refs -- caller wraps in useCallback if needed
}
