import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useToast } from "@/hooks/use-toast";
import { useSSE } from "@/hooks/use-sse";
import { api, getErrorMessage } from "@/lib/api";
import type { AiInsightListResponse, GenerateInsightInput } from "@/types";

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------

export const insightKeys = {
  all: ["ai-insights"] as const,
  list: (params?: Record<string, unknown>) =>
    [...insightKeys.all, "list", params] as const,
  detail: (id: string) => [...insightKeys.all, id] as const,
};

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export interface InsightQueryParams {
  limit?: number;
  offset?: number;
}/** Admin/head: list past insights. */
export function useInsights(params: InsightQueryParams = {}) {
  const { limit, offset = 0 } = params;
  const queryClient = useQueryClient();

  // Real-time: invalidate insight queries when any insight-ready event arrives.
  useSSE({
    event: "insight-ready",
    onEvent: () => {
      void queryClient.invalidateQueries({ queryKey: insightKeys.all });
    },
  });

  return useQuery({
    queryKey: insightKeys.list({ limit, offset }),
    queryFn: async () => {
      const { data } = await api.get<AiInsightListResponse>("/ai-insights", {
        params: {
          ...(limit !== undefined ? { limit, offset } : {}),
        },
      });
      return data;
    },
  });
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

/** Admin/head: trigger AI insight generation. */
export function useGenerateInsight() {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: async (input: GenerateInsightInput) => {
      const { data } = await api.post<{ insight: { _id: string } }>(
        "/ai-insights/generate",
        input
      );
      return data.insight;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: insightKeys.all });
      toast.success("Insight generation started. This may take a minute.");
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error));
    },
  });
}

/** Admin-only: delete an insight. */
export function useDeleteInsight() {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/ai-insights/${id}`);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: insightKeys.all });
      toast.success("Insight deleted.");
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error));
    },
  });
}
