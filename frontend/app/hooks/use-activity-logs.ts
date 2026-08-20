import { useQuery } from "@tanstack/react-query";

import { api } from "@/lib/api";
import type { ActivityLogListResponse } from "@/types";

export const activityLogKeys = {
  list: (search: string, page: number, pageSize: number) =>
    ["activity-logs", search, page, pageSize] as const,
};

/** Admin: paginated activity log, newest first, with optional search. */
export function useActivityLogs(page: number, pageSize: number, search = "") {
  return useQuery({
    queryKey: activityLogKeys.list(search, page, pageSize),
    queryFn: async () => {
      const { data } = await api.get<ActivityLogListResponse>("/activity-logs", {
        params: {
          limit: pageSize,
          offset: (page - 1) * pageSize,
          ...(search ? { search } : {}),
        },
      });
      return data;
    },
    // Keep the previous page visible while flipping pages (no full-screen flicker).
    placeholderData: (previous) => previous,
  });
}
