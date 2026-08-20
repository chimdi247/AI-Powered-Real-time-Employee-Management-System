# Department management (full-stack)

## Goal

- **Admins**: create, read, update, and delete departments; assign/unassign employees to a department.
- **Employees**: view their own department information.

**Data model (user-confirmed): one department per employee** — `User.department` is a single `ObjectId` ref to `Department` (the standard HR model). Assignment = setting a user's `department`.

## Context

- Backend: Express 5 + Bun + TS. Existing: `User` model (name/email/password/role), `requireAuth` + `requireRole("admin")` middleware, central JSON error handler (ValidationError → 400, duplicate key → 409, CORS → 403, else 500), routers mounted in `server.ts`. **No Department model, no user-listing endpoint** (needed for the assign UI) — both get added.
- Frontend: React Router framework mode + TanStack Query + Axios. Auth cookie-based (`useCurrentUser`/`useLogin`/`useLogout`). Protected layout + role-based sidebar already exist. `/admin/departments` is currently a placeholder route; `/profile` is a placeholder (employee view target). Theme: zinc + emerald tokens.
- `app/components/ui/` has dialog, alert-dialog, checkbox, table, card, button, input, label, badge, skeleton, empty — reuse these.
- `verbatimModuleSyntax` → `import type`. Local backend imports end with `.js` (Vercel deployment requirement). Package manager: Bun.

## Backend

1. **`backend/src/models/Department.ts`**: `name` (required, unique, trim), `description` (optional, trim), `timestamps: true`; `toJSON` strips `__v`.
2. **`backend/src/models/User.ts`**: add `department: { type: Schema.Types.ObjectId, ref: "Department", default: null }` (single department per employee; stays in `toJSON` so the me/user payloads carry the id).
3. **`backend/src/controllers/departments.ts`**:
   - `createDepartment` (admin): `{ name, description }` → 201; duplicate name → 409; missing name → 400.
   - `listDepartments` (admin): all departments + `memberCount` (`User.countDocuments({ department })`), sorted by name.
   - `getDepartment` (admin): department + populated `members` (id, name, email, role) → 404 if missing.
   - `updateDepartment` (admin): name/description via `PATCH` → duplicate name → 409; 404 if missing.
   - `deleteDepartment` (admin): **unassign members first** (`User.updateMany({ department: id }, { $unset: { department: 1 } })`), then delete → 200; 404 if missing.
   - `setDepartmentEmployees` (admin): `PUT /:id/employees` body `{ userIds: string[] }` — validate every id exists (400 otherwise); set listed users' `department` to this department and unset it for former members not in the list; return the department with members.
   - `myDepartment` (auth, any role): current user's populated department → `{ department }` or `{ department: null }`.
4. **`backend/src/controllers/users.ts`**: add `listUsers` (admin): all users (id, name, email, role, department), sorted by name — powers the assign UI.
5. **`backend/src/routes/departments.ts`** (all `requireAuth`): `POST /`, `GET /` (admin), **`GET /mine` (any auth — must be declared before `/:id`)**, `GET /:id`, `PATCH /:id`, `DELETE /:id`, `PUT /:id/employees` (all admin except `/mine`).
6. **`backend/src/routes/users.ts`**: add `GET /` (admin, `listUsers`).
7. **`backend/src/server.ts`**: mount `departmentsRouter` at `/api/departments`.

## Frontend

1. **`app/types.ts`**: `Department` (`_id`, `name`, `description?`, `memberCount?`, `members?`), `DepartmentMember` (id/name/email/role), `DepartmentInput` (`name`, `description?`), `UserResponse`-style wrappers.
2. **`app/hooks/use-departments.ts`** (keys: `["departments"]`, `["departments", id]`, `["my-department"]`, `["users"]`):
   - `useDepartments()` — GET `/departments` (admin list).
   - `useDepartment(id)` — GET `/departments/:id` (detail incl. members).
   - `useMyDepartment()` — GET `/departments/mine`.
   - `useUsers()` — GET `/users` (admin roster for assignment).
   - Mutations: `useCreateDepartment`, `useUpdateDepartment`, `useDeleteDepartment`, `useSetDepartmentEmployees` — invalidate `["departments"]` (+ `["users"]`, `["my-department"]` where relevant) on success; surface errors via `getErrorMessage`.
