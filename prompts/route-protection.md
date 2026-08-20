# Protected routes — React Router layout + auth guard

## Goal

Only **one public route**: the home page (`/`) containing the login form. Everything else must be protected:

- A signed-in user on the home page → redirected to `/dashboard` (already implemented in `LoginPage`).
- A signed-out user trying to access a protected route → redirected back to `/`.
- Protected routes are grouped under a **React Router pathless layout** that enforces authentication before rendering its children.

## Context

- Auth is **cookie-based** (httpOnly JWT set by the backend on login). The cookie is only visible to the browser, and the API lives on a different origin than the frontend dev server — so a server-side `loader` cannot reliably read the session. The session must be checked **client-side**.
- TanStack Query already owns the session: `useCurrentUser()` (GET /auth/me, `retry: false`, seeded by `useLogin`). A component guard built on this hook is the right pattern — no duplicated fetch in a `clientLoader`, and the cache stays the single source of truth.
- Routing today: `app/routes.ts` = `index("routes/home.tsx")` + `route("dashboard", "routes/dashboard.tsx")`. `@react-router/dev/routes` exports `layout(file, children)` (verified in the installed package).
- Design system: intentional loading/error states, accessible (semantic + visible focus), 150–250ms motion, theme tokens only.
- `verbatimModuleSyntax` → `import type` for types.

## Implementation

1. **`app/routes.ts`** — group protected routes in a pathless layout:
   ```ts
   export default [
     index("routes/home.tsx"),
     layout("routes/protected.tsx", [
       route("dashboard", "routes/dashboard.tsx"),
     ]),
   ] satisfies RouteConfig;
   ```
2. **New `app/routes/protected.tsx`** — thin layout route: default export renders `<RequireAuth><Outlet /></RequireAuth>`. No markup of its own (per knowledge.md: keep routes thin, push logic into components).
3. **New `app/components/auth/require-auth.tsx`** — the guard component:
   - `useCurrentUser()` for the session.
   - `isPending` → full-viewport loading state (accessible: `aria-busy`, spinner/skeleton) — never redirect before the session resolves (avoids flashing protected content or bouncing users during SSR/hydration).
   - No user (401 **or** network failure — both mean "no verifiable session") → `<Navigate to="/" replace />`.
   - User present → render `children`.
4. **Home page** — keep the existing signed-in → `/dashboard` redirect (`LoginPage` already does this). No change.
5. **Dashboard** — stays a placeholder; it now simply requires auth. Full dashboard content is a later step.

## Edge cases / notes

- **No flash**: the guard blocks rendering of protected UI until `me` resolves.
- **Offline backend**: guard treats it as not-authenticated → user lands on the login page, where submitting shows "Cannot reach the API server" via `getErrorMessage`.
- **Deep links**: signed-out `/dashboard` visit → redirected to `/` (no return-to-origin; keep simple).
- **SSR**: during SSR the `me` query is pending, so the guard renders the loading state; redirects only happen client-side after resolution.
- No backend changes; token storage unchanged (httpOnly cookie).

## Affected files

- Modified: `frontend/app/routes.ts`
- New: `frontend/app/routes/protected.tsx`, `frontend/app/components/auth/require-auth.tsx`

## Done when

- `bun run typecheck` passes in `frontend/` (and `bun run build`).
- Signed-out visit to `/dashboard` (or any future protected route) redirects to `/` with no flash of protected content.
- Signed-in visit to `/` redirects to `/dashboard`; signed-in visit to `/dashboard` renders the placeholder.

## Post-approval implementation & verification (2026-08-16)

- `app/routes.ts`: `index(home)` + `layout("routes/protected.tsx", [ route("dashboard") ])` — pathless layout groups all protected routes.
- New `app/routes/protected.tsx`: thin layout rendering `<RequireAuth><Outlet /></RequireAuth>`.
- New `app/components/auth/require-auth.tsx`: `useCurrentUser()` guard — `isPending` → full-viewport spinner (`role="status"`); no user (401 or network failure) → `<Navigate to="/" replace />`; user → children.
- Home page redirect for signed-in users was already in place (`LoginPage`).
- Verified: `bun run typecheck` + `bun run build` pass (`protected` chunk emitted).
