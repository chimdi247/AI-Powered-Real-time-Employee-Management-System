# Express Middleware Setup (Production-Ready Core)

## Goal
Equip the Express backend with the essential middleware every production API needs: environment variable loading (Dotenv), security headers (Helmet), CORS handling, cookie parsing, and JSON/form body parsing — all before any feature routes are built.

## Context
- Express 5 + Bun + TypeScript backend, entry point at `backend/src/server.ts` (from `prompts/express-setup.md`).
- Frontend (React Router) dev server runs on `http://localhost:5173`; no Vite proxy configured yet, so the frontend will call the backend directly → CORS is required.
- Package manager: **Bun**. `backend/.gitignore` already ignores `.env` files.
- User decision: CORS origins are **env-driven** (`CORS_ORIGIN` in `.env`, comma-separated allowlist) with a dev default of `http://localhost:5173`.

## Implementation
1. Install dependencies in `backend/`:
   - runtime: `dotenv`, `helmet`, `cors`, `cookie-parser`
   - dev (types): `@types/cors`, `@types/cookie-parser`
2. Create `backend/.env` (gitignored) with dev values:
   - `PORT=5000`
   - `CORS_ORIGIN=http://localhost:5173`
   - `COOKIE_SECRET=<random dev secret>`
3. Create `backend/.env.example` (committed) with the same keys, placeholder values, and comments explaining each.
4. Update `backend/src/server.ts`, in this order:
   - `import "dotenv/config"` first (loads `backend/.env`)
   - `app.use(helmet())` — security headers
   - `app.use(cors({ origin: <allowlist from CORS_ORIGIN, default http://localhost:5173>, credentials: true }))` — allowlist parsing splits on commas and trims; no origin header (curl/Postman) is allowed
   - `app.use(cookieParser(process.env.COOKIE_SECRET))` — parse cookies, support signed cookies for JWT auth later
   - `app.use(express.json({ limit: "1mb" }))` — JSON body parsing
   - `app.use(express.urlencoded({ extended: true }))` — form body parsing
   - Keep `PORT` read from `process.env.PORT ?? 5000` and the existing `GET /` health check.
5. Keep the `import.meta.main` guard so the app stays testable via import.

## Affected files
- `backend/package.json` (new deps)
- `backend/src/server.ts` (middleware chain)
- `backend/.env` (new, gitignored), `backend/.env.example` (new)

## Edge cases / notes
- Middleware order matters: dotenv must load before anything reads env vars; security/cors/parsing middleware must mount before route handlers.
- `credentials: true` is required later because JWT auth will use cookies.
- `.env` must NOT be committed; `.env.example` is the committed template.
- Express 5 + Helmet 8 and CORS 2 are compatible.

## Done when
- `bun install` succeeds with the new dependencies.
- `bun run typecheck` passes inside `backend/`.
- `bun run dev` boots with no errors; a browser request from `http://localhost:5173` receives CORS headers and the API responds; `curl` responses include Helmet security headers (`x-content-type-options`, `x-frame-options`, etc.).
