# Activity log (admin-only, full-stack)

## Goal

Record every relevant action (auth events + all data mutations) in a persistent activity log and expose it through an **admin-only** page:

- **Log scope (user-confirmed)**: logins (including failed attempts), logouts, user creation, department create/update/delete, and department member assignment. Reads are not logged.
- **Permission**: only `admin` can view the log (backend `requireRole("admin")` + role-gated sidebar nav). Employees never see the route or data.

## Context

- Backend: Express 5 + Bun + TS. Existing patterns: Mongoose models with `timestamps: true` and a `toJSON` transform that strips `__v`; `requireAuth` + `requireRole("admin")` middleware; central JSON error handler; routers mounted in `server.ts`; controllers call `res.json({ ... })`.
- Current mutating endpoints to instrument: `POST /api/auth/login` (success + failure), `POST /api/auth/logout`, `POST /api/users`, `POST /api/departments`, `PATCH /api/departments/:id`, `DELETE /api/departments/:id`, `PUT /api/departments/:id/employees`.
- Frontend: React Router framework mode + TanStack Query + Axios. Role-gated sidebar (`NAV_GROUPS` in `app-sidebar.tsx`), admin routes under `/admin/*` in `routes.ts`, hooks pattern in `app/hooks/`, shared types in `app/types.ts`. UI kit has table, card, badge, button, skeleton, empty, alert, pagination.
- `verbatimModuleSyntax` → `import type`; local backend imports end with `.js` (Vercel). Package manager: Bun.

## Backend

1. **`backend/src/models/ActivityLog.ts`** — `IActivityLog`:
   - `action` (required, enum): `login`, `login_failed`, `logout`, `user_created`, `department_created`, `department_updated`, `department_deleted`, `department_members_updated`.
   - `actor` (ObjectId ref `User`, **nullable** — null for failed logins where no user matched), plus snapshots `actorName`, `actorEmail`, `actorRole` (so the log stays readable even if the user is later deleted).
   - `targetType` (optional string), `targetId` (optional ObjectId), `targetName` (optional string snapshot, e.g. department name).
   - `details` (Mixed, optional — e.g. `{ changed: ["name"] }`, `{ added: n, removed: n }`).
   - `ip` (optional string).
   - `timestamps: true`; `toJSON` strips `__v`; index `createdAt` desc (and `action` for filtering).
2. **`backend/src/lib/activityLog.ts`** — `logActivity(entry)` helper that `ActivityLog.create`s **fire-and-forget with `.catch(() => undefined)`** so logging can never break a request; accepts partial entry (actor fields, action, target, details, ip) and derives `actorName`/`actorEmail`/`actorRole` from the `actor` doc when given.
3. **`backend/src/controllers/activityLogs.ts`** — `listActivityLogs` (admin): `GET /api/activity-logs?limit=&offset=` → `{ logs, total, limit, offset }` sorted `createdAt` desc; `limit` default 50 / max 200, `offset` default 0 (both parsed with `Number()`, clamped).
4. **`backend/src/routes/activityLogs.ts`** — `router.get("/", requireAuth, requireRole("admin"), listActivityLogs)`.
5. **`backend/src/server.ts`** — mount `activityLogsRouter` at `/api/activity-logs`.
6. **Instrument controllers** (via `logActivity`; never `await` it):
   - `controllers/auth.ts`:
     - `login` success → `login` (actor = user, ip).
     - `login` failure (no user / bad password) → `login_failed` (actor null, `actorEmail` = attempted email, details `{ reason: "invalid_credentials" }`, ip).
     - `logout` — keep the route **without** `requireAuth` (an expired cookie must still log the user out); best-effort actor: if `req.user` exists use it, otherwise verify `req.cookies.token` via `verifyAccessToken` + `User.findById` in a try/catch. Action `logout`.
   - `controllers/users.ts` `createUser` success → `user_created` (target user, details `{ role }`).
   - `controllers/departments.ts`:
     - `createDepartment` → `department_created` (target department).
     - `updateDepartment` → `department_updated` (details `{ changed: [...] }` — field names actually modified).
     - `deleteDepartment` → `department_deleted` (target department, captured **before** delete).
     - `setDepartmentEmployees` → `department_members_updated` (details `{ added, removed }` counts computed from the pre/post state).

## Frontend

1. **`app/types.ts`** — `ActivityLog` (`_id`, `action`, `actor?`, `actorName?`, `actorEmail?`, `actorRole?`, `targetType?`, `targetId?`, `targetName?`, `details?`, `ip?`, `createdAt`) + `ActivityLogListResponse` (`logs`, `total`, `limit`, `offset`).
2. **`app/hooks/use-activity-logs.ts`** — `useActivityLogs(page, pageSize)` (query key `["activity-logs", page, pageSize]`, GET `/activity-logs?limit=&offset=`) with keys exported for cache management.
3. **`app/routes/activity-log.tsx`** — admin page:
   - Header (title + description) matching other admin pages.
   - Intentional states: table skeleton while loading, error alert with retry, empty state ("No activity recorded yet").
   - Table: Time (formatted, `date-fns`), Actor (name + email, role badge; "Unknown" for failed logins), Action (humanized label + action badge/variant), Target (name + type), IP, Details (truncated).
   - Humanized action labels + colors via a small map (login → "Signed in", login_failed → "Failed sign-in" (destructive), logout → "Signed out", user_created → "Created user", department_* → "Created/Updated/Deleted department", department_members_updated → "Updated department members").
   - Pagination footer (prev/next, "Showing X–Y of Z") using `pagination` UI kit; page size 50.
4. **`app/routes.ts`** — add `route("activity-log", "routes/admin/activity-log.tsx")` under the `admin` prefix.
5. **`app/components/layout/app-sidebar.tsx`** — add "Activity Log" (`History` icon, to `/admin/activity-log`) to the admin `NAV_GROUPS` items.

## Design notes

- Existing theme tokens only (no new hex); lucide icons; 150–250ms motion; consistent page header pattern (`font-heading text-3xl font-semibold`); accessible (semantic table, `aria-*`, focus states, labels).
- Failed sign-ins get a distinct destructive styling so admins can spot auth issues at a glance.

## Edge cases

- Failed login with an unknown email → log with `actor: null` + `actorEmail` (never break login on a logging error).
- Logging must never fail the primary request — fire-and-forget with swallowed errors.
- Actor snapshots (`actorName`/`actorEmail`/`actorRole`) keep entries meaningful after user deletion.
- Delete endpoints must capture target info **before** the document is removed.
- `logout` stays unauthenticated so users with expired cookies can still sign out; actor capture is best-effort.
- Reads (GET endpoints) are not logged.
- `limit`/`offset` clamped to sane bounds; employees hitting the route get 403 (backend) and never see the nav item (frontend).

## Affected files

- Backend: new `models/ActivityLog.ts`, `lib/activityLog.ts`, `controllers/activityLogs.ts`, `routes/activityLogs.ts`; modified `controllers/auth.ts`, `controllers/users.ts`, `controllers/departments.ts`, `server.ts`.
- Frontend: new `app/hooks/use-activity-logs.ts`, `app/routes/admin/activity-log.tsx`; modified `app/types.ts`, `app/routes.ts`, `app/components/layout/app-sidebar.tsx`.

## Done when

- `bun run typecheck` passes in `backend/` and `frontend/`; `bun run build` passes in `frontend/`.
- Every instrumented action writes a log entry with correct actor/action/target/ip; failed logins are recorded without breaking login.
- Admin sees the Activity Log page (nav item + route) with loading/error/empty states and pagination; employees get 403 on the endpoint and no nav item.
