/**
 * Canvas Abstraction Layer
 *
 * Canvas-library-agnostic interface for node creation, manipulation,
 * and serialization. Consumers use CanvasAdapter -- never Excalidraw directly.
 * The createExcalidrawAdapter factory wraps an ExcalidrawImperativeAPI ref
 * for programmatic access.
 */

import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';
import { convertToExcalidrawElements } from '@excalidraw/excalidraw';

// ---------------------------------------------------------------------------
// Library-agnostic interfaces
// ---------------------------------------------------------------------------

export type StrategicNodeType =
  | 'idea'
  | 'direction'
  | 'goal'
  | 'question'
  | 'annotation';

export interface CanvasNode {
  id: string;
  type: StrategicNodeType;
  x: number;
  y: number;
  width: number;
  height: number;
  content: string;
  color?: string;
  metadata?: Record<string, unknown>;
}

export interface CanvasConnection {
  id: string;
  fromId: string;
  toId: string;
  label?: string;
}

export interface CanvasState {
  nodes: CanvasNode[];
  connections: CanvasConnection[];
  viewport: { x: number; y: number; zoom: number };
}

export interface CanvasAdapter {
  createNode(node: Omit<CanvasNode, 'id'>): string;
  updateNode(id: string, updates: Partial<CanvasNode>): void;
  removeNode(id: string): void;
  createConnection(conn: Omit<CanvasConnection, 'id'>): string;
  removeConnection(id: string): void;
  getState(): CanvasState;
  loadState(state: CanvasState): void;
  /** Returns the library-native snapshot format for persistence */
  getSnapshot(): object;
  /** Loads a library-native snapshot (previously returned by getSnapshot) */
  loadSnapshot(snapshot: object): void;
}

// ---------------------------------------------------------------------------
// Default node-type colors
// ---------------------------------------------------------------------------

export const NODE_TYPE_COLORS: Record<StrategicNodeType, string> = {
  idea: '#f59e0b',       // amber
  direction: '#8b5cf6',  // purple
  goal: '#3b82f6',       // blue
  question: '#ef4444',   // red
  annotation: '#6b7280', // gray
};

// ---------------------------------------------------------------------------
// Excalidraw adapter factory
// ---------------------------------------------------------------------------

/**
 * Creates a CanvasAdapter backed by an ExcalidrawImperativeAPI ref.
 * The ref is mutable so it can be set after Excalidraw mounts.
 */
export function createExcalidrawAdapter(
  apiRef: { current: ExcalidrawImperativeAPI | null },
): CanvasAdapter {
  function generateId(): string {
    return crypto.randomUUID();
  }

  return {
    createNode(node: Omit<CanvasNode, 'id'>): string {
      const api = apiRef.current;
      if (!api) {
        console.warn('[CanvasAdapter] createNode called before Excalidraw is ready');
        return '';
      }

      const id = generateId();
      const color = node.color ?? NODE_TYPE_COLORS[node.type] ?? '#f59e0b';

      // Create a rectangle with a text label using convertToExcalidrawElements
      const elements = convertToExcalidrawElements([
        {
          type: 'rectangle',
          id,
          x: node.x,
          y: node.y,
          width: node.width,
          height: node.height,
          backgroundColor: color,
          fillStyle: 'solid',
          opacity: 80,
          strokeColor: color,
          roundness: { type: 3 },
          label: {
            text: node.content,
            fontSize: 14,
            textAlign: 'center',
            verticalAlign: 'middle',
          },
        },
      ]);

      const existing = api.getSceneElements();
      api.updateScene({ elements: [...existing, ...elements] });
      return id;
    },

    updateNode(id: string, updates: Partial<CanvasNode>): void {
      const api = apiRef.current;
      if (!api) {
        console.warn('[CanvasAdapter] updateNode called before Excalidraw is ready');
        return;
      }

      const elements = api.getSceneElements().map((el) => {
        if (el.id === id) {
          const patched: Record<string, unknown> = { ...el };
          if (updates.x !== undefined) patched.x = updates.x;
          if (updates.y !== undefined) patched.y = updates.y;
          if (updates.width !== undefined) patched.width = updates.width;
          if (updates.height !== undefined) patched.height = updates.height;
          return patched as typeof el;
        }
        return el;
      });

      api.updateScene({ elements });
    },

    removeNode(id: string): void {
      const api = apiRef.current;
      if (!api) {
        console.warn('[CanvasAdapter] removeNode called before Excalidraw is ready');
        return;
      }

      // Remove the element and any bound text elements
      const elements = api.getSceneElements().filter(
        (el) => el.id !== id && (el as Record<string, unknown>).containerId !== id,
      );
      api.updateScene({ elements });
    },

    createConnection(conn: Omit<CanvasConnection, 'id'>): string {
      console.warn('[CanvasAdapter] createConnection is a stub -- not yet implemented for Excalidraw');
      return '';
    },

    removeConnection(id: string): void {
      console.warn('[CanvasAdapter] removeConnection is a stub -- not yet implemented for Excalidraw');
    },

    getState(): CanvasState {
      console.warn('[CanvasAdapter] getState is a stub -- use getSnapshot for persistence');
      return { nodes: [], connections: [], viewport: { x: 0, y: 0, zoom: 1 } };
    },

    loadState(_state: CanvasState): void {
      console.warn('[CanvasAdapter] loadState is a stub -- use loadSnapshot for persistence');
    },

    getSnapshot(): object {
      const api = apiRef.current;
      if (!api) {
        return { elements: [], appState: {} };
      }
      return {
        elements: api.getSceneElements(),
        appState: api.getAppState(),
      };
    },

    loadSnapshot(snapshot: object): void {
      const api = apiRef.current;
      if (!api) {
        console.warn('[CanvasAdapter] loadSnapshot called before Excalidraw is ready');
        return;
      }
      const snap = snapshot as Record<string, unknown>;
      if (snap.elements && Array.isArray(snap.elements)) {
        api.updateScene({
          elements: snap.elements as Parameters<typeof api.updateScene>[0]['elements'],
        });
      }
    },
  };
}
