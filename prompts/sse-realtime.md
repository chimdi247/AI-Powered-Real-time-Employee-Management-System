# SSE Real-Time Integration

## Goal

Expand the existing SSE notification system into a general-purpose real-time event system that covers Inngest function progress, data change events (tasks, leaves, attendance), and announcement broadcasts — all pushed to connected clients instantly.

## What Already Exists

- **SSE infrastructure** in `backend/src/lib/notifications.ts`: `sseClients` Map, `registerSSEClient()`, `pushToSSE()`
- **SSE endpoint** at `GET /api/notifications/stream` with heartbeat
- **Frontend hook** `useNotificationSSE()` with auto-reconnect and query invalidation
- **Inngest functions** that call `notify()` on completion (which already pushes via SSE)
- **Controllers** that call `notify()`/`notifyBatch()` on data changes

## Architecture

### 1. General-Purpose SSE Event System

**New file: `backend/src/lib/sse.ts`**

Extract and generalize the SSE connection manager from `notifications.ts`:

```ts
// Event types that can be pushed via SSE
type SSEEventType =
  | "notification"      // Existing notification push
  | "task-updated"      // Task status/title changes
  | "leave-updated"     // Leave request status changes
  | "attendance-updated" // Attendance marked/changed
  | "announcement-new"  // New announcement created
  | "review-updated"    // Performance review status changes
  | "insight-ready"     // AI insight generation complete
  | "review-ready";     // AI review generation complete

interface SSEEvent {
  type: SSEEventType;
  data: unknown;
  timestamp: number;
}

// Connection manager
const clients = new Map<string, Set<Response>>();

function registerClient(userId: string, res: Response): () => void;
function pushToClient(userId: string, event: SSEEvent): void;
function pushToUsers(userIds: string[], event: SSEEvent): void;
function pushToAll(event: SSEEvent): void;
function getClientCount(): number;
```

### 2. Update `notifications.ts` to Use Shared SSE

**Modify: `backend/src/lib/notifications.ts`**

- Import `pushToClient` from `./sse.js` instead of maintaining its own `sseClients` Map
- The `pushToSSE()` function now delegates to the shared SSE system
- Keep the `registerSSEClient()` export for backward compatibility (delegates to `sse.ts`)
- SSE endpoint in controller stays the same

### 3. Emit Events from Controllers

**Modify controllers** to emit SSE events after data changes:

| Controller | Event Type | When | Target |
|------------|-----------|------|--------|
| `tasks.ts` | `task-updated` | Status change, assignment, creation | Assignee + creator |
| `leaves.ts` | `leave-updated` | Approval/rejection/creation | Employee + admin |
| `attendance.ts` | `attendance-updated` | Attendance marked | Employee |
| `announcements.ts` | `announcement-new` | Announcement created | Department members |
| `performanceReviews.ts` | `review-updated` | Review status change | Employee + reviewer |

**Pattern:**
```ts
import { pushToUsers } from "../lib/sse.js";

// After data change + notify:
pushToUsers([user1._id.toString(), user2._id.toString()], {
  type: "task-updated",
  data: { taskId: task._id, status: task.status, title: task.title },
  timestamp: Date.now(),
});
```

### 4. Emit Events from Inngest Functions

**Modify Inngest functions** to emit progress and completion events:

**`generateReview.ts`:**
- After each step, emit a progress event to the reviewer
- On completion, emit `review-ready` to the employee

**`generateInsight.ts`:**
- After each step, emit a progress event to the triggering user
- On completion, emit `insight-ready` to the triggering user

**Pattern:**
```ts
import { pushToClient } from "../../lib/sse.js";

// In a step.run callback:
await step.run("generate-ai-review", async () => {
  // ... generate review ...
  
  // Emit progress event
  pushToClient(reviewerId, {
    type: "review-updated",
    data: { reviewId, status: "generating", step: "AI analysis" },
    timestamp: Date.now(),
  });
  
  return result;
});
```

### 5. Frontend SSE Hook

**New file: `frontend/app/hooks/use-sse.ts`**

