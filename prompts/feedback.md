# Employee feedback (full-stack)

## Goal

- **Employees** (and heads/admins, for consistency with leaves): submit feedback, choosing a **category** and whether to submit **anonymously** (user-confirmed: "Let the employee choose if they want to be anonymous" + "Yes, with categories"). View the status of their own submissions and any admin responses.
- **Admins**: view **all** feedback submissions (anonymous ones shown as "Anonymous" — never leaked), respond to them, and mark them as resolved (or reopen).

## Context

- Backend: Express 5 + Bun + TS, Mongoose. Patterns to mirror: `controllers/announcements.ts` (`getAnnouncementOr404`, `paramId`, `isInvalidObjectId`, `logActivity` fire-and-forget, body interfaces, 400/404/403 handling, `req.user` from `requireAuth`), `controllers/leaves.ts` (role-scoped list vs. owner-scoped `myX`, `?status=` filter with enum validation, populated `user` `name email`). Middleware: `requireAuth`, `requireRole("admin")`. Routers mounted in `server.ts` under `/api/*`.
- Frontend: React Router + TanStack Query + Axios. UI kit: card, table, dialog, select, badge, button, input, textarea, label, skeleton, empty, alert, tabs. `date-fns` `format` for dates. Sidebar nav groups in `components/layout/app-sidebar.tsx`; routes registered in `app/routes.ts`; admin routes have no frontend role guard (backend enforces; sidebar hides).
- `verbatimModuleSyntax` → `import type`; **all backend local imports end with `.js`** (Vercel). Package manager: Bun. `bun run typecheck` / `bun run build` per workspace.
- Anonymous is **admin-facing only**: the doc always stores `author` (so the submitter can track their own feedback), but when `isAnonymous` is true the admin list/search must not reveal the identity (author shown as null/"Anonymous"; name/email search must not match anonymous rows).

## Data model

### `Feedback`
- `author` — ObjectId ref User, **required** (always stored; drives the "my feedback" view).
- `isAnonymous` — boolean, default `false`. When true, admin-facing responses return `author: null` and search-by-name never matches it.
- `category` — enum `["suggestion", "complaint", "praise", "other"]` (single source of truth exported from the model, like `LeaveType`).
- `message` — string, required, trimmed, non-empty (max ~2000 chars).
- `status` — enum `["open", "resolved"]`, default `"open"`.
- `response` — optional subdoc `{ body: string (required, trimmed), respondedBy: ObjectId ref User (required), respondedAt: Date }`.
- timestamps; `toJSON` strips `__v` (mirror existing models).
- Indexes: `{ author: 1, createdAt: -1 }` (my feedback), `{ status: 1, createdAt: -1 }` (admin filter).

## Backend

