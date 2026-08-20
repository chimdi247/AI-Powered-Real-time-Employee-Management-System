import { useQuery } from "@tanstack/react-query";

import { api } from "@/lib/api";
import type { DashboardAnalytics, EmployeeDashboardAnalytics } from "@/types";

// ---------------------------------------------------------------------------

export const dashboardKeys = {
  all: ["dashboard"] as const,
  analytics: () => ["dashboard", "analytics"] as const,
  employee: () => ["dashboard", "employee"] as const,
};

/**
 * Admin/head: org-wide aggregated dashboard analytics.
 * Returns `data` scoped to `DashboardAnalytics`.
 */
export function useDashboardAnalytics() {
  return useQuery({
    queryKey: dashboardKeys.analytics(),
    queryFn: async () => {
      const { data } = await api.get<DashboardAnalytics>("/dashboard/analytics");
      return data;
    },
  });
}

/**
 * Employee: personal dashboard stats (attendance, leaves, tasks).
 * Returns `data` scoped to `EmployeeDashboardAnalytics`.
 */
export function useEmployeeDashboard() {
  return useQuery({
    queryKey: dashboardKeys.employee(),
    queryFn: async () => {
      const { data } = await api.get<EmployeeDashboardAnalytics>("/dashboard/my");
      return data;
    },
  });
}
