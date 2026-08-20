# Login page (home route) + dashboard placeholder + /demo move

## Goal

Turn the home page (`/`) into a **well-designed login page** for the Employee Management System:

1. Users enter credentials (email + password) in a polished, custom layout.
2. On submit, the frontend calls the existing `POST /api/auth/login` endpoint via the TanStack Query `useLogin` hook.
3. The backend validates credentials and, on success, sets the **httpOnly JWT cookie** — this *is* the secure token storage (the browser holds it; JS/localStorage never touches the token). The frontend then seeds its `me` cache from the response and redirects the user.
4. If the user is already signed in (valid cookie), the home page redirects straight to the dashboard.

Also:
- Move the existing **ApiDemo** data-layer demo to its own `/demo` route so home can become a clean login page.
- Create a **minimal `/dashboard` placeholder** route (full dashboard + route protection arrive in the next step — this step only creates the stub so the post-login redirect has a destination).

## Context

- Auth is **already implemented and working** end-to-end: `POST /api/auth/login` (bcrypt check → JWT in httpOnly cookie), `GET /api/auth/me`, `POST /api/auth/logout`. No backend changes needed.
- Frontend data layer exists: `app/lib/api.ts` (Axios, `withCredentials: true`), `app/hooks/use-auth.ts` (`useCurrentUser` / `useLogin` / `useLogout`), `app/lib/query-client.ts`. `useLogin` already seeds the `me` cache on success.
- Routing today: `app/routes.ts` has a single `index("routes/home.tsx")` which renders `<ApiDemo />`. `ApiDemo` (in `app/components/api-demo.tsx`) is the demo session/admin screen with its own inline login form + profile view + create-user form.
- Design system (knowledge.md): theme tokens only (shadcn CSS vars; monochrome black/white palette already defined in `app.css`), Inter body + Geist heading faces (already loaded), lucide-react icons (already installed — the deps use `lucide-react`, not `react-icons`), 150–250ms ease-out motion, intentional loading/error/empty states, accessible (semantic HTML, visible focus, contrast), fully responsive.
- React Router v7 framework mode; `useNavigate`/`<Link>` for client-side navigation. TanStack Query owns server state; React Router owns routing.
- `verbatimModuleSyntax` → `import type` for type-only imports.
- Package manager: **Bun** (`bun run typecheck`, `bun run build`).

## Design (login page)

Custom split-screen auth layout, distinct from the default shadcn look:

- **Desktop**: full-height grid, two panels. Left brand panel: subtle background treatment built from theme tokens (e.g. layered radial/linear gradients from `--primary`/`--muted` at low opacity — no hardcoded hex), product logo mark + wordmark, product name, a one-line value prop, maybe small feature bullets. Right panel: centered login card on `--background`.
- **Mobile/tablet**: single column — compact brand header on top, login card below; must not break.
- Login form: email + password fields (autocomplete, `aria-invalid` + inline validation on submit), show/hide password toggle (lucide `Eye`/`EyeOff`), loading state on submit (spinner + disabled), error alert showing `getErrorMessage(error)` from the backend (wrong credentials, network down, etc.), submit button full-width. No registration link — accounts are created by admins (show a muted note).
- Motion: 150–250ms ease-out fades/slides on mount and state flips only.

## Implementation

1. **Routing** (`app/routes.ts`):
   - `index("routes/home.tsx")` → login page.
   - `route("demo", "routes/demo.tsx")` → the moved ApiDemo.
   - `route("dashboard", "routes/dashboard.tsx")` → minimal placeholder.
2. **`app/routes/home.tsx`** → thin route: meta (title/description) + `<LoginPage />` component.
3. **New `app/components/auth/login-page.tsx`**: the split-screen layout + brand panel + card shell; uses `useCurrentUser()` to detect an existing session and `useNavigate` to redirect to `/dashboard` once `me` resolves with a user. Orchestrates `LoginForm`.
4. **New `app/components/auth/login-form.tsx`**: the form (fields, validation, submit, error alert). Uses `useLogin()`; on success navigates to `/dashboard` (the mutation already seeds `me`).
5. **New `app/routes/dashboard.tsx`**: minimal placeholder — header ("Dashboard"), current signed-in user (via `useCurrentUser`) or "signed out" note, link back to home. Deliberately thin; protection is the next step.
6. **New `app/routes/demo.tsx`**: renders the existing `<ApiDemo />` so the demo stays reachable at `/demo` (meta title "API Demo"). No changes to `api-demo.tsx`.
7. **Unused template files**: `app/welcome/*` (`welcome.tsx`, `logo-*.svg`) are dead template cruft not referenced by any route — leave them untouched this step (out of scope), unless the login page wants to reuse a logo mark.

## Affected files

- New: `frontend/app/components/auth/login-page.tsx`, `frontend/app/components/auth/login-form.tsx`, `frontend/app/routes/demo.tsx`, `frontend/app/routes/dashboard.tsx`
- Modified: `frontend/app/routes.ts`, `frontend/app/routes/home.tsx`
- No backend changes.

## Edge cases / notes

- **Token storage stays cookie-based** — do NOT add an Authorization header or localStorage token. The httpOnly cookie already satisfies "store the token securely". The login response body only carries the sanitized user; the token lives in the `Set-Cookie` header.
- Already-signed-in users hitting `/` should be redirected to `/dashboard` (no flash of the form — gate on `me.isPending` before redirecting).
- Login error states: 401 wrong credentials, 400 missing fields, network/offline → readable message via `getErrorMessage`.
- Session flash between login success and redirect: `useLogin.onSuccess` seeds `me`, so the redirect target can render the user immediately.
- Dark mode must look right (existing `.dark` tokens); no hardcoded colors anywhere.
- Keep `home.tsx`/`demo.tsx` thin; all markup lives in components.

## Done when

- `bun run typecheck` passes in `frontend/` (and `bun run build` if quick).
- `/` shows the designed login page; submitting valid admin/employee credentials redirects to `/dashboard`; wrong password shows the backend error; `/demo` still shows the ApiDemo screen; a signed-in user visiting `/` lands on `/dashboard` immediately.

## Post-approval implementation & verification (2026-08-16)

- `app/routes.ts`: `index(home)` + `route("demo")` + `route("dashboard")`.
- `app/routes/home.tsx` → `<LoginPage />` (meta: "Sign in | Employee Management System").
- New `app/components/auth/login-page.tsx`: split-screen brand panel (theme-token gradients, custom `Building2` mark — template `welcome/logo-*.svg` are React Router branding and were NOT reused), feature bullets, mobile brand header, skeleton-while-`me`-resolves, signed-in → `navigate("/dashboard", { replace: true })`.
- New `app/components/auth/login-form.tsx`: email/password with inline validation, show/hide password toggle, loading spinner, `getErrorMessage` alert, autocomplete/aria attributes, post-login `navigate("/dashboard")`.
- New `app/routes/demo.tsx` (renders existing `<ApiDemo />`) and `app/routes/dashboard.tsx` (minimal placeholder showing the signed-in user; signed-out → link home).
- No backend changes; token stays in the httpOnly cookie.
- Verified: `bun run typecheck` passes; `bun run build` passes (home/dashboard chunks emitted).
- **Follow-up (2026-08-16): /demo removed completely** per user request — deleted `routes/demo.tsx`, `components/api-demo.tsx`, `hooks/use-users.ts`, and the `demo` route entry. `CreateUserInput` kept in `types.ts` (mirrors backend DTO; needed for the upcoming users CRUD step). `bun run typecheck` + `bun run build` pass.
