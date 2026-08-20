import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useToast } from "@/hooks/use-toast";
import { api, getErrorMessage } from "@/lib/api";
import type {
  FeedbackInput,
  FeedbackListResponse,
  FeedbackResponse,
  FeedbackStatusFilter,
  FeedbackUpdateInput,
} from "@/types";

/** All feedback-related keys share the `["feedback"]` prefix so one invalidation refreshes everything. */
export const feedbackKeys = {
  mine: (status: FeedbackStatusFilter, search: string, limit: number | null, offset: number) =>
    ["feedback", "mine", status, { search, limit, offset }] as const,
  list: (
    status: FeedbackStatusFilter,
    category: string,
    search: string,
    limit: number | null,
    offset: number
  ) => ["feedback", "list", status, category, { search, limit, offset }] as const,
};

export interface FeedbackQueryParams {
  status?: FeedbackStatusFilter;
  search?: string;
  limit?: number;
  offset?: number;
}

/** Any user: their own feedback submissions with optional status filter, search, and pagination. */
export function useMyFeedback(params: FeedbackQueryParams = {}) {
  const { status = "all", search = "", limit, offset = 0 } = params;

  return useQuery({
    queryKey: feedbackKeys.mine(status, search, limit ?? null, offset),
    queryFn: async () => {
      const { data } = await api.get<FeedbackListResponse>("/feedback/mine", {
        params: {
          ...(status !== "all" ? { status } : {}),
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

/** Admin: all feedback submissions, optionally filtered by status/category and searched/paginated. */
export function useFeedback(params: FeedbackQueryParams & { category?: string } = {}) {
  const { status = "all", category = "all", search = "", limit, offset = 0 } = params;

  return useQuery({
    queryKey: feedbackKeys.list(status, category, search, limit ?? null, offset),
    queryFn: async () => {
      const { data } = await api.get<FeedbackListResponse>("/feedback", {
        params: {
          ...(status !== "all" ? { status } : {}),
          ...(category !== "all" ? { category } : {}),
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

/** Any user: submits feedback (attributed or anonymous, with a category). */
export function useCreateFeedback() {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: async (input: FeedbackInput) => {
      const { data } = await api.post<FeedbackResponse>("/feedback", input);
      return data.feedback;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["feedback"] });
      toast.success("Feedback submitted");
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error));
    },
  });
}

/** Admin: responds to a submission and/or changes its status (resolve/reopen). */
export function useUpdateFeedback() {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: FeedbackUpdateInput }) => {
      const { data } = await api.patch<FeedbackResponse>(`/feedback/${id}`, input);
      return data.feedback;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["feedback"] });
      toast.success("Feedback updated");
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error));
    },
  });
}
