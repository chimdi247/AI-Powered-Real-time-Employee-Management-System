import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { API_BASE_URL, api } from "@/lib/api";
import type {
  Notification,
  NotificationListResponse,
  NotificationReadResponse,
  UnreadCountResponse,
} from "@/types";

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------

export const notificationKeys = {
  all: ["notifications"] as const,
  list: (limit: number | null, offset: number) =>
    ["notifications", "list", { limit, offset }] as const,
  unreadCount: ["notifications", "unread-count"] as const,
};

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/** Current user's notifications (newest first, paginated). */
export function useNotifications(params: { limit?: number; offset?: number } = {}) {
  const { limit, offset = 0 } = params;

  return useQuery({
    queryKey: notificationKeys.list(limit ?? null, offset),
    queryFn: async () => {
      const { data } = await api.get<NotificationListResponse>("/notifications", {
        params: {
          ...(limit !== undefined ? { limit, offset } : {}),
        },
      });
      return data;
    },
    placeholderData: (previous) => previous,
  });
}

/** Unread notification count — used for the badge. Polls every 30s as fallback. */
export function useUnreadCount() {
  return useQuery({
    queryKey: notificationKeys.unreadCount,
    queryFn: async () => {
      const { data } = await api.get<UnreadCountResponse>("/notifications/unread-count");
      return data;
    },
    refetchInterval: 30_000, // Poll every 30s as SSE fallback
  });
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

/** Mark a single notification as read. */
export function useMarkAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.patch<NotificationReadResponse>(`/notifications/${id}/read`);
      return data.notification;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.all });
    },
  });
}

/** Mark all notifications as read. */
export function useMarkAllAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      await api.post("/notifications/read-all");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.all });
    },
  });
}

// ---------------------------------------------------------------------------
// SSE hook — real-time push notifications
// ---------------------------------------------------------------------------

type SSEStatus = "connecting" | "connected" | "disconnected";

/**
 * Opens an SSE connection to `/api/notifications/stream` and keeps it alive.
 * On receiving a notification, invalidates the notification queries so the
 * UI updates immediately.
 *
 * Reconnects automatically with exponential backoff on errors.
 * Returns the connection status for visual indicators.
 */
export function useNotificationSSE() {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<SSEStatus>("disconnected");
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryCountRef = useRef(0);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    let cancelled = false;

    function connect() {
      if (cancelled) return;

      setStatus("connecting");

      const eventSource = new EventSource(`${API_BASE_URL}/notifications/stream`, {
        withCredentials: true,
      });
      eventSourceRef.current = eventSource;

      eventSource.onopen = () => {
        if (cancelled) return;
        setStatus("connected");
        retryCountRef.current = 0; // Reset backoff on successful connection.
      };

      eventSource.onmessage = () => {
        if (cancelled) return;
        // Any message means there's a new notification — invalidate queries.
        void queryClient.invalidateQueries({ queryKey: notificationKeys.all });
      };

      eventSource.onerror = () => {
        if (cancelled) return;
        eventSource.close();
        eventSourceRef.current = null;
        setStatus("disconnected");

        // Exponential backoff: 1s, 2s, 4s, 8s, 16s, 30s max.
        const delay = Math.min(1000 * 2 ** retryCountRef.current, 30_000);
        retryCountRef.current += 1;

        retryTimeoutRef.current = setTimeout(() => {
          connect();
        }, delay);
      };
    }

    connect();

    return () => {
      cancelled = true;
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, [queryClient]);

  return { status };
}
