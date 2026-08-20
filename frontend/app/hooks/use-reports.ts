import { useQuery } from "@tanstack/react-query";

import { api } from "@/lib/api";
import type {
  DepartmentActivitiesReport,
  EmployeePerformanceReport,
  LeaveStatisticsReport,
} from "@/types";

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------

export const reportKeys = {
  all: ["reports"] as const,
  employeePerformance: (from: string, to: string, department: string | undefined) =>
    ["reports", "employee-performance", { from, to, department }] as const,
  leaveStatistics: (from: string, to: string, department: string | undefined) =>
    ["reports", "leave-statistics", { from, to, department }] as const,
  departmentActivities: (from: string, to: string) =>
    ["reports", "department-activities", { from, to }] as const,
};

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export interface ReportQueryParams {
  from: string;
  to: string;
  department?: string;
}

/** Admin: employee performance report. */
export function useEmployeePerformanceReport(params: ReportQueryParams) {
  const { from, to, department } = params;

  return useQuery({
    queryKey: reportKeys.employeePerformance(from, to, department),
    queryFn: async () => {
      const { data } = await api.get<EmployeePerformanceReport>(
        "/reports/employee-performance",
        {
          params: {
            from,
            to,
            ...(department ? { department } : {}),
          },
        }
      );
      return data;
    },
  });
}

/** Admin: leave statistics report. */
export function useLeaveStatisticsReport(params: ReportQueryParams) {
  const { from, to, department } = params;

  return useQuery({
    queryKey: reportKeys.leaveStatistics(from, to, department),
    queryFn: async () => {
      const { data } = await api.get<LeaveStatisticsReport>(
        "/reports/leave-statistics",
        {
          params: {
            from,
            to,
            ...(department ? { department } : {}),
          },
        }
      );
      return data;
    },
  });
}

/** Admin: department activities report. */
export function useDepartmentActivitiesReport(
  params: Pick<ReportQueryParams, "from" | "to">
) {
  const { from, to } = params;

  return useQuery({
    queryKey: reportKeys.departmentActivities(from, to),
    queryFn: async () => {
      const { data } = await api.get<DepartmentActivitiesReport>(
        "/reports/department-activities",
        { params: { from, to } }
      );
      return data;
    },
  });
}
