# Leave management (full-stack)

## Goal

- **Employees**: apply for leave, view their leave status/balance, and cancel their own leave requests (pending or approved).
- **Admins**: view all leave requests, approve/reject them (with optional note), and manage leave policies — per-type limits **and** per-employee annual balances (user-confirmed: "Both").

## Context

- Backend: Express 5 + Bun + TS, Mongoose. Existing patterns to mirror: `controllers/departments.ts` (ObjectId guard `getParamIdOr404`, `logActivity` fire-and-forget, `isDuplicateKeyError`), `controllers/users.ts` (body interfaces, 400/404/409 handling, `req.user` from `requireAuth`). Middleware: `requireAuth`, `requireRole("admin")`. Global error handler maps validation/duplicate-key errors to JSON. Routers mounted in `server.ts` under `/api/*`.
- **No leave code exists yet** — greenfield. `routes/leaves.tsx` and `routes/admin/leaves.tsx` are placeholders (`PagePlaceholder`); sidebar links + routes already registered.
- Frontend: React Router + TanStack Query + Axios. UI kit available: card, table, dialog, select, combobox, tabs, badge, button, input, textarea, label, skeleton, empty, alert, spinner, toast (base). `date-fns` `format` used for dates. No date-picker installed → use native `<Input type="date">`.
- `verbatimModuleSyntax` → `import type`; **all backend local imports end with `.js`** (Vercel). Package manager: Bun. `bun run typecheck` / `bun run build` per workspace.

## Data model

### Leave type & status (shared enums)
- `LeaveType`: `annual` | `sick` | `personal` | `unpaid` (fixed — admins tune limits, not types).
- `LeaveStatus`: `pending` | `approved` | `rejected` | `cancelled`.

### `LeavePolicy` (one doc per leave type; seeded defaults, admin-tuned)
- `leaveType` (unique), `maxDaysPerRequest` (int ≥ 1), `maxDaysPerYear` (int ≥ 0 — also the per-employee annual entitlement for tracked types).
- Defaults: annual 14/20, sick 5/10, personal 3/5, unpaid 30/30.
- Lazy self-heal: the list controller upserts any missing type's default (no migration needed).

### `User.leaveBalance` (per-employee annual balance, tracked types only)
- Shape: `{ year: number; annual: number; sick: number; personal: number }` (unpaid is not balance-tracked).
- Lazy year reset: when `leaveBalance.year !== currentYear`, reset each tracked type to that type's policy `maxDaysPerYear`. Central helpers in the leaves controller: `getBalance(user, policies)` (resets + persists) and `adjustBalance(user, leaveType, delta)`.
- Approved leave deducts; cancelling an **approved** request refunds; pending/rejected never touch the balance.

### `Leave`
- `user` (ObjectId ref User), `leaveType`, `startDate`/`endDate` (Date, date-only), `days` (computed inclusive calendar days), `reason` (required, trimmed), `status`, `decidedBy` (ObjectId ref User, null), `decisionNote`, `decidedAt`, timestamps. `toJSON` strips `__v`.
- Indexes: `{ user: 1, createdAt: -1 }` (my requests), `{ status: 1, createdAt: -1 }` (admin filter).

## Backend

1. **`models/LeaveType.ts`** — `LEAVE_TYPES`, `LEAVE_STATUSES`, `LeaveType`, `LeaveStatus` const exports (single source of truth).
2. **`models/LeavePolicy.ts`** — as above; unique index on `leaveType`; `toJSON` strips `__v`. Export `DEFAULT_LEAVE_POLICIES`.
3. **`models/Leave.ts`** — as above; `toJSON` strips `__v`.
4. **`models/User.ts`** — add `leaveBalance` (`{ year: Number, annual: Number, sick: Number, personal: Number }`, default undefined; stays in `toJSON`).
5. **`models/ActivityLog.ts`** — extend `ACTIVITY_ACTIONS` with `leave_created`, `leave_cancelled`, `leave_approved`, `leave_rejected`, `leave_balance_adjusted`, `leave_policy_updated`.
6. **`controllers/leaves.ts`**:
   - Helpers: `getLeaveOr404`, `paramId`, `isInvalidObjectId` (mirror departments/users), `parseDateOnly("YYYY-MM-DD")` (UTC-midnight parse), `countDays(start, end)` (inclusive: `(end-start)/86400000 + 1`), `getBalance`, `adjustBalance`, `ensurePolicies()`.
   - `createLeave` (any auth — admins may apply too): body `{ leaveType, startDate, endDate, reason }`. Validate: type in enum; reason non-empty; dates valid & `endDate >= startDate`; **no back-dating** (`startDate >= today`); days ≤ policy `maxDaysPerRequest`; tracked types: days ≤ current balance; no overlap with an existing `pending`/`approved` request (same user, ranges intersect). Errors: 400 with readable messages. Log `leave_created` (details `{ leaveType, days }`). Return 201 `{ leave }`.
   - `myLeaves` (any auth): own requests, newest first, populate `user` (name/email).
   - `myBalance` (any auth): `{ balance }` via `getBalance` (lazy reset).
   - `listLeaves` (admin): all requests, optional `?status=` filter (invalid → 400), newest first, populate `user`.
   - `decideLeave` (admin, `PATCH /:id/decide`): body `{ decision: "approved"|"rejected", note? }`. Only `pending` (else 400). On approve: re-check balance (insufficient → 400, request stays pending), deduct, set `decidedBy`/`decidedAt`. Set `decisionNote` if given. Log `leave_approved`/`leave_rejected`. Return `{ leave }`.
   - `cancelLeave` (owner, `PATCH /:id/cancel`): only the request owner (else 403); status `pending` or `approved` (else 400); approved → refund tracked days. Log `leave_cancelled`. Return `{ leave }`.
   - `listBalances` (admin, `GET /balances`): all users sorted by name, each with current-year `balance` (lazy reset) → `{ balances: [{ user: { _id, name, email }, balance }] }`.
   - `adjustBalance` (admin, `PATCH /balances/:userId`): body `{ leaveType` (tracked only)`, days }` — `days` int ≥ 0 sets the remaining days for this year (after lazy reset). Log `leave_balance_adjusted` (details `{ leaveType, days }`). Return `{ balance }`.
