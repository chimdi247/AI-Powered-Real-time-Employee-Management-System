import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { usersKeys } from "@/hooks/use-users";
import { useToast } from "@/hooks/use-toast";
import { api, getErrorMessage } from "@/lib/api";
import type {
  Department,
  DepartmentInput,
  DepartmentListResponse,
  DepartmentResponse,
  MyDepartmentResponse,
} from "@/types";

export const departmentKeys = {
  all: ["departments"] as const,
  list: (search: string, limit: number | null, offset: number) =>
    ["departments", "list", { search, limit, offset }] as const,
  detail: (id: string) => ["departments", id] as const,
};

export const myDepartmentKeys = {
  all: ["my-department"] as const,
};

export interface DepartmentQueryParams {
  search?: string;
  limit?: number;
  offset?: number;
}

/**
 * Admin: departments with member counts, optional server-side search (name/description)
 * and pagination. With no params (or no `limit`) the endpoint returns ALL departments
 * — used by the New/Edit user dialog combobox.
 */
export function useDepartments(params: DepartmentQueryParams = {}) {
  const { search = "", limit, offset = 0 } = params;

  return useQuery({
    queryKey: departmentKeys.list(search, limit ?? null, offset),
    queryFn: async () => {
      const { data } = await api.get<DepartmentListResponse>("/departments", {
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

/** Admin: department detail including its members. */
export function useDepartment(id?: string) {
  return useQuery({
    queryKey: departmentKeys.detail(id ?? ""),
    queryFn: async () => {
      const { data } = await api.get<DepartmentResponse>(`/departments/${id}`);
      return data.department;
    },
    enabled: Boolean(id),
  });
}

/** Any user: their own department (null when unassigned). */
export function useMyDepartment() {
  return useQuery({
    queryKey: myDepartmentKeys.all,
    queryFn: async () => {
      const { data } = await api.get<MyDepartmentResponse>("/departments/mine");
      return data.department;
    },
  });
}

/** Admin: creates a department. */
export function useCreateDepartment() {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: async (input: DepartmentInput) => {
      const { data } = await api.post<DepartmentResponse>("/departments", input);
      return data.department;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: departmentKeys.all });
      toast.success("Department created successfully");
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error));
    },
  });
}

/** Admin: updates a department's name/description. */
export function useUpdateDepartment() {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: DepartmentInput }) => {
      const { data } = await api.patch<DepartmentResponse>(`/departments/${id}`, input);
      return data.department;
    },
    onSuccess: (_department, { id }) => {
      queryClient.invalidateQueries({ queryKey: departmentKeys.all });
      queryClient.invalidateQueries({ queryKey: departmentKeys.detail(id) });
      toast.success("Department updated successfully");
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error));
    },
  });
}

/** Admin: deletes a department (members are unassigned server-side). */
export function useDeleteDepartment() {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/departments/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: departmentKeys.all });
      queryClient.invalidateQueries({ queryKey: usersKeys.all });
      toast.success("Department deleted successfully");
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error));
    },
  });
}

/** Admin: replaces a department's member list (assign/unassign in one call). */
export function useSetDepartmentEmployees() {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: async ({ id, userIds }: { id: string; userIds: string[] }) => {
      const { data } = await api.put<DepartmentResponse>(`/departments/${id}/employees`, {
        userIds,
      });
      return data.department;
    },
    onSuccess: (_department, { id }) => {
      queryClient.invalidateQueries({ queryKey: departmentKeys.all });
      queryClient.invalidateQueries({ queryKey: departmentKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: usersKeys.all });
      toast.success("Department members updated");
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error));
    },
  });
}
