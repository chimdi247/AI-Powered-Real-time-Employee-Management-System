# JWT Authentication, User Model & Admin-Only User Creation

## Goal
Stand up the authentication foundation for the EMS backend:
1. **JWT auth** — a secure `JWT_SECRET` from the environment; JSON Web Tokens maintain the authenticated state after login (delivered as an httpOnly cookie, per the cookie-based plan established in `prompts/middleware-setup.md`).
2. **User model** — Mongoose model with the fields needed for authentication and authorization.
3. **Admin-only user creation** — no public registration endpoint; only an authenticated **admin** can create users.
4. **Password security** — bcrypt hashing so plain-text passwords are never stored.

## Context
- Express 5 + Bun + TypeScript backend; entry `backend/src/server.ts`. Middleware chain in place: morgan → helmet → cors (`credentials: true` for cookies) → `cookieParser(COOKIE_SECRET)` → json/urlencoded.
- MongoDB connection ready via `backend/src/db/index.ts` (`connectDB`/`disconnectDB`).
- Target architecture (knowledge.md): `models/`, `controllers/`, `routes/`, `middlewares/`, `lib/` under `backend/src/`.
- No models/routes/middleware exist yet — this step creates the first of each.
- **User decision**: first admin is bootstrapped via an idempotent seed script (`bun run seed`) reading `ADMIN_EMAIL` / `ADMIN_PASSWORD` / `ADMIN_NAME` from env.
- Package manager: **Bun**. Use pure-JS packages only (`bcryptjs`, `jsonwebtoken`) — no native builds (Windows-safe).

## Implementation
1. **Install deps** in `backend/`: `bcryptjs`, `jsonwebtoken`; dev: `@types/bcryptjs`, `@types/jsonwebtoken`.
2. **Env**: add to `backend/.env` (real dev values) and `backend/.env.example` (placeholders):
   - `JWT_SECRET=<random dev secret>` (comment: `openssl rand -hex 32`)
   - `JWT_EXPIRES_IN=7d` (default `7d` if unset)
   - `ADMIN_NAME=Admin`, `ADMIN_EMAIL=admin@ems.local`, `ADMIN_PASSWORD=<strong dev password>`
3. **Model** `backend/src/models/User.ts`:
   - `name` (required, trim), `email` (required, unique, lowercase, trim), `password` (required, minlength 8, `select: false`), `role` (enum `["admin","employee"]`, default `"employee"`), `timestamps: true`.
   - `pre("save")` hook: hash `password` with bcryptjs (cost 10) only when modified.
   - Instance method `comparePassword(candidate): Promise<boolean>`.
   - `toJSON` transform: strip `password` and `__v`.
4. **JWT lib** `backend/src/lib/jwt.ts`: `signAccessToken(user)` and `verifyAccessToken(token)` using `JWT_SECRET` + `JWT_EXPIRES_IN`; payload = `{ sub: user.id, role }`.
5. **Middlewares** `backend/src/middlewares/`:
   - `requireAuth.ts`: read token from `req.cookies.token` → `verifyAccessToken` → load user from DB (fresh) → attach to `req` (augment Express `Request` via declaration merging) → 401 `{ error: "Not authenticated" }` on missing/invalid/expired/deleted-user.
   - `requireRole.ts`: factory `requireRole(...roles)` → 403 `{ error: "Forbidden" }` when `req.user.role` isn't allowed.
6. **Controllers** `backend/src/controllers/auth.ts` and `users.ts`:
   - `POST /api/auth/login`: verify credentials (401 on failure) → sign JWT → set httpOnly cookie `token` (`httpOnly`, `sameSite: "lax"`, `secure: NODE_ENV === "production"`, `maxAge` from `JWT_EXPIRES_IN`) → 200 with sanitized user.
   - `POST /api/auth/logout`: clear cookie → 200.
   - `GET /api/auth/me`: `requireAuth` → sanitized user.
   - `POST /api/users`: `requireAuth` + `requireRole("admin")` → create user (validate; duplicate email → 409 `{ error }`; mongoose validation error → 400) → 201 with sanitized user.