7. **`controllers/leavePolicies.ts`**:
   - `listPolicies` (admin): upsert missing defaults, return all 4 → `{ policies }`.
   - `updatePolicy` (admin, `PATCH /:type`): body `{ maxDaysPerRequest?, maxDaysPerYear? }` — ints ≥ 1 / ≥ 0 when given; at least one field. Log `leave_policy_updated` (details `{ changed }`). Return `{ policy }`.
8. **`routes/leaves.ts`** (all `requireAuth`; static paths before `/:id`-shaped ones):
   - `POST /`, `GET /mine`, `GET /balance`, `GET /balances` (admin), `PATCH /balances/:userId` (admin), `GET /` (admin), `PATCH /:id/decide` (admin), `PATCH /:id/cancel`.
9. **`routes/leavePolicies.ts`** — `router.use(requireAuth, requireRole("admin"))`; `GET /`, `PATCH /:type`.
10. **`server.ts`** — mount `leavesRouter` at `/api/leaves`, `leavePoliciesRouter` at `/api/leave-policies`.

## Frontend

1. **`app/types.ts`** — `LeaveType`, `LeaveStatus`, `Leave` (user populated as `{ _id, name, email }`), `LeaveInput`, `LeavePolicy`, `LeaveBalance`, response wrappers (`LeaveResponse`, `LeaveListResponse`, `LeaveBalanceResponse`, `LeaveBalancesResponse`, `LeavePolicyListResponse`), extend `ActivityAction`.
2. **`app/hooks/use-leaves.ts`** (keys: `["leaves","mine"]`, `["leaves", status]`, `["leaves","balance"]`, `["leaves","balances"]`, `["leave-policies"]`):
   - Queries: `useMyLeaves`, `useMyLeaveBalance`, `useLeaves(status?)`, `useLeaveBalances`, `useLeavePolicies`.
   - Mutations: `useCreateLeave`, `useCancelLeave`, `useDecideLeave`, `useAdjustLeaveBalance`, `useUpdateLeavePolicy` — invalidate the right keys on success (`mine` + list + balances for create/cancel/decide; balances for adjust; policies for policy updates).
3. **`app/routes/leaves.tsx`** (employee page, replaces placeholder):
   - Header "My Leave Requests" + "Apply for leave" button; balance summary cards (Annual/Sick/Personal remaining, Unpaid "Not tracked") from `useMyLeaveBalance`.
   - Requests table: type, dates, days, status badge, reason, applied date, actions (Cancel for pending/approved). Loading skeleton / error-with-retry / empty state per existing patterns.
   - **Apply dialog**: leave type `Select`; start/end date `<Input type="date">`; reason `Textarea`; live computed days; client validation (end ≥ start, no back-dating, days ≥ 1); server errors via `getErrorMessage` (limit/balance/overlap).
   - **Cancel dialog**: confirmation; refund note when cancelling an approved request.
4. **`app/routes/admin/leaves.tsx`** (admin page, replaces placeholder):
   - `Tabs`: **Requests** | **Balances** | **Policies**.
   - Requests: status filter (All/Pending/Approved/Rejected/Cancelled via `Select` or sub-tabs), table with employee (name/email), type, dates, days, status badge, reason, applied date; pending rows get Approve / Reject buttons opening a dialog with an optional note → `useDecideLeave`.
   - Balances: table of users with remaining days per type + "Adjust" dialog (type `Select` + days `Input`) → `useAdjustLeaveBalance`.
   - Policies: table of the 4 types with `maxDaysPerRequest`/`maxDaysPerYear` + edit dialog → `useUpdateLeavePolicy`.
   - Intentional loading/error/empty states throughout.