General-purpose SSE hook that listens to specific event types:

```ts
interface UseSSEOptions {
  event?: SSEEventType;     // Filter to specific event type
  onEvent?: (event: SSEEvent) => void;  // Callback for events
  enabled?: boolean;
}

function useSSE(options?: UseSSEOptions): { status: SSEStatus };
```

**Features:**
- Connects to `/api/notifications/stream` (reuses existing endpoint)
- Filters events by type
- Auto-reconnect with exponential backoff
- Clean up on unmount

### 6. Update Existing Frontend Hooks

**Modify hooks** to listen for SSE events and invalidate queries:

| Hook | Listens For | Invalidates |
|------|-------------|-------------|
| `use-tasks.ts` | `task-updated` | `taskKeys.all` |
| `use-leaves.ts` | `leave-updated` | `leaveKeys.all` |
| `use-attendance.ts` | `attendance-updated` | `attendanceKeys.all` |
| `use-announcements.ts` | `announcement-new` | `announcementKeys.all` |
| `use-performance-reviews.ts` | `review-updated` | `reviewKeys.all` |
| `use-ai-insights.ts` | `insight-ready` | `insightKeys.all` |

**Pattern:**
```ts
import { useSSE } from "@/hooks/use-sse";

export function useTasks() {
  const queryClient = useQueryClient();
  
  // Listen for real-time task updates
  useSSE({
    event: "task-updated",
    onEvent: () => {
      queryClient.invalidateQueries({ queryKey: taskKeys.all });
    },
  });
  
  // ... existing query ...
}
```

### 7. SSE Event Types (shared)

**New file: `frontend/app/types/sse.ts`** (or add to `types.ts`)

```ts
type SSEEventType =
  | "notification"
  | "task-updated"
  | "leave-updated"
  | "attendance-updated"
  | "announcement-new"
  | "review-updated"
  | "insight-ready"
  | "review-ready";

interface SSEEvent {
  type: SSEEventType;
  data: unknown;
  timestamp: number;
}
```

## Files to Create

- `backend/src/lib/sse.ts` — General-purpose SSE event system
- `frontend/app/hooks/use-sse.ts` — General-purpose SSE hook

## Files to Modify

- `backend/src/lib/notifications.ts` — Delegate SSE to shared system
- `backend/src/controllers/tasks.ts` — Emit `task-updated` events
- `backend/src/controllers/leaves.ts` — Emit `leave-updated` events
- `backend/src/controllers/attendance.ts` — Emit `attendance-updated` events
- `backend/src/controllers/announcements.ts` — Emit `announcement-new` events
- `backend/src/controllers/performanceReviews.ts` — Emit `review-updated` events
- `backend/src/inngest/functions/generateReview.ts` — Emit progress + `review-ready`
- `backend/src/inngest/functions/generateInsight.ts` — Emit progress + `insight-ready`
- `frontend/app/types.ts` — Add SSE types
- `frontend/app/hooks/use-tasks.ts` — Listen for `task-updated`
- `frontend/app/hooks/use-leaves.ts` — Listen for `leave-updated`
- `frontend/app/hooks/use-attendance.ts` — Listen for `attendance-updated`
- `frontend/app/hooks/use-announcements.ts` — Listen for `announcement-new`
- `frontend/app/hooks/use-performance-reviews.ts` — Listen for `review-updated`
- `frontend/app/hooks/use-ai-insights.ts` — Listen for `insight-ready`

## Done When

- [ ] General-purpose SSE event system created in `backend/src/lib/sse.ts`
- [ ] Existing notification SSE delegates to shared system
- [ ] Task controllers emit `task-updated` events
- [ ] Leave controllers emit `leave-updated` events
- [ ] Attendance controllers emit `attendance-updated` events
- [ ] Announcement controllers emit `announcement-new` events
- [ ] Performance review controllers emit `review-updated` events
- [ ] Inngest functions emit progress and completion events
- [ ] Frontend `useSSE()` hook created with event filtering
- [ ] Frontend hooks listen for SSE events and invalidate queries
- [ ] TypeScript typecheck passes
