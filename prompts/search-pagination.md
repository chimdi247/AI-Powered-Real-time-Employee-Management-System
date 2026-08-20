# Server-side search + pagination (reusable across modules)

## Goal

Give the Employees (Manage Users), Departments, and Leave Requests (admin + employee) lists
**server-side search and pagination**, exposed through **reusable frontend pieces** (debounced
search input, pagination state hook, pagination footer) so any future module can opt in the
same way.

**Scope (user-confirmed: "Server-side")**: search/pagination query params on the backend
endpoints (mirroring the activity-log precedent of `limit`/`offset`/`total`), with the frontend
sending `search`, `limit`, `offset` and rendering a search box + "Showing X–Y of Z" footer with
prev/next buttons.

## Context

- Backend: Express 5 + Bun + TS, Mongoose. `controllers/activityLogs.ts` is the existing
  pagination precedent: parse `limit` (default 50, max 200) and `offset` from `req.query`,
  `skip`/`limit` the query, `countDocuments()` for `total`, respond `{ ..., total, limit, offset }`.
- Current list endpoints are unpaginated and return bare arrays:
  - `GET /users` → `{ users }` (`listUsers` in `controllers/users.ts`).
  - `GET /departments` → `{ departments }` with per-department `memberCount` (`listDepartments`).
  - `GET /leaves` → `{ leaves }`, optional `?status=` (`listLeaves`).
  - `GET /leaves/mine` → `{ leaves }` (`myLeaves`).
  - `GET /leaves/balances` → `{ balances }` (`listBalances`).
- Frontend hooks return the bare arrays: `useUsers()`, `useDepartments()`, `useLeaves(status)`,
  `useMyLeaves()`, `useLeaveBalances()`. Call sites:
  - `useUsers()`: admin users table **and** the "Manage members" dialog in `admin/departments.tsx`
    (needs the FULL roster to check/uncheck membership).
  - `useDepartments()`: admin departments table **and** the department Combobox in the New/Edit
    user dialog (needs ALL departments).
  - `useLeaves(status)`: admin Requests tab. `useMyLeaves()`: employee leave page.
    `useLeaveBalances()`: admin Balances tab.
- UI kit: `Input`, `Button`, `Card`, `Empty`, `Skeleton`, `Table`; shadcn `pagination.tsx`
  exists but is unused (we'll keep the prev/next **button** style already used by the activity
  log page — buttons, not `<a>` links, since paging is state-driven).
- `verbatimModuleSyntax` → `import type` on the frontend; backend local imports end with `.js`.
  Package manager: Bun. Reusable components live in `frontend/app/components/globals/` (dir
  doesn't exist yet — create it).
- Queries use `placeholderData: (previous) => previous` (activity-log precedent) so page flips
  don't blank the table.

## Backend

1. **New `lib/pagination.ts`** — shared helpers:
   - `parsePagination(req, { defaultLimit, maxLimit })` → `{ limit: number | null, offset: number }`.
     `limit` present → clamp to `[1, maxLimit]`; **absent → `null` (return all rows)** so
     comboboxes and the Manage Members dialog can keep fetching the full list. `offset` defaults 0.
   - `searchRegex(search)` → case-insensitive, **regex-escaped** `RegExp` (null when search empty).
2. **`controllers/users.ts`** — `listUsers`: read `search` (matches **name or email**,
   `$or` with `searchRegex`), `limit`, `offset`; apply filter + sort `{ name: 1 }` + optional
   `skip`/`limit`; `countDocuments` for `total`. Respond `{ users, total, limit, offset }`
   (`limit` is `null` when unpaginated).
3. **`controllers/departments.ts`** — `listDepartments`: `search` matches **name or description**;
   paginate; compute `memberCount` per department **only for the page's rows** (keep the existing
   `User.countDocuments` approach). Respond `{ departments, total, limit, offset }`.
4. **`controllers/leaves.ts`**:
   - `listLeaves`: keep `status` filter; add `search` — **employee name/email** via a two-step
     match: `User.find({ $or: [name, email regex] }).select("_id")` then
     `Leave.find({ ...filter, user: { $in: ids } })` (population can't be filtered in Mongoose
     without aggregation). Paginate; respond `{ leaves, total, limit, offset }`.
   - `myLeaves`: `search` matches **leaveType, status, or reason**; paginate; same response shape.
   - `listBalances`: `search` matches employee **name/email** (same two-step approach);
     paginate; respond `{ balances, total, limit, offset }`.
