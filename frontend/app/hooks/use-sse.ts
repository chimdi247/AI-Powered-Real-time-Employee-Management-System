import { useEffect, useRef, useState } from "react";

import { API_BASE_URL } from "@/lib/api";
import type { SSEEvent, SSEEventType } from "@/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SSEStatus = "connecting" | "connected" | "disconnected";

interface UseSSEOptions {
  /** Filter to a specific event type. If omitted, all events are received. */
  event?: SSEEventType;
  /** Callback invoked when a matching event is received. */
  onEvent?: (event: SSEEvent) => void;
  /** Set to false to disable the connection. Default: true. */
  enabled?: boolean;
}

// ---------------------------------------------------------------------------
// Shared connection manager
// ---------------------------------------------------------------------------

/**
 * Maintains a single EventSource connection per user. Multiple `useSSE` hooks
 * share the same connection and register their callbacks in a listeners set.
 */
let sharedEventSource: EventSource | null = null;
let sharedStatus: SSEStatus = "disconnected";
let retryCount = 0;
let retryTimeout: ReturnType<typeof setTimeout> | null = null;

type Listener = (event: SSEEvent) => void;
const listeners = new Set<Listener>();

function connect(): void {
  if (sharedEventSource) return;

  sharedStatus = "connecting";
  notifyStatusListeners();

  const es = new EventSource(`${API_BASE_URL}/notifications/stream`, {
    withCredentials: true,
  });
  sharedEventSource = es;

  es.onopen = () => {
    sharedStatus = "connected";
    retryCount = 0;
    notifyStatusListeners();
  };

  es.onmessage = (msg) => {
    try {
      const event = JSON.parse(msg.data) as SSEEvent;
      for (const listener of listeners) {
        listener(event);
      }
    } catch {
      // Ignore malformed messages (heartbeats, etc.)
    }
  };

  es.onerror = () => {
    es.close();
    sharedEventSource = null;
    sharedStatus = "disconnected";
    notifyStatusListeners();

    // Exponential backoff: 1s, 2s, 4s, 8s, 16s, 30s max.
    const delay = Math.min(1000 * 2 ** retryCount, 30_000);
    retryCount += 1;

    retryTimeout = setTimeout(() => {
      retryTimeout = null;
      connect();
    }, delay);
  };
}

function disconnect(): void {
  if (retryTimeout) {
    clearTimeout(retryTimeout);
    retryTimeout = null;
  }
  if (sharedEventSource) {
    sharedEventSource.close();
    sharedEventSource = null;
  }
  sharedStatus = "disconnected";
  retryCount = 0;
}

// ---------------------------------------------------------------------------
// Status listeners (for the useSSEStatus hook)
// ---------------------------------------------------------------------------

type StatusListener = (status: SSEStatus) => void;
const statusListeners = new Set<StatusListener>();

function notifyStatusListeners(): void {
  for (const listener of statusListeners) {
    listener(sharedStatus);
  }
}

// ---------------------------------------------------------------------------
// useSSE — general-purpose event hook
// ---------------------------------------------------------------------------

/**
 * Listens for SSE events from the shared connection.
 *
 * ```ts
 * useSSE({
 *   event: "task-updated",
 *   onEvent: (e) => console.log("Task updated:", e.data),
 * });
 * ```
 */
export function useSSE(options: UseSSEOptions = {}): { status: SSEStatus } {
  const { event, onEvent, enabled = true } = options;
  const onEventRef = useRef(onEvent);
  const [status, setStatus] = useState<SSEStatus>(sharedStatus);

  // Keep the callback ref fresh without re-triggering the effect.
  onEventRef.current = onEvent;

  useEffect(() => {
    if (!enabled) return;

    // Subscribe with optional event-type filter.
    const listener: Listener = (sseEvent) => {
      if (event && sseEvent.type !== event) return;
      onEventRef.current?.(sseEvent);
    };
    listeners.add(listener);

    // Ensure the shared connection is open.
    connect();

    // Track connection status.
    const statusListener: StatusListener = (s) => setStatus(s);
    statusListeners.add(statusListener);
    setStatus(sharedStatus);

    return () => {
      listeners.delete(listener);
      statusListeners.delete(statusListener);

      // Tear down the shared connection when no one is listening.
      if (listeners.size === 0) {
        disconnect();
      }
    };
  }, [event, enabled]);

  return { status };
}

// ---------------------------------------------------------------------------
// useSSEStatus — connection status only (no event handling)
// ---------------------------------------------------------------------------

/**
 * Returns the current SSE connection status without subscribing to events.
 * Useful for showing a connection indicator in the UI.
 */
export function useSSEStatus(): { status: SSEStatus } {
  const [status, setStatus] = useState<SSEStatus>(sharedStatus);

  useEffect(() => {
    const listener: StatusListener = (s) => setStatus(s);
    statusListeners.add(listener);
    setStatus(sharedStatus);

    return () => {
      statusListeners.delete(listener);
    };
  }, []);

  return { status };
}
