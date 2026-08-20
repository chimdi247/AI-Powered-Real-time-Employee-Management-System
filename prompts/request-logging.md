# Request Logging with Morgan

## Goal
Add request logging to the Express backend using **Morgan** so every incoming request (GET, POST, PUT, PATCH, DELETE, …) is logged with its HTTP method, path, response status, and execution time — making API activity easy to monitor and debug during development.

## Context
- Express 5 + Bun + TypeScript backend, entry point at `backend/src/server.ts` (middleware chain from `prompts/middleware-setup.md` is in place: helmet → cors → cookie-parser → json/urlencoded).
- The `dev` format is the right fit here: it prints `:method :url :status :response-time ms - :res[content-length]` — exactly the method/status/response-time output requested.
- Package manager: **Bun**.

## Implementation
1. Install dependencies in `backend/`:
   - runtime: `morgan`
   - dev (types): `@types/morgan`
2. Update `backend/src/server.ts`:
   - `import morgan from "morgan";`
   - Mount as the **first** global middleware (before helmet) so every request — including 404s and errors — is logged:
     - `app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));`
   - `combined` (Apache-style) for production logs, `dev` (concise, colored, with response time) for development — no new env vars required.
3. No route or env changes needed; `.env`/`.env.example` untouched.

## Affected files
- `backend/package.json` (new deps)
- `backend/src/server.ts` (one import + one `app.use`)

## Edge cases / notes
- Morgan is a 4.x/5.x-compatible logging middleware; mount order only matters relative to routes, and putting it first guarantees coverage of all requests.
- `dev` format only applies in non-production; production logs use `combined` (no response time, standard for access logs).
- TypeScript: `@types/morgan` is required; verify typecheck passes (Morgan's `RequestHandler` must stay compatible with Express 5 types).

## Done when
- `bun install` succeeds with the new dependencies.
- `bun run typecheck` passes inside `backend/`.
- `bun run dev` boots; hitting an endpoint (e.g. `GET /` via curl) prints a `dev`-format log line with method, URL, status, and response time.
