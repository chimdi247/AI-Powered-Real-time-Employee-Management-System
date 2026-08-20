# Express + Nodemon Dev Setup

## Goal
Stand up the Express backend so the project has a working REST API foundation: a TypeScript entry point, a dev workflow that auto-restarts on file changes, and a server listening on port **5000**.

## Context
- Backend currently contains only a placeholder `index.ts` (`console.log("Hello via Bun!")`).
- Package manager / runtime: **Bun** (project convention). Nodemon will execute `bun` so TypeScript runs natively with no build step (user-confirmed choice).
- Target architecture (knowledge.md): the Express entry point lives at `backend/src/server.ts`.

## Implementation
1. Install dependencies in `backend/`:
   - runtime: `express`
   - dev: `nodemon`, `@types/express`, `typescript`
2. Create `backend/src/server.ts`:
   - Express app listening on port 5000
   - Root route (`GET /`) returning a simple confirmation message
   - Logs the listening URL on startup
3. Configure Nodemon via `backend/nodemon.json`:
   - watch `src`, extensions `ts,json`, exec `bun src/server.ts`
   - (required so nodemon restarts on `.ts` changes — its default extensions exclude TypeScript)
4. Update `backend/package.json`:
   - `"module"` → `src/server.ts`
   - scripts: `dev` (`nodemon`), `start` (`bun src/server.ts`), `typecheck` (`tsc --noEmit`)
5. Delete the placeholder `backend/index.ts`.
6. Backend `tsconfig.json`: enable `esModuleInterop` (required for `import express from "express"` to typecheck cleanly).

## Affected files
- `backend/package.json`, `backend/tsconfig.json`
- `backend/src/server.ts` (new), `backend/nodemon.json` (new)
- `backend/index.ts` (removed)

## Edge cases / notes
- Port 5000 must be free; the server logs `http://localhost:5000` on startup.
- No feature routes yet — just the root check; feature routes come in later steps.

## Done when
- `bun install` succeeds with the new dependencies.
- `bun run typecheck` passes inside `backend/`.
- `bun run dev` starts nodemon → Express listening on port 5000; `GET /` returns the confirmation message.
- Saving a file under `backend/src/` triggers a nodemon restart.
