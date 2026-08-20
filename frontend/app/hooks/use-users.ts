import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { meKeys } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { api, getErrorMessage } from "@/lib/api";
import type {
  CreateUserInput,
  UpdateProfileInput,
  UpdateUserInput,
  UserResponse,
  UsersListResponse,
} from "@/types";

export const usersKeys = {
  all: ["users"] as const,
  list: (search: string, limit: number | null, offset: number) =>
    ["users", "list", { search, limit, offset }] as const,
};

export interface UsersQueryParams {
  search?: string;
  limit?: number;
  offset?: number;
}

/**
 * Admin: user roster with optional server-side search (name/email) and pagination.
 * With no params (or no `limit`) the endpoint returns ALL users — used by the
 * Manage Members dialog and department assignment.
 */
export function useUsers(params: UsersQueryParams = {}) {
  const { search = "", limit, offset = 0 } = params;

  return useQuery({
    queryKey: usersKeys.list(search, limit ?? null, offset),
    queryFn: async () => {
      const { data } = await api.get<UsersListResponse>("/users", {
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

/** Admin: creates a user. */
export function useCreateUser() {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: async (input: CreateUserInput) => {
      const { data } = await api.post<UserResponse>("/users", input);
      return data.user;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: usersKeys.all });
      toast.success("User created successfully");
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error));
    },
  });
}

/** Admin: updates a user's details (role, department, optional password reset). */
export function useUpdateUser() {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: UpdateUserInput }) => {
      const { data } = await api.patch<UserResponse>(`/users/${id}`, input);
      return data.user;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: usersKeys.all });
      toast.success("User updated successfully");
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error));
    },
  });
}

/** Admin: deletes a user (the admin's own account is rejected server-side). */
export function useDeleteUser() {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/users/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: usersKeys.all });
      toast.success("User deleted successfully");
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error));
    },
  });
}

/**
 * Any user: updates own name/password (`PATCH /users/me`). Seeds the `me` cache
 * with the response so the sidebar/name stay in sync instantly (the `me` query
 * is `staleTime: Infinity`).
 */
export function useUpdateProfile() {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: async (input: UpdateProfileInput) => {
      const { data } = await api.patch<UserResponse>("/users/me", input);
      return data.user;
    },
    onSuccess: (user) => {
      queryClient.setQueryData(meKeys.all, user);
      queryClient.invalidateQueries({ queryKey: usersKeys.all });
      toast.success("Profile updated successfully");
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error));
    },
  });
}