3. **`app/routes/admin/departments.tsx`** — replace the placeholder:
   - Page header (title + description) + "New department" button.
   - Intentional states: loading skeleton, empty state (no departments yet), error state.
   - Department list (table or cards): name, description, member count, actions (manage members, edit, delete).
   - **Create/Edit dialog**: name + description, client validation, `getErrorMessage` error alert, submit spinner.
   - **Manage members dialog**: checkbox list of employees (`useUsers`) with current members pre-checked; save → `setDepartmentEmployees`. Loading/empty states included.
   - **Delete**: confirmation dialog noting members will be unassigned.
4. **`app/routes/profile.tsx`** — replace the placeholder with the employee department view: "My department" card (name + description) via `useMyDepartment`, with an empty state ("Not assigned to a department yet") and loading/error states. (Rest of profile is a later step.)

## Design notes

- Zinc + emerald tokens only; lucide icons (`Building2`, `Users`, `Plus`, `Pencil`, `Trash2`); 150–250ms motion; dialogs/forms match the existing shadcn look; fully responsive; accessible (labels, `aria-*`, focus states).

## Edge cases

- Deleting a department unassigns its members (documented in the dialog copy + prompt).
- Duplicate department name → readable 409 error.
- Assigning with an unknown user id → 400.
- Employee with no department → explicit "not assigned" empty state, not an error.
- `GET /mine` must be registered before `/:id` in the router.

## Affected files

- Backend: new `models/Department.ts`, `controllers/departments.ts`, `routes/departments.ts`; modified `models/User.ts`, `controllers/users.ts`, `routes/users.ts`, `server.ts`.
- Frontend: new `app/hooks/use-departments.ts`; modified `app/types.ts`, `app/routes/admin/departments.tsx`, `app/routes/profile.tsx`.

## Done when

- `bun run typecheck` passes in `backend/` and `frontend/`; `bun run build` passes in `frontend/`.
- Admin: can create/edit/delete departments (delete unassigns members), see member counts, and assign/unassign employees via the manage-members dialog.
- Employee: profile page shows their department (or a clear "not assigned" state); employees cannot hit admin endpoints (403).

## Post-approval implementation & verification (2026-08-16)

- **Backend**: new `models/Department.ts` (name unique + description), `controllers/departments.ts` (create/list/get/update/delete/setEmployees/myDepartment with ObjectId guards → 404, duplicate name → 409, invalid userIds → 400), `routes/departments.ts` (`/mine` declared before `/:id`; admin-gated CRUD + `PUT /:id/employees`). `User` gained `department` (ObjectId ref, default null); `users.ts` gained admin-only `listUsers`; `server.ts` mounts `/api/departments`. Delete unassigns members via `$set: { department: null }`. `bun run typecheck` passes in `backend/`.
- **Frontend**: `types.ts` gained `Department`/`DepartmentMember`/`DepartmentInput`/response wrappers + `User.department`; new `hooks/use-departments.ts` (list/detail/mine/users queries + create/update/delete/setEmployees mutations invalidating the right keys); `routes/admin/departments.tsx` is a full CRUD page (table with member counts, create/edit dialog, manage-members checkbox dialog with role badges, delete confirmation); `routes/profile.tsx` shows the employee's department with loading/error/empty states. `bun run typecheck` + `bun run build` pass in `frontend/`.
- Design notes: zinc + emerald tokens; dialogs/table/empty states from the existing ui kit; error messages surfaced via `getErrorMessage`.
- **Not runtime-tested** (no live backend/DB session): endpoints and flows verified by typecheck/build only — a browser pass against the running API is recommended.
