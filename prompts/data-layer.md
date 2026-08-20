# Frontend data layer — TanStack Query + Axios

## Goal

Integrate the frontend with **TanStack Query** (data fetching/caching/state) and **Axios** (HTTP client) so components can talk to the backend REST API through typed hooks. The backend already exists (Express, `/api/auth/*`, `/api/users`) and auth is **cookie-based** (httpOnly JWT), so the Axios instance must send credentials (`withCredentials: true`) and never store tokens in localStorage.

## Scope

- Install `@tanstack/react-query` + `axios` in `frontend/`.
- `app/lib/api.ts` — configured Axios instance: `baseURL` from `VITE_API_URL` (default `http://localhost:5000/api`), `withCredentials`, timeout, plus a shared `getErrorMessage()` that extracts the backend's `{ error }` shape.
- `app/lib/query-client.ts` — `createQueryClient()` with sane defaults (staleTime 60s, gcTime 5m, retry 1, refetchOnWindowFocus off, mutations retry 0).
- `app/types.ts` — shared types mirroring backend DTOs (`User`, `LoginInput`, `CreateUserInput`, role union).
- `app/hooks/use-auth.ts` — `useCurrentUser()` (query on `GET /auth/me`, `retry: false`), `useLogin()` (mutation on `POST /auth/login`, seeds the `me` cache on success), `useLogout()` (mutation on `POST /auth/logout`, clears the `me` cache).
- `app/hooks/use-users.ts` — `useCreateUser()` (mutation on `POST /users`, admin-only endpoint).
- `app/root.tsx` — wrap the app in `QueryClientProvider` (client created per-render via `useState`).
- Demo screen on the home route proving the pattern: session card (skeleton / logged-out login form / logged-in user), admin-only create-user card, intentional loading/error/empty states, responsive two-column layout, subtle motion.
- `frontend/.env.example` documenting `VITE_API_URL`.

## Key constraints

- No backend changes — only frontend.
- Cookie auth → `withCredentials: true`; do NOT add an Authorization header from localStorage.
- Queries run client-side (SSR server has no access to the browser's httpOnly cookie); during SSR they simply render pending/loading.
- `verbatimModuleSyntax` → use `import type` for type-only imports.
- Design system: theme tokens from CSS vars only, skeleton + error + empty states everywhere, 150–250ms transitions, responsive, accessible focus states.
- TanStack Query + React Router: React Router owns routing/navigation; TanStack Query owns server-state. No loader/action changes needed.

## Production note (cookie auth + CORS)

The backend sets the JWT cookie with `sameSite: "lax"`. Lax cookies are NOT sent on cross-site XHR/fetch, so in production the frontend and API must share a registrable domain (e.g. `app.example.com` ↔ `api.example.com`), or the cookie must be `SameSite=None; Secure` (HTTPS-only). Otherwise `withCredentials` requests silently lose the session.

## Done when

- `bun run typecheck` passes in `frontend/`.
- Login → `/me` resolves → session card shows the user; logout clears it; admin sees the create-user form and gets success/error feedback; any 401/403/network error surfaces as a readable message.
