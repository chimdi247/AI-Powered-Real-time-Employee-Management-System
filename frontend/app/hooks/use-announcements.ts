import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useToast } from "@/hooks/use-toast";
import { useSSE } from "@/hooks/use-sse";
import { api, getErrorMessage } from "@/lib/api";
import type {
  AnnouncementInput,
  AnnouncementListResponse,
  AnnouncementResponse,
} from "@/types";

export const announcementKeys = {
  all: ["announcements"] as const,
  list: (search: string, limit: number | null, offset: number) =>
    ["announcements", "list", { search, limit, offset }] as const,
};

export interface AnnouncementsQueryParams {
  search?: string;
  limit?: number;
  offset?: number;
}

/**
 * Announcements the current user can see (employees/heads: their department's;
 * admins: all) with optional server-side search (title/body) and pagination.
 */
export function useAnnouncements(params: AnnouncementsQueryParams = {}) {
  const { search = "", limit, offset = 0 } = params;
  const queryClient = useQueryClient();

  // Real-time: invalidate announcement queries when any announcement-new event arrives.
  useSSE({
    event: "announcement-new",
    onEvent: () => {
      void queryClient.invalidateQueries({ queryKey: announcementKeys.all });
    },
  });

  return useQuery({
    queryKey: announcementKeys.list(search, limit ?? null, offset),
    queryFn: async () => {
      const { data } = await api.get<AnnouncementListResponse>("/announcements", {
        params: {
          ...(search ? { search } : {}),
          ...(limit !== undefined ? { limit, offset } : {}),
        },
      });
      return data;
    },
    // Keep the previous page visible while flipping pages.
    placeholderData: (previous) => previous,
  });
}

/** Head or admin: creates an announcement (heads post to their own department). */
export function useCreateAnnouncement() {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: async (input: AnnouncementInput) => {
      const { data } = await api.post<AnnouncementResponse>("/announcements", input);
      return data.announcement;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: announcementKeys.all });
      toast.success("Announcement created");
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error));
    },
  });
}

/** Head or admin: updates an announcement (heads only their own department's). */
export function useUpdateAnnouncement() {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: AnnouncementInput }) => {
      const { data } = await api.patch<AnnouncementResponse>(`/announcements/${id}`, input);
      return data.announcement;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: announcementKeys.all });
      toast.success("Announcement updated");
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error));
    },
  });
}

/** Admin-only: deletes an announcement. */
export function useDeleteAnnouncement() {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/announcements/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: announcementKeys.all });
      toast.success("Announcement deleted");
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error));
    },
  });
}