5. **Routes**: no changes — query params flow through existing route handlers.

## Frontend

### Reusable pieces (new, under `app/components/globals/` + `app/hooks/`)

1. **`hooks/use-debounced-value.ts`** — `useDebouncedValue<T>(value, delay = 300)`.
2. **`hooks/use-pagination.ts`** — `usePagination({ limit, resetOn = [] })` returns
   `{ page, setPage, offset, total, setTotal, totalPages, rangeStart, rangeEnd, reset }`.
   Resets `page` to 1 whenever a value in `resetOn` changes (e.g. the search string).
3. **`components/globals/data-table-search.tsx`** — labeled search `Input` with a search icon
   (`Search` from lucide-react), built-in debounce, and a clear (X) button; exposes
   `value`/`onChange`; full-width, `aria-label="Search"`, `w-full sm:max-w-xs`.
4. **`components/globals/data-table-pagination.tsx`** — footer matching the activity-log style:
   "Showing {rangeStart}–{rangeEnd} of {total}" + Previous/Next `Button`s (ChevronLeft/Right),
   disabled at the ends; renders nothing when `total === 0` or `totalPages <= 1` (only show when
   >1 page).

### Hooks + types

5. **`types.ts`** — extend responses to include pagination meta:
   `UsersListResponse`, `DepartmentListResponse`, `LeaveListResponse`, `LeaveBalancesResponse`
   each gain `total: number; limit: number | null; offset: number`.
6. **`hooks/use-users.ts`** — `useUsers(params?: { search?: string; limit?: number; offset?: number })`
   → returns the full response object (`{ users, total, limit, offset }`). Query key becomes
   `usersKeys.list(search, limit, offset)` (invalidation prefix `["users"]` unchanged). Keep
   `useUsers()` (no params) returning ALL users for the Manage Members dialog and department
   combobox — unchanged call sites.
7. **`hooks/use-departments.ts`** — same pattern: `useDepartments(params?)`; no-params call sites
   (user-form combobox) unchanged. Query key `departmentKeys.list(...)`.
8. **`hooks/use-leaves.ts`** — `useLeaves(params?: { status?: LeaveStatusFilter; search?: string; limit?: number; offset?: number })`,
   `useMyLeaves(params?: { search?; limit?; offset? })`, `useLeaveBalances(params?: { search?; limit?; offset? })`.
   All keep the `["leaves"]` prefix for invalidation. Add `placeholderData: (prev) => prev`.

### Pages

9. **`routes/admin/users.tsx`** — add search input (name/email) + pagination footer to the
   table. `useUsers({ search, limit: PAGE_SIZE, offset })`. Distinguish empty states: no data at
   all vs. no matches for the query ("No users match your search"). Keep create/edit/delete
   dialogs untouched.
10. **`routes/admin/departments.tsx`** — same: search (name/description) + pagination footer.
11. **`routes/admin/leaves.tsx`** — Requests tab: keep the status `Select`, add search
    (employee name/email) + pagination footer. Balances tab: search (employee name/email) +
    pagination footer. Policies tab: unchanged (small static list).
12. **`routes/leaves.tsx`** — My Leave Requests: search (type/status/reason) + pagination footer.
13. **`routes/admin/activity-log.tsx`** — optional consistency win: swap the inline footer for
    the new `DataTablePagination` (behavior unchanged, PAGE_SIZE stays 50).

### Constants

- `PAGE_SIZE = 10` for the four data tables (users, departments, admin requests, balances,
  my-leaves); activity log stays 50. Defined per page, passed to `usePagination({ limit })`.

## Edge cases

- Search is debounced (300ms); typing resets `page` to 1 (via `resetOn`).
- Regex-special characters in the query are escaped — no regex errors or injection.
- Empty `search`/whitespace → no filter (same as before).
- Members dialog + department combobox keep fetching everything (`limit` omitted → backend
  returns all rows, `total` = full count).
- Pagination footer hidden when there's ≤1 page; "Showing 0–0 of 0" never rendered (guard).
- Admin requests search over the **populated employee name/email** — via the two-step
  `User` id lookup (documented in the controller).
