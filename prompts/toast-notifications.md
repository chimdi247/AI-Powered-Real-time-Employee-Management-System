# Toast Notifications on Mutations

## Goal

Add toast notifications to every mutation in the frontend to provide users with immediate feedback on their actions (success, error, loading states).

## Approach

### 1. Create `use-toast.ts` hook

Create `frontend/app/hooks/use-toast.ts` — a thin wrapper around the Base UI toast manager (`toast` from `@/components/ui/toast`) that provides a simple, ergonomic API:

```ts
import { toast } from "@/components/ui/toast";

export function useToast() {
  return {
    success: (message: string) => toast.open({ type: "success", title: message }),
    error: (message: string) => toast.open({ type: "error", title: message }),
    info: (message: string) => toast.open({ type: "info", title: message }),
    warning: (message: string) => toast.open({ type: "warning", title: message }),
  };
}
```

### 2. Mount `<Toaster>` in `root.tsx`

Add the `<Toaster>` provider to `frontend/app/root.tsx` so toasts render app-wide.

### 3. Update all mutation hooks

Add `onSuccess` and `onError` toast calls to every `useMutation` across:

- `use-users.ts` — `useCreateUser`, `useUpdateUser`, `useDeleteUser`, `useUpdateProfile`
- `use-departments.ts` — `useCreateDepartment`, `useUpdateDepartment`, `useDeleteDepartment`, `useSetDepartmentEmployees`
- `use-leaves.ts` — `useCreateLeave`, `useCancelLeave`, `useDecideLeave`, `useAdjustLeaveBalance`, `useUpdateLeavePolicy`
- `use-feedback.ts` — `useCreateFeedback`, `useUpdateFeedback`
- `use-announcements.ts` — `useCreateAnnouncement`, `useUpdateAnnouncement`, `useDeleteAnnouncement`
- `use-attendance.ts` — `useMarkAttendance`, `useUpdateAttendance`
- `use-performance-reviews.ts` — `useCreateReview`, `useUpdateReview`, `useAcknowledgeReview`, `useUpdateGoal`, `useDeleteReview`
- `use-notifications.ts` — `useMarkAsRead`, `useMarkAllAsRead`
- `use-auth.ts` — `useLogin`, `useLogout`

**Pattern for each mutation:**
```ts
export function useCreateFoo() {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: async (input: FooInput) => { /* ... */ },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: fooKeys.all });
      toast.success("Foo created successfully");
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error));
    },
  });
}
```

**Toast messages by operation:**

| Mutation | Success message | Error fallback |
|----------|----------------|----------------|
| Create user | "User created successfully" | `getErrorMessage(error)` |
| Update user | "User updated successfully" | `getErrorMessage(error)` |
| Delete user | "User deleted successfully" | `getErrorMessage(error)` |
| Update profile | "Profile updated successfully" | `getErrorMessage(error)` |
| Create department | "Department created successfully" | `getErrorMessage(error)` |
| Update department | "Department updated successfully" | `getErrorMessage(error)` |
| Delete department | "Department deleted successfully" | `getErrorMessage(error)` |
| Set department employees | "Department members updated" | `getErrorMessage(error)` |
| Create leave | "Leave request submitted" | `getErrorMessage(error)` |
| Cancel leave | "Leave request cancelled" | `getErrorMessage(error)` |
| Decide leave | "Leave request processed" | `getErrorMessage(error)` |
| Adjust leave balance | "Leave balance updated" | `getErrorMessage(error)` |
| Update leave policy | "Leave policy updated" | `getErrorMessage(error)` |
| Create feedback | "Feedback submitted" | `getErrorMessage(error)` |
| Update feedback | "Feedback updated" | `getErrorMessage(error)` |
| Create announcement | "Announcement created" | `getErrorMessage(error)` |
| Update announcement | "Announcement updated" | `getErrorMessage(error)` |
| Delete announcement | "Announcement deleted" | `getErrorMessage(error)` |
| Mark attendance | "Attendance recorded" | `getErrorMessage(error)` |
| Update attendance | "Attendance updated" | `getErrorMessage(error)` |
| Create review | "Review created" | `getErrorMessage(error)` |
| Update review | "Review updated" | `getErrorMessage(error)` |
| Acknowledge review | "Review acknowledged" | `getErrorMessage(error)` |
| Update goal | "Goal updated" | `getErrorMessage(error)` |
| Delete review | "Review deleted" | `getErrorMessage(error)` |
| Mark as read | *(silent — no toast)* | *(silent)* |
| Mark all as read | *(silent — no toast)* | *(silent)* |
| Login | *(silent — navigates)* | `getErrorMessage(error)` |
| Logout | *(silent — navigates)* | *(silent)* |

**Notes:**
- `getErrorMessage` is already exported from `@/lib/api`
- Notifications mutations (mark as read) are silent — they're frequent background actions
- Login is silent on success (page navigates anyway) but shows error on failure
- Logout is silent (navigates to login page)

## Files to modify

1. **New**: `frontend/app/hooks/use-toast.ts`
2. **Edit**: `frontend/app/root.tsx` — add `<Toaster>`
3. **Edit**: `frontend/app/hooks/use-users.ts`
4. **Edit**: `frontend/app/hooks/use-departments.ts`
5. **Edit**: `frontend/app/hooks/use-leaves.ts`
6. **Edit**: `frontend/app/hooks/use-feedback.ts`
7. **Edit**: `frontend/app/hooks/use-announcements.ts`
8. **Edit**: `frontend/app/hooks/use-attendance.ts`
9. **Edit**: `frontend/app/hooks/use-performance-reviews.ts`
10. **Edit**: `frontend/app/hooks/use-notifications.ts`
11. **Edit**: `frontend/app/hooks/use-auth.ts`

## Done when

- All mutations show toast feedback (success or error)
- `<Toaster>` is mounted in root and renders correctly
- `bun run typecheck` passes
