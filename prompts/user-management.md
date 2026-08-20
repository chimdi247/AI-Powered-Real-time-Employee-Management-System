# User / employee management (full-stack)

## Goal

- **Admins**: create, read, update, and delete employee records (name, email, role, department, password).
- **Employees**: view their own profile and update **name + password only** (user-confirmed: email stays admin-managed — it's the unique login identifier). Role/department/email are never self-editable.
- Every mutation is written to the existing activity log (admin-only page).

## Context

- Backend: Express 5 + Bun + TS, Mongoose. `User` model = name/email/password (hashed via `pre("save")` only when modified)/role/department (ObjectId ref, default null) + `toJSON` stripping `password`/`__v`. Existing: `listUsers` + `createUser` (admin) in `controllers/users.ts`; router at `routes/users.ts` with `requireAuth` + `requireRole("admin")` per route; `req.user` from `requireAuth`; `logActivity()` fire-and-forget helper (`lib/activityLog.ts`); ObjectId guard pattern in `controllers/departments.ts` (`getParamIdOr404`).
- Activity log exists with actions: `login`, `login_failed`, `logout`, `user_created`, `department_*`. New actions needed: `user_updated`, `user_deleted`, `profile_updated` (backend enum + frontend `ActivityAction` + page labels).
- Frontend: React Router + TanStack Query + Axios. `/admin/users` is a placeholder; `/profile` shows only the department card. `useUsers` currently lives in `hooks/use-departments.ts` (used by the Manage Members dialog). UI kit: dialog, select, table, card, badge, button, input, label, skeleton, empty, alert. Theme tokens only.
- `verbatimModuleSyntax` → `import type`; local backend imports end with `.js`. Package manager: Bun.

## Backend

1. **`models/ActivityLog.ts`** — extend `ACTIVITY_ACTIONS` with `user_updated`, `user_deleted`, `profile_updated`.
2. **`controllers/users.ts`**:
   - `updateUser` (admin, `PATCH /:id`): body `{ name?, email?, role?, department?, password? }` — at least one field required (400 otherwise). `name` non-empty when given; `role` must be `admin`|`employee`; `department` must be a valid ObjectId or `null` (to unassign, 400 if invalid); `password` rehashes only when provided (model hook handles it; model enforces minlength 8). **Block self role-change** (admin changing their own role → 400). Duplicate email → 409. Track `changed: [...]` for the log; log `user_updated` (target user, details `{ changed }`).
   - `deleteUser` (admin, `DELETE /:id`): **block self-delete** (400). Snapshot name/email before removal; `deleteOne()`; log `user_deleted`. Activity-log entries keep their actor snapshots (immutable audit records — no cascade).
   - `updateMe` (auth, any role, `PATCH /me`): body `{ name?, currentPassword?, password? }` — name change allowed freely; **password change requires `currentPassword`** verified via `comparePassword` (401/400 on mismatch); `password` minlength 8; role/email/department fields are **ignored** (never self-editable). Return updated `{ user }`; log `profile_updated` (details `{ changed }`).
   - Share a small `getUserOr404` helper (ObjectId guard → 404) like the departments controller.
3. **`routes/users.ts`** — keep existing admin routes; add:
   - `router.patch("/me", requireAuth, updateMe)` — **declared before `/:id`**.
   - `router.patch("/:id", requireAuth, requireRole("admin"), updateUser)`.
   - `router.delete("/:id", requireAuth, requireRole("admin"), deleteUser)`.

## Frontend

1. **`app/types.ts`** — extend `ActivityAction` with `user_updated` / `user_deleted` / `profile_updated`; add `UpdateUserInput` (`name?`, `email?`, `role?`, `department?: string | null`, `password?`), `UpdateProfileInput` (`name?`, `currentPassword?`, `password?`).
2. **`app/hooks/use-users.ts`** (new) — move `usersKeys` + `useUsers` here from `use-departments.ts`; add:
   - `useCreateUser`, `useUpdateUser`, `useDeleteUser` — invalidate `["users"]` on success (+ `["departments"]` where membership changed).
   - `useUpdateProfile` — `PATCH /users/me`; on success `setQueryData(meKeys.all, user)` (the `me` query is `staleTime: Infinity`, so direct seeding keeps the sidebar/name in sync instantly).
   - Update `routes/admin/departments.tsx` to import `useUsers` from the new hook file (remove the export from `use-departments.ts`).
3. **`app/routes/admin/users.tsx`** — replace the placeholder, modeled on `admin/departments.tsx`:
   - Header + "New user" button; loading skeleton / error-with-retry / empty state.
   - Table: name, email, role badge, department (name via `useDepartments` lookup), joined date, actions (edit, delete). Disable/hint for your own row ("You can't change your own role" / "You can't delete your own account").
   - **Create dialog**: name, email, role select, department select (optional), password (required, min 8). Duplicate email → 409 error alert.
   - **Edit dialog**: same minus required password — password field optional ("leave blank to keep current"). Role select hidden/disabled when editing yourself.
   - **Delete dialog**: confirmation with the user's name + email.
4. **`app/routes/profile.tsx`** — keep the department card; add:
   - **Personal information card**: name field + save (via `useUpdateProfile`), email shown read-only with a note ("managed by your administrator").
   - **Change password card**: current password + new password + confirm; client-side confirm match + min 8 validation; success feedback.
   - Loading/error/disabled states per existing patterns.

## Activity log page sync

- `routes/admin/activity-log.tsx` — add `user_updated` ("Updated user"), `user_deleted` ("Deleted user" — destructive badge), `profile_updated` ("Updated profile") to `ACTION_META`; `detailsSummary` can show `Changed: name, password` for those.

## Edge cases

- Employees can never set role/email/department via `/me` — those fields are dropped server-side.
- Password change requires the current password; wrong current password → readable error, no password change.
- Admin cannot change their own role or delete themselves (server-enforced 400).
- Duplicate email on create/update → 409 with readable message.
- `PATCH /me` must be registered before `/:id` so "me" isn't parsed as an ObjectId.
- Deleting a user does not touch activity-log entries (actor snapshots keep them meaningful).
- All new admin routes carry `requireRole("admin")` — employees get 403 and never see the nav item.

## Affected files

- Backend: modified `models/ActivityLog.ts`, `controllers/users.ts`, `routes/users.ts`.
- Frontend: new `app/hooks/use-users.ts`; modified `app/types.ts`, `app/routes/admin/users.tsx`, `app/routes/profile.tsx`, `app/routes/admin/activity-log.tsx`, `app/hooks/use-departments.ts` (remove `useUsers`), `app/routes/admin/departments.tsx` (import fix).

## Done when

- `bun run typecheck` passes in `backend/` and `frontend/`; `bun run build` passes in `frontend/`.
- Admin can create/edit/delete users from `/admin/users` (role + department assignment, optional password reset); employees get 403 on those endpoints.
- Employee can edit name and change password from `/profile`; email/role/department are not editable and the `me` cache stays in sync.
- New actions appear in the activity log with correct labels; backend guards (self-role/self-delete, current-password check, duplicate email) hold.

## Post-approval implementation & verification (2026-08-16)

- **Backend**: `ActivityLog` actions extended with `user_updated`/`user_deleted`/`profile_updated`. `controllers/users.ts` gained `updateUser` (name/email/role/department/optional password; blocks self role-change; duplicate email → 409), `deleteUser` (blocks self-delete; snapshots before removal), and `updateMe` (name + password only; password change requires verified `currentPassword` — fetches `+password` since `requireAuth` excludes it). `createUser` now accepts a validated `department`. `routes/users.ts` adds `PATCH /me` (declared before `/:id`), `PATCH /:id`, `DELETE /:id` (admin-gated). `bun run typecheck` passes in `backend/`.
- **Frontend**: new `hooks/use-users.ts` (roster query + create/update/delete mutations + `useUpdateProfile` seeding the `me` cache); `useUsers`/`usersKeys` moved out of `use-departments.ts` (imports updated in `admin/departments.tsx`). `routes/admin/users.tsx` is a full CRUD page (table with initials avatar, role badge, department lookup, joined date, "You" badge; create/edit dialog with role + department selects and optional password reset; delete confirmation; self-row guards). `routes/profile.tsx` gained Personal information (name save, read-only email) and Change password (current + new + confirm) cards beside the department card. Activity-log page labels/summaries updated for the three new actions. `bun run typecheck` + `bun run build` pass in `frontend/`.
- **Not runtime-tested** (no live backend/DB session): endpoints and flows verified by typecheck/build only — a browser pass against the running API is recommended.