- `limit` echo is `null` when unpaginated — frontend types reflect `number | null`.
- Deletes/creates invalidate `["users"]`/`["departments"]`/`["leaves"]` prefixes, so page 1
  refetches after mutations (existing behavior preserved).

## Affected files

- Backend: new `lib/pagination.ts`; modified `controllers/users.ts`, `controllers/departments.ts`,
  `controllers/leaves.ts`.
- Frontend: new `hooks/use-debounced-value.ts`, `hooks/use-pagination.ts`,
  `components/globals/data-table-search.tsx`, `components/globals/data-table-pagination.tsx`;
  modified `types.ts`, `hooks/use-users.ts`, `hooks/use-departments.ts`, `hooks/use-leaves.ts`,
  `routes/admin/users.tsx`, `routes/admin/departments.tsx`, `routes/admin/leaves.tsx`,
  `routes/leaves.tsx`, `routes/admin/activity-log.tsx`.

## Done when

- `bun run typecheck` passes in `backend/` and `frontend/`; `bun run build` passes in `frontend/`.
- Users, Departments, admin Requests (status + search), Balances, and My Leave Requests tables
  each have a debounced search box and a "Showing X–Y of Z" + prev/next footer that drives
  server-side `limit`/`offset`; page resets to 1 when the search changes; no-match empty states
  are distinct from "no data".
- Manage Members dialog and the user-form department combobox still load the full lists.
- A new module can opt in by composing `useDebouncedValue` + `usePagination` + `DataTableSearch`
  + `DataTablePagination` with a paginated hook — no duplicated table chrome.

## Post-approval implementation & verification (2026-08-17)

- **Backend**: new `lib/pagination.ts` — `parsePagination(req)` returns `{ limit: number | null, offset }`
  (`limit` absent/invalid → `null` = return all rows, so comboboxes/member pickers keep full lists; capped at 200)
  and `searchRegex(value)` builds an escaped, case-insensitive substring regex. Wired into:
  `listUsers` (name/email), `listDepartments` (name/description, memberCount computed per page only),
  `listLeaves` (status + employee name/email via a two-step User-id lookup — populated fields can't be filtered),
  `myLeaves` (leaveType/status/reason), `listBalances` (name/email). All five respond `{ items, total, limit, offset }`.
  No route changes (query params flow through existing handlers). `bun run typecheck` passes in `backend/`.
- **Frontend reusable pieces**: new `hooks/use-debounced-value.ts` (300ms), `hooks/use-pagination.ts`
  (owns `page`/`total`, resets to 1 on `resetKey` change, clamps to the last valid page when the dataset
  shrinks — e.g. status-filter switch or deletions), `components/globals/data-table-search.tsx`
  (debounced InputGroup with search icon + clear button, `aria-label`), `components/globals/data-table-pagination.tsx`
  ("Showing X–Y of Z" + Previous/Next; hidden when ≤1 page or 0 rows).
- **Hooks**: `useUsers`/`useDepartments`/`useLeaves`/`useMyLeaves`/`useLeaveBalances` accept
  `{ search?, limit?, offset? }` (+ `status?` for `useLeaves`), return the full paginated response,
  and use `placeholderData` so page flips keep the previous page visible. No-params calls still return
  ALL rows (Manage Members dialog, user-form department combobox). Query keys moved under the existing
  `["users"]`/`["departments"]`/`["leaves"]` prefixes so invalidation is unchanged. `types.ts` responses
  extended with `total`/`limit`/`offset`.
- **Pages** (PAGE_SIZE = 10): `admin/users` (search name/email), `admin/departments` (search name/description),
  `admin/leaves` Requests tab (status select + employee search) and Balances tab (employee search),
  employee `leaves` (search type/status/reason). Each gets a distinct "no matches" empty state with a
  Clear-search button vs. the existing "no data yet" empty state. `admin/activity-log` now reuses
  `DataTablePagination` (PAGE_SIZE stays 50).
- Checks: `bun run typecheck` passes in `backend/` and `frontend/`; `bun run build` passes in `frontend/`.
- **Not runtime-tested** (no live backend/DB session): flows verified by typecheck/build only — a browser
  pass against the running API is recommended (type in each search box, flip pages, switch the status
  filter from a deep page, and confirm the Manage Members dialog + department combobox still list everyone).
