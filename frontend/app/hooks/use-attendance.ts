import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useToast } from "@/hooks/use-toast";
import { useSSE } from "@/hooks/use-sse";
import { api, getErrorMessage } from "@/lib/api";
import type {
  AttendanceInput,
  AttendanceListResponse,
  AttendanceMarkResponse,
  AttendanceResponse,
  AttendanceStatsResponse,
  AttendanceUpdateInput,
} from "@/types";

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------

export const attendanceKeys = {
  all: ["attendance"] as const,
  mine: (from: string, to: string, limit: number | null, offset: number) =>
    ["attendance", "mine", { from, to, limit, offset }] as const,
  department: (date: string, from: string, to: string, department: string | undefined, limit: number | null, offset: number) =>
    ["attendance", "department", { date, from, to, department, limit, offset }] as const,
  stats: (from: string, to: string, department: string | undefined) =>
    ["attendance", "stats", { from, to, department }] as const,
};

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/** Any user: their own attendance records. */
export function useMyAttendance(params: {
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
} = {}) {
  const { from = "", to = "", limit, offset = 0 } = params;
  const queryClient = useQueryClient();

  // Real-time: invalidate attendance queries when any attendance-updated event arrives.
  useSSE({
    event: "attendance-updated",
    onEvent: () => {
      void queryClient.invalidateQueries({ queryKey: attendanceKeys.all });
    },
  });

  return useQuery({
    queryKey: attendanceKeys.mine(from, to, limit ?? null, offset),
    queryFn: async () => {
      const { data } = await api.get<AttendanceListResponse>("/attendance/mine", {
        params: {
          ...(from ? { from } : {}),
          ...(to ? { to } : {}),
          ...(limit !== undefined ? { limit, offset } : {}),
        },
      });
      return data;
    },
    placeholderData: (previous) => previous,
  });
}

/** Head or admin: department attendance for a date or date range. */
export function useDepartmentAttendance(params: {
  date?: string;
  from?: string;
  to?: string;
  department?: string;
  limit?: number;
  offset?: number;
} = {}) {
  const { date = "", from = "", to = "", department, limit, offset = 0 } = params;

  return useQuery({
    queryKey: attendanceKeys.department(date, from, to, department, limit ?? null, offset),
    queryFn: async () => {
      const { data } = await api.get<AttendanceListResponse>("/attendance/department", {
        params: {
          ...(date ? { date } : {}),
          ...(from ? { from } : {}),
          ...(to ? { to } : {}),
          ...(department ? { department } : {}),
          ...(limit !== undefined ? { limit, offset } : {}),
        },
      });
      return data;
    },
    placeholderData: (previous) => previous,
  });
}

/** Admin: attendance statistics. */
export function useAttendanceStats(params: {
  from?: string;
  to?: string;
  department?: string;
} = {}) {
  const { from = "", to = "", department } = params;

  return useQuery({
    queryKey: attendanceKeys.stats(from, to, department),
    queryFn: async () => {
      const { data } = await api.get<AttendanceStatsResponse>("/attendance/stats", {
        params: {
          ...(from ? { from } : {}),
          ...(to ? { to } : {}),
          ...(department ? { department } : {}),
        },
      });
      return data.stats;
    },
  });
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

/** Head or admin: mark attendance for one or more employees. */
export function useMarkAttendance() {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: async (input: AttendanceInput) => {
      const { data } = await api.post<AttendanceMarkResponse>("/attendance", input);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: attendanceKeys.all });
      toast.success("Attendance recorded");
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error));
    },
  });
}

/** Head or admin: update an existing attendance record. */
export function useUpdateAttendance() {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: AttendanceUpdateInput }) => {
      const { data } = await api.patch<AttendanceResponse>(`/attendance/${id}`, input);
      return data.attendance;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: attendanceKeys.all });
      toast.success("Attendance updated");
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error));
    },
  });
}