7. **Routes** `backend/src/routes/auth.ts` + `users.ts`; mount in `server.ts`: `app.use("/api/auth", authRouter)`, `app.use("/api/users", usersRouter)`.
8. **Seed** `backend/src/seed.ts` + script `"seed": "bun src/seed.ts"`: connect DB → if a user with `ADMIN_EMAIL` exists, log "already exists" and exit; else create admin (bcrypt-hashed) and log credentials hint → disconnect. Idempotent.
9. **JSON error handling**: replace the pass-through in the CORS error handler chain with a final JSON error middleware (404 `{ error }`, mongoose `ValidationError` → 400 with message, duplicate key → 409, else 500 `{ error: "Internal server error" }`) so API errors are JSON, never the default HTML page.

## Affected files
- `backend/package.json`, `backend/bun.lock` (new deps + `seed` script)
- `backend/.env`, `backend/.env.example` (JWT_SECRET, JWT_EXPIRES_IN, ADMIN_*)
- New: `backend/src/models/User.ts`, `backend/src/lib/jwt.ts`, `backend/src/middlewares/requireAuth.ts`, `backend/src/middlewares/requireRole.ts`, `backend/src/controllers/auth.ts`, `backend/src/controllers/users.ts`, `backend/src/routes/auth.ts`, `backend/src/routes/users.ts`, `backend/src/seed.ts`
- `backend/src/server.ts` (mount routers + JSON error handler)

## Edge cases / notes
- **No registration endpoint** — the only creation path is `POST /api/users` (admin-gated).
- Password must never appear in responses (select: false + toJSON transform).
- `requireAuth` re-reads the user from DB on every request so deleted/disabled users lose access immediately; keep `token` cookie name consistent everywhere.
- Express 5: async handler errors must be caught (wrap async controllers in a tiny `asyncHandler` helper) or rely on Express 5's native promise rejection forwarding (Express 5 forwards rejected promises to the error handler automatically — verify and use that).
- Seed must not run while the server is up in prod; it's a dev/ops script. Never log the admin password — only the email.
- TypeScript strictness: augment `Express.Request` with `user` (declaration merging in a `*.d.ts`); respect `verbatimModuleSyntax` (use `import type`).

## Post-approval decisions & verification (2026-08-12)
- **MONGO_URI changed to replica-set form** in `.env`: `directConnection=true` pinned to a single host, which answered as a **secondary** (`NotWritablePrimary` on writes). Switched to all three shard hosts + `replicaSet=atlas-lauvxf-shard-0` so the driver discovers the primary. Seed then succeeded.
- **Env added**: `JWT_SECRET` (generated, `openssl rand -hex 32`), `JWT_EXPIRES_IN=7d`, `ADMIN_NAME/ADMIN_EMAIL/ADMIN_PASSWORD` (dev values in `.env`).
- Verified end-to-end: seed idempotent (2nd run skips); login wrong password → 401; login admin → 200 (no password in body); `/me` → 200; create employee as admin → 201; duplicate email → 409; create without cookie → 401; create as employee → 403; logout → 200; `/me` after logout → 401; unknown route → 404 JSON. Stored password confirmed bcrypt-hashed (`$2...`).
- Stale dev servers were cleaned up; `bun run dev` restarted and serving the new code.

## Done when
- `bun install` succeeds; `bun run typecheck` passes in `backend/`.
- `bun run seed` creates the admin idempotently (second run says "already exists").
- Runtime (when network to Atlas is available): `POST /api/auth/login` sets the `token` cookie; `GET /api/auth/me` returns the user; `POST /api/users` as admin returns 201; as employee returns 403; without cookie returns 401; duplicate email returns 409; login with wrong password returns 401.
- No plain-text password in any response; user objects exclude `password`.