5. **`app/routes/admin/activity-log.tsx`** — add the 6 new actions to `ACTION_META` (labels + badge tones; `leave_rejected` destructive); `detailsSummary` can show `Type: annual · 3 days` style summaries for leave actions.

## Design notes

- Zinc + emerald tokens; lucide icons (`CalendarDays`, `CalendarClock`, `Plus`, `X`, `Check`, `Pencil`, `Trash2`, etc.); existing ui kit only; native date inputs; fully responsive; accessible (labels, `aria-*`, focus states). Balance cards read "X days left" with the year (e.g. "Annual · 12 of 20 days left").

## Edge cases

- Balance is only tracked for annual/sick/personal; unpaid leave is allowed up to its `maxDaysPerRequest` with no balance check/deduction.
- Two pending requests can pass the apply-time balance check; approval re-checks and fails with 400 if the balance ran out in between.
- Cancelling an approved request refunds its days; cancelling pending/approved are the only cancellable states.
- Changing a policy's `maxDaysPerYear` affects future (year-reset) balances, not the currently stored balance.
- Admin cannot decide a non-pending request; an employee cannot cancel someone else's request (403) or a non-cancellable status (400).
- Date parsing is date-only UTC — day counts are timezone-stable.
- `GET /balance`/`/mine` must be declared before `/:id`-shaped routes (no `GET /:id` exists, but keep the convention).

## Affected files

- Backend: new `models/LeaveType.ts`, `models/LeavePolicy.ts`, `models/Leave.ts`, `controllers/leaves.ts`, `controllers/leavePolicies.ts`, `routes/leaves.ts`, `routes/leavePolicies.ts`; modified `models/User.ts`, `models/ActivityLog.ts`, `server.ts`.
- Frontend: new `app/hooks/use-leaves.ts`; modified `app/types.ts`, `app/routes/leaves.tsx`, `app/routes/admin/leaves.tsx`, `app/routes/admin/activity-log.tsx`.

## Done when

- `bun run typecheck` passes in `backend/` and `frontend/`; `bun run build` passes in `frontend/`.
- Employee: applies for leave (limits + balance + overlap enforced), sees balance cards and request statuses, cancels pending/approved (approved refunds).
- Admin: sees all requests, filters by status, approves/rejects with optional note (approval deducts balance), views/adjusts employee balances, edits per-type policy limits.
- New leave actions appear in the activity log with correct labels.

## Post-approval implementation & verification (2026-08-17)

- **Backend**: new `models/LeaveType.ts` (leave type/status/balance-tracked enums), `models/LeavePolicy.ts` (per-type limits + `DEFAULT_LEAVE_POLICIES`), `models/Leave.ts` (dates, computed inclusive `days`, status, decision fields); `User` gained `leaveBalance` (`{ year, annual, sick, personal }`, lazy year reset); `ActivityLog` gained 6 leave actions. New `lib/leavePolicies.ts` (`getPolicies` self-seeds defaults), `controllers/leaves.ts` (apply with per-request limit + balance + no-overlap + no-backdating enforcement, my requests, my balance, admin list with `?status=`, decide with balance re-check + deduction, owner-only cancel with refund, balances list, balance adjust) and `controllers/leavePolicies.ts` (list + update). Routers `routes/leaves.ts` (static paths before `/:id`-shaped) and `routes/leavePolicies.ts` (admin-gated); mounted in `server.ts`. `bun run typecheck` passes in `backend/`.
- **Frontend**: `types.ts` gained Leave/LeaveType/LeaveStatus/LeavePolicy/LeaveBalance + wrappers + 6 new `ActivityAction` members; new `hooks/use-leaves.ts` (mine/balance/list/balances/policies queries + create/cancel/decide/adjust/update mutations invalidating the shared `["leaves"]` prefix); new `lib/leave.ts` (labels, status badge meta, `countLeaveDays`, date formatting). `routes/leaves.tsx` is the employee page (balance cards, requests table with cancel, apply dialog with live day count + client validation, cancel dialog with refund note); `routes/admin/leaves.tsx` is the admin page (Requests/Balances/Policies tabs, status filter, decide dialog with note, adjust-balance dialog, policy edit dialog); `routes/admin/activity-log.tsx` labels + summaries the 6 leave actions. `bun run typecheck` + `bun run build` pass in `frontend/`.
- **Not runtime-tested** (no live backend/DB session): flows verified by typecheck/build only — a browser pass against the running API is recommended (apply for leave as an employee, approve/reject as admin, check balance deduction/refund, adjust a balance, edit a policy).