1. **`models/Feedback.ts`** — as above; export `FEEDBACK_CATEGORIES`, `FEEDBACK_STATUSES`, `FeedbackCategory`, `FeedbackStatus` consts; `toJSON` strips `__v`.
2. **`models/ActivityLog.ts`** — extend `ACTIVITY_ACTIONS` with `feedback_created`, `feedback_responded`, `feedback_resolved`, `feedback_reopened`.
3. **`controllers/feedback.ts`**:
   - Helpers: `getFeedbackOr404`, `paramId`, `isInvalidObjectId` (mirror announcements).
   - `createFeedback` (any authenticated user): body `{ message, category, isAnonymous? }`. Validate: `message` non-empty string; `category` in enum; `isAnonymous` boolean-ish (default false). Log `feedback_created` (details `{ category, isAnonymous }`). Return 201 `{ feedback }` (author populated so the submitter sees their own name/flag).
   - `myFeedback` (any authenticated user): own submissions, newest first, optional `?status=` filter (enum-validated → 400) + search (`message`) + pagination. Always returns the author info (it's the requester).
   - `listFeedback` (admin): all submissions, optional `?status=` and `?category=` filters (enum-validated → 400) + search + pagination. Search matches `message` regex; additionally match author name/email **only for non-anonymous** rows (resolve matching user ids, add `{ author: { $in: ids }, isAnonymous: { $ne: true } }` to the `$or`). Map to JSON with `author` nulled out when `isAnonymous` is true (and `response.respondedBy` populated name-only).
   - `updateFeedback` (admin, `PATCH /:id`): body `{ response?, status? }` — at least one field (else 400). `response`: non-empty string when given; sets/updates `response.body`, `response.respondedBy = admin._id`, `response.respondedAt = new Date()`. `status`: must be `"open"` or `"resolved"`; only allow transitions (re-resolving an open one or reopening a resolved one is fine; no-op status changes skipped). Log `feedback_responded` when response given, `feedback_resolved`/`feedback_reopened` on status change. Return `{ feedback }` with author nulled if anonymous.
4. **`routes/feedback.ts`** — `router.use(requireAuth)`; `POST /`, `GET /mine` (any auth); `GET /` and `PATCH /:id` gated `requireRole("admin")`.
5. **`server.ts`** — mount `feedbackRouter` at `/api/feedback`.

## Frontend

1. **`app/types.ts`** — `FeedbackCategory`, `FeedbackStatus`, `Feedback` (author `{ _id, name, email } | null`, response `{ body, respondedBy: { _id, name }, respondedAt } | null`, `isAnonymous`), `FeedbackInput` (`{ message, category, isAnonymous? }`), `FeedbackUpdateInput` (`{ response?, status? }`), wrappers `FeedbackResponse`, `FeedbackListResponse`; extend `ActivityAction` with the 4 new actions.
2. **`app/hooks/use-feedback.ts`** (keys `["feedback", "mine", ...]`, `["feedback", "list", ...]`):
   - Queries: `useMyFeedback({ status?, search?, limit?, offset? })` (GET `/feedback/mine`), `useFeedback({ status?, category?, search?, limit?, offset? })` (GET `/feedback`, admin).
   - Mutations: `useCreateFeedback` (POST `/feedback`), `useUpdateFeedback` (PATCH `/feedback/:id`) — invalidate the shared `["feedback"]` prefix on success.
3. **`app/lib/feedback.ts`** — `FEEDBACK_CATEGORY_LABELS` (Suggestion, Complaint, Praise, Other) + `FEEDBACK_CATEGORY_META` (icon/badge tone), `FEEDBACK_STATUS_META` (`open` → secondary "Open", `resolved` → default "Resolved").
4. **`app/routes/feedback.tsx`** (employee page — new route `feedback`):
   - Header "Feedback" + "Submit feedback" button. Copy explains anonymous submissions stay hidden from admins.
   - List of own submissions: table or card list with category badge, status badge, message preview, submitted date, and response preview when present; search + status filter (`Select` All/Open/Resolved) + pagination (mirror `routes/leaves.tsx` patterns). Loading skeleton / error-with-retry / intentional empty states.
   - **Submit dialog**: category `Select`, message `Textarea`, anonymous `Checkbox` ("Submit anonymously — admins won't see your name"), client validation (message required), server errors via `getErrorMessage`.
   - **Detail dialog** (row click / "View" button): full message, status badge, and the admin response (body + responder name + date) when present.
5. **`app/routes/admin/feedback.tsx`** (admin page — new route `admin/feedback`):
   - Header "Feedback" — table: submitter (name/email or "Anonymous"), category badge, status badge, message preview, submitted date, actions (View/Respond). Filters: status `Select` (All/Open/Resolved) + category `Select` (All/Suggestion/Complaint/Praise/Other) + search + pagination (mirror `routes/admin/leaves.tsx`).
   - **Respond dialog**: full message (author shown or "Anonymous" — do not render a name for anonymous rows anywhere, including search results), current response (if any), response `Textarea` (prefilled when editing), and two actions: "Save response" (`{ response }`) and a resolve/reopen toggle button (`{ status }`) — e.g. "Mark resolved" (emerald/default) when open, "Reopen" (outline) when resolved. Combined save: allow sending `{ response, status }` in one PATCH when both given.
6. **`app/routes.ts`** — add `route("feedback", "routes/feedback.tsx")` and `route("feedback", "routes/admin/feedback.tsx")` under the `admin` prefix.
7. **`app/components/layout/app-sidebar.tsx`** — add "Feedback" (`MessageSquareText` icon) to "My workspace" (employee/head roles) and "Feedback" to the admin "Administration" group.
8. **`app/routes/admin/activity-log.tsx`** — add the 4 new actions to `ACTION_META` (labels + badge tones) and a `detailsSummary` snippet (e.g. `Category: suggestion · Anonymous`).

## Design notes

- Existing tokens only (no new theme): status badges `open` = secondary, `resolved` = default; category badges secondary/outline with lucide icons (`Lightbulb` suggestion, `AlertTriangle` complaint, `ThumbsUp` praise, `MessageSquare` other). Reuse the established zinc/neutral palette — no hardcoded hex.
- Responsive tables with `overflow-x-auto`; accessible dialogs (labels, `aria-*`, focus states) per existing patterns.

## Edge cases

- Anonymous rows: admin list/search/respond dialog must never expose the author — `author: null` in JSON and name/email search must exclude them.
- `GET /mine` must be declared before `/:id`-shaped routes (no `GET /:id` exists, but keep the convention).
- Updating an anonymous feedback's response must still be possible; the `respondedBy` is the admin and is always visible.
- `PATCH` requires at least one of `response`/`status`; status must be enum-valid; response must be a non-empty trimmed string.
- An employee can never see others' feedback: `myFeedback` is strictly owner-scoped server-side.

## Affected files

- Backend: new `models/Feedback.ts`, `controllers/feedback.ts`, `routes/feedback.ts`; modified `models/ActivityLog.ts`, `server.ts`.
- Frontend: new `app/hooks/use-feedback.ts`, `app/lib/feedback.ts`, `app/routes/feedback.tsx`, `app/routes/admin/feedback.tsx`; modified `app/types.ts`, `app/routes.ts`, `app/components/layout/app-sidebar.tsx`, `app/routes/admin/activity-log.tsx`.

## Done when

- `bun run typecheck` passes in `backend/` and `frontend/`; `bun run build` passes in `frontend/`.
- Employee: submits feedback (attributed or anonymous, with category), sees own submissions with status badges, and reads the admin's response.
- Admin: sees all submissions (anonymous shown as "Anonymous" with no identity leak in search), responds, marks resolved, reopens.
- New feedback actions appear in the activity log with correct labels.

## Post-approval implementation & verification (2026-08-18)

- **Backend**: new `models/Feedback.ts` (category/status enums, `isAnonymous`, single `response` subdoc with `respondedBy`/`respondedAt`), `controllers/feedback.ts` (create for any auth user; `myFeedback` owner-scoped with status filter/search/pagination; admin `listFeedback` with status + category filters and anonymity-safe search — name/email matches exclude `isAnonymous` rows; `updateFeedback` responds / resolves / reopens, logging `feedback_responded`/`feedback_resolved`/`feedback_reopened`), `routes/feedback.ts` (`POST /`, `GET /mine` any auth; `GET /`, `PATCH /:id` admin), mounted at `/api/feedback` in `server.ts`. `ActivityLog` gained 4 feedback actions. `bun run typecheck` passes in `backend/`.
- **Frontend**: `types.ts` gained `Feedback`/`FeedbackInput`/`FeedbackUpdateInput` + wrappers + 4 `ActivityAction` members; new `hooks/use-feedback.ts` (`useMyFeedback`, `useFeedback`, `useCreateFeedback`, `useUpdateFeedback` — shared `["feedback"]` invalidation) and `lib/feedback.ts` (category labels, status badge meta). New `routes/feedback.tsx` (employee: submit dialog with category `Select` + anonymous `Checkbox`, search + status filter, detail dialog with admin response) and `routes/admin/feedback.tsx` (admin: status/category filters + search, review dialog with response textarea, Save response + Mark resolved / Reopen — combined PATCH when both are given); both registered in `routes.ts` with sidebar entries (employee "Feedback" under My workspace, admin "Feedback" under Administration); `admin/activity-log.tsx` labels + summarizes the 4 feedback actions. `bun run typecheck` + `bun run build` pass in `frontend/`.
- **Not runtime-tested** (no live backend/DB session): flows verified by typecheck/build only — a browser pass against the running API is recommended (submit attributed + anonymous feedback as an employee, verify the employee sees their own status/responses, respond + resolve/reopen as admin, confirm anonymous rows never show a name and name-search doesn't surface them, check the activity log).
