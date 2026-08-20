# Inngest Backend Integration

## Goal

Integrate Inngest into the Express backend for durable background functions. Set up the Inngest client, serve endpoint, and export an empty functions array — ready for future function additions.

## Affected Files

- `backend/src/inngest/index.ts` — **NEW**: Inngest client + exported functions array
- `backend/src/server.ts` — Mount the Inngest serve handler at `/api/inngest`

## Implementation

### 1. Create `backend/src/inngest/index.ts`

```ts
import { Inngest } from "inngest";

// Create a client to send and receive events
export const inngest = new Inngest({ id: "ems-app" });

// Inngest functions will be added here
export const functions: never[] = [];
```

### 2. Update `backend/src/server.ts`

- Import `serve` from `inngest/express`
- Import `inngest` and `functions` from `./inngest/index.js`
- Mount the serve handler: `app.use("/api/inngest", serve({ client: inngest, functions }))`
- Place this **before** the 404 handler but **after** all API routers

### Key Notes

- All local imports must end with `.js` (Vercel deployment requirement)
- `INNGEST_DEV=1` should be added to `.env` for local development
- The Inngest SDK is already installed (`"inngest": "^4.18.1"` in package.json)

## Verification

- `bun run typecheck` passes
- Server starts without errors
