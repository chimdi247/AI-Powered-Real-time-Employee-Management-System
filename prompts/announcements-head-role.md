# Head of Department role + department Announcements (card UI)

## Goal

Add a new **`head`** role ("Head of Department") and a department-scoped **Announcements**
feature rendered as **cards** (never a table). Announcements are created by heads for their
own department and are read-only for that department's members.

**Permission model (user-confirmed):**
- **Head of department**: can **create** and **edit** announcements in their own department,
  but **cannot delete**. (Heads read their department's announcements like any member.)
- **Employees**: **read-only** — they see announcements from their own department.
- **Admins**: **can do everything** — create/edit/delete announcements for **any** department,
  and see all of them.

## Context

- MERN + Bun + Express 5 + TS, Mongoose, React Router framework mode, TanStack Query + Axios,
  Tailwind + shadcn UI. `verbatimModuleSyntax` → `import type` on the frontend; **backend local
  imports end with `.js`** (Vercel deploy requirement).
- Existing roles: `"admin" | "employee"` (`backend/src/models/User.ts` role enum, `IUser.role`).
  `requireRole(...roles)` guards routes (typed off `IUser["role"]`, so a new enum member flows
  through automatically). Users have a single `department` (ObjectId ref, nullable).
- Activity log: `backend/src/lib/activityLog.ts` (`logActivity` fire-and-forget) + `ACTIVITY_ACTIONS`
  enum in `backend/src/models/ActivityLog.ts` — **keep in sync with the frontend `ActivityAction`
  type in `frontend/app/types.ts`**.
- Reusable list chrome already exists (from the search/pagination task): `DataTableSearch`
  (debounced, 300ms), `DataTablePagination` ("Showing X–Y of Z" + prev/next), `usePagination`
  (page/total state, resets to 1 on search, clamps on shrink), and the paginated-list pattern
  (PAGE_SIZE const, `useEffect` syncing `data?.total` → `setTotal`, distinct empty states for
  "no data" vs "no matches"). Reuse all of it.
- Page patterns to mirror: `routes/admin/users.tsx` (list + search + pagination + create/edit
  Dialog + delete confirm Dialog), `routes/leaves.tsx` (employee-facing page, skeleton/error/
  empty states). UI components available: `Card`, `CardHeader/Title/Description/Content/Footer`,
  `Dialog`, `Alert`, `Empty`, `Skeleton`, `Badge`, `Button`, `Input`, `Textarea`, `Select`,
  `Combobox`, `AlertDialog`.
- Sidebar nav: `components/layout/app-sidebar.tsx` with role-gated `NavGroup`s
  (`roles` omitted = everyone). "My workspace" group currently `["employee"]`; "Administration"
  group `["admin"]`.
- Routes registered in `frontend/app/routes.ts` (framework mode; no loaders/actions needed —
  data flows through TanStack Query hooks like every other page).

## Backend

1. **Role** (`models/User.ts`): role enum → `["admin", "employee", "head"]`.
2. **New model `models/Announcement.ts`**: `title` (required, trim), `body` (required, trim),
   `department` (ObjectId ref "Department", required, index), `author` (ObjectId ref "User",
   required), timestamps. toJSON transform strips `__v` (match existing models). Index on
   `department` + `createdAt`.
3. **New `controllers/announcements.ts`** (each reads pagination via `parsePagination` from
   `lib/pagination.ts` and `searchRegex` for title/body):
   - `listAnnouncements` — access: any authenticated user.
     - employee/head: filter `{ department: req.user.department }` (no department → `{ items: [], total: 0 }`).
     - admin: all announcements.
     - `search` matches **title or body** (`$or` + `searchRegex`); sort `{ createdAt: -1 }`;
       populate `author` (name) and `department` (name); respond `{ announcements, total, limit, offset }`.
   - `createAnnouncement` — access: **head** or **admin** (`requireRole("head", "admin")`).
     - head: department is forced to `req.user.department`; 400 if the head has no department.
     - admin: `department` is required in the body and must be a valid ObjectId.
     - title + body required (trim). Log `announcement_created` (targetType "announcement").
   - `updateAnnouncement` — access: head or admin.
     - head: the announcement's `department` must equal `req.user.department` (403 otherwise);
       title/body editable, department NOT changeable.
     - admin: may also change `department` (valid ObjectId).
     - Log `announcement_updated`.
   - `deleteAnnouncement` — access: **admin only** (`requireRole("admin")`; heads cannot delete).
     Log `announcement_deleted`.
4. **New `routes/announcements.ts`**: all under `requireAuth`:
   - `GET /` → any auth.
   - `POST /` → `requireRole("head", "admin")`.
   - `PATCH /:id` → `requireRole("head", "admin")`.
   - `DELETE /:id` → `requireRole("admin")`.
   Mount in `server.ts` at `/api/announcements`.
5. **Activity log**: add `announcement_created | announcement_updated | announcement_deleted` to
   `ACTIVITY_ACTIONS` (`models/ActivityLog.ts`) **and** the frontend `ActivityAction` union
   (`types.ts`). `actorRole` enum in ActivityLog gains `"head"`.
6. **Users controller** (`controllers/users.ts`): accept the new role everywhere:
   - `createUser`: `role: role === "admin" ? "admin" : role === "head" ? "head" : "employee"`.
   - `updateUser`: role validation accepts `"head"`; keep the "cannot change your own role" guard.
   - New validation on create+update: **`role === "head"` requires a non-null `department`** (400:
     "A head of department must be assigned to a department"). Demoting a head (role → employee)
     keeps the department as-is.
7. **Departments controller** (`controllers/departments.ts`): `deleteDepartment` also deletes the
   department's announcements (`Announcement.deleteMany({ department })`) before removing the
   department, so no orphaned announcements remain.

## Frontend

1. **`types.ts`**: `Role = "admin" | "employee" | "head"`; add `ActivityAction` values (above);
   `actorRole?: Role` on `ActivityLog`; new `Announcement` interface
   (`_id, title, body, department: Pick<Department, "_id" | "name">, author: Pick<User, "_id" | "name">,
   createdAt, updatedAt`), `AnnouncementListResponse` (with `total/limit/offset`),
   `AnnouncementInput { title, body, department? }`.
2. **New `hooks/use-announcements.ts`**: `useAnnouncements(params?: { search?; limit?; offset? })`
   → `{ announcements, total, limit, offset }` (query key `["announcements", "list", {...}]`,
   `placeholderData: (prev) => prev`); `useCreateAnnouncement`, `useUpdateAnnouncement`,
   `useDeleteAnnouncement` — all invalidate `["announcements"]` on success.
3. **New `routes/announcements.tsx`** (registered in `routes.ts` at `announcements`):
   - Header: "Announcements" + description. "New announcement" button for heads and admins.
   - Search + pagination: `DataTableSearch` (title/body), `usePagination({ limit: PAGE_SIZE, resetKey: search })`,
     `DataTablePagination` footer.
   - **Card grid** (the core UI ask — no table): `grid gap-4 sm:grid-cols-2 xl:grid-cols-3` of
     announcement cards. Each card: title, meta row (author name + formatted date + department
     name badge), body (pre-wrap, line-clamped), and role-aware actions:
     - employee → no actions.
     - head → Edit (own department only, which is all they see).
     - admin → Edit + Delete.
   - States (per design system): `Skeleton` grid while loading; `Alert` + Retry on error; distinct
     empty states — "You're not assigned to a department yet" (employee/head without a department),
     "No announcements yet" (department has none; heads/admins get a create CTA), "No matching
     announcements" + Clear search.
   - Dialogs: `AnnouncementFormDialog` (title `Input`, body `Textarea`; heads don't pick a
     department — it's implied; admins get a department `Combobox`, required) and an
     admin-only delete confirm `Dialog` (mirror `DeleteUserDialog`).
4. **Sidebar** (`components/layout/app-sidebar.tsx`): add "Announcements" (`/announcements`,
   `Megaphone` icon from lucide-react) — to "My workspace" for `["employee", "head"]` **and** to
   "Administration" for `["admin"]`. Change "My workspace" `roles` to `["employee", "head"]`
   (heads are also employees — they keep Profile + Leave Requests).
5. **`routes/admin/users.tsx`**: role `Select` gains "Head of Department" (`head`) item; badge
   variant for `head` (e.g. `secondary`); when role is head, surface a hint that a department is
   required (backend enforces it).

## Edge cases

- Head with no department → create returns 400; list returns empty; page shows the "not assigned"
  empty state. Admin UI should warn when saving a user as head without a department (backend 400
  surfaces in the dialog alert).
- Head edits an announcement from another department → 403 (can't happen in the UI since heads
  only see their own department's).
- Head can't delete — the delete button simply isn't rendered for heads; backend enforces anyway.
- Employee with no department → `{ announcements: [], total: 0 }` → "not assigned" empty state.
- Department deletion cascades its announcements.
- Regex-special search chars are escaped (`searchRegex`); empty search = no filter.
- Page clamps when a delete shrinks the dataset (`usePagination` behavior).
- Admin create requires a department — combobox validation in the dialog (submit blocked with
  inline error until one is chosen).

## Affected files

- Backend: new `models/Announcement.ts`, `controllers/announcements.ts`, `routes/announcements.ts`;
  modified `models/User.ts`, `models/ActivityLog.ts`, `controllers/users.ts`,
  `controllers/departments.ts`, `server.ts`.
- Frontend: new `hooks/use-announcements.ts`, `routes/announcements.tsx`; modified `types.ts`,
  `routes.ts`, `components/layout/app-sidebar.tsx`, `routes/admin/users.tsx`.

## Done when

- `bun run typecheck` passes in `backend/` and `frontend/`; `bun run build` passes in `frontend/`.
- Users can be assigned role `head` (with a department required) from Manage Users; sidebar shows
  Announcements for all three roles.
- A head can create and edit (not delete) announcements for their department; employees see their
  department's announcements as read-only cards; an admin can create/edit/delete announcements for
  any department (with a department picker) and sees all of them.
- Announcements render as a responsive **card grid** with search + pagination and intentional
  loading/error/empty states — no table anywhere.
- Deleting a department removes its announcements; activity log records announcement create/update/delete.

## Post-approval implementation & verification (2026-08-17)

**Permission model implemented exactly as confirmed**: heads **create + edit** (never delete) in their
own department; employees **read-only**; admins **can do everything** (any department, incl. delete).

- **Backend**: new `models/Announcement.ts` (title/body/department/author + timestamps, index on
  `{ department, createdAt }`), `controllers/announcements.ts` (`listAnnouncements` scoped to the
  user's department for employees/heads, all for admins; `createAnnouncement`/`updateAnnouncement`
  gated to head+admin with department forced to `req.user.department` for heads and 403 outside
  their department; `deleteAnnouncement` admin-only), `routes/announcements.ts` mounted at
  `/api/announcements` in `server.ts`. Role enum now `["admin", "employee", "head"]` across
  `User`, `jwt.ts` payload, and `ActivityLog.actorRole`; `ACTIVITY_ACTIONS` + frontend
  `ActivityAction` gain `announcement_created|updated|deleted`. `createUser`/`updateUser` accept
  `head` and reject a head without a department (400). `deleteDepartment` cascades the department's
  announcements. Search (title/body) + `parsePagination` on the list endpoint, reusing the shared
  `lib/pagination.ts` helpers.
- **Frontend**: new `hooks/use-announcements.ts` (list + create/update/delete mutations, all
  invalidating `["announcements"]`) and `routes/announcements.tsx` — a responsive **card grid**
  (`sm:grid-cols-2 xl:grid-cols-3`, never a table) with `DataTableSearch` + `DataTablePagination`,
  role-aware actions (Edit for heads; Edit+Delete for admins), and intentional states: skeleton
  grid, error+Retry, "no department assigned", "no announcements yet", and "no matching
  announcements". New/edit dialog (heads post to their own department — no picker; admins get a
  required department Combobox), admin-only delete confirm, and a read dialog for long posts.
  Route registered in `routes.ts`; sidebar adds Announcements to "My workspace"
  (`["employee", "head"]`, heads also keep Profile/Leave Requests) and to Administration, with a
  proper "Head of Department" label. Role select + badge in `admin/users`, the Manage Members
  dialog, and the activity log all render the three roles consistently (client-side check blocks
  saving a head without a department).
- Checks: `bun run typecheck` passes in `backend/` and `frontend/`; `bun run build` passes in
  `frontend/`.
- **Not runtime-tested** (no live backend/DB session): verified by typecheck/build only — a browser
  pass against the running API is recommended (assign a head to a department, post an announcement
  as head/admin, confirm employees see it read-only and heads get no delete button).
