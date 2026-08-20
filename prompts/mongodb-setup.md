# MongoDB Connection with Mongoose

## Goal
Connect the Express backend to MongoDB using **Mongoose**: a dedicated database configuration module under `backend/src/db/`, connection string loaded from the environment, and the connection established when the server starts. This lays the foundation for schema-based models, validation, and clean DB interaction for the employee management features.

## Context
- Express 5 + Bun + TypeScript backend, entry point at `backend/src/server.ts` (middleware chain from `prompts/middleware-setup.md` is in place: morgan → helmet → cors → cookie-parser → json/urlencoded).
- `backend/.env` already contains the live Atlas connection string as `MONGO_URI` (user-confirmed, already set up). `.env.example` is the committed template and must mirror any new env key.
- Target architecture (knowledge.md): db connection lives in `backend/src/db/`, Mongoose models in `backend/src/models/`.
- Package manager: **Bun** (`bun add`). Mongoose ships its own TypeScript types — no `@types/mongoose` needed.

## Implementation
1. Install `mongoose` in `backend/` (runtime dependency): `bun add mongoose`.
2. Create `backend/src/db/index.ts` — the dedicated database configuration:
   - `import mongoose from "mongoose";`
   - Export `connectDB()` that:
     - Reads `process.env.MONGO_URI`; throws a clear error if missing.
     - Calls `mongoose.connect(uri)` and returns the connection.
   - Export `disconnectDB()` that calls `mongoose.disconnect()` (used for tests/clean shutdown).
   - Use `console.log`/`console.error` for a friendly "MongoDB connected" / failure message, including the database name from the connection URI.
3. Update `backend/src/server.ts`:
   - Import `connectDB` from `./db`.
   - Inside the `import.meta.main` block, `await connectDB()` **before** `app.listen(...)` so the server only accepts requests once the DB is ready; log success, and `process.exit(1)` on failure.
4. Update `backend/.env.example` (committed template):
   - Add `MONGO_URI="mongodb://localhost:27017/ems"` with a comment (placeholder for local dev; real Atlas URI goes in `.env`, which is gitignored).
   - Do **not** touch `backend/.env` (already has the real value).

## Affected files
- `backend/package.json` (new dep: `mongoose`), `backend/bun.lock`
- `backend/src/db/index.ts` (new)
- `backend/src/server.ts` (await `connectDB()` before listen)
- `backend/.env.example` (add `MONGO_URI` placeholder)

## Edge cases / notes
- **Env var name**: `.env` uses `MONGO_URI` — the code must read exactly that (not `MONGODB_URI`).
- Server should fail fast (exit non-zero) if the DB can't be reached — no point serving requests against a dead DB.
- No models or routes yet — this step only establishes the connection; models come in later steps.
- Mongoose v8+: no legacy options (`useNewUrlParser`, `useUnifiedTopology`) needed — plain `mongoose.connect(uri)`.

## Post-approval decisions (recorded 2026-08-12)
- **bson pin**: mongoose 9.x pulls bson 7.3.x, which crashes Bun at import (`node:v8 isBuildingSnapshot` NotImplementedError). Added `"overrides": { "bson": "7.2.0" }` to `backend/package.json` (verified: bson 7.2.0 has no `isBuildingSnapshot` call).
- **Direct URI**: the `mongodb+srv://` URI in `.env` cannot connect on the dev machine (local DNS refuses raw SRV/TXT client queries — Node 24 fails the same way). User approved swapping `MONGO_URI` to a direct `mongodb://` URI: `...@ac-vhirlc8-shard-00-00.q9oramt.mongodb.net:27017/ems?authSource=admin&directConnection=true&tls=true` (shared M0 cluster supports `directConnection`; database name `ems`).

## Verification note (2026-08-12)
- Verified end-to-end earlier: `✅ MongoDB connected: ems` + `✅ Express server running on http://localhost:5000` + HTTP 200.
- Later re-runs failed with `MongooseServerSelectionError` — root cause is a transient network outage on the dev machine (raw TCP to the Atlas host **and** its IP is ECONNREFUSED, even `curl https://api.ipify.org` fails). Not a code issue; retry when connectivity returns. If it persists, check the cluster's Network Access allowlist in Atlas (must include the machine's current public IP).

## Done when
- `bun install` succeeds with `mongoose` added.
- `bun run typecheck` passes inside `backend/`.
- `bun run dev` boots: server logs successful MongoDB connection (with db name) and "Express server running on http://localhost:5000".
- Stopping the server disconnects cleanly (no unhandled errors).
