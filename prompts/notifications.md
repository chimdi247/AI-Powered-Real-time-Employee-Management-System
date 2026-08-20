# Notification System — Implementation Prompt

## Goal

Implement a real-time notification system that alerts users about important events (leave approvals/rejections, feedback responses, new announcements). Notifications are delivered via Server-Sent Events (SSE) for push-based real-time updates, and accessed through a bell icon dropdown in the header bar.

## Architecture

### Backend

#### 1. Notification Model (`backend/src/models/Notification.ts`)

Mongoose model for persistent notifications:

```ts
interface INotification {
  recipient: ObjectId;       // User who receives the notification
  actor?: ObjectId;          // User who triggered the event (null for system events)
  type: NotificationType;    // Enum: "leave_approved" | "leave_rejected" | "feedback_responded" | "announcement_created"
  title: string;             // Short human-readable title
  message: string;           // Longer description
  read: boolean;             // Whether the recipient has seen it
  link?: string;             // Optional frontend route to navigate to on click
}
```

- Timestamps enabled, `__v` stripped via `toJSON` transform (matching existing patterns).
- Index on `{ recipient: 1, createdAt: -1 }` for the primary access pattern.
- Index on `{ recipient: 1, read: 1 }` for unread count queries.

#### 2. Notification Helper (`backend/src/lib/notifications.ts`)

A helper function (similar to `logActivity` pattern) that creates notification documents:

```ts
export function notify(params: {
  recipient: ObjectId;
  actor?: IUser | null;
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
}): void
```

This is fire-and-forget (like `logActivity`) — failures are swallowed.

#### 3. Notification Routes (`backend/src/routes/notifications.ts`)

All routes require auth.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/notifications` | List current user's notifications (newest first, paginated) |
| GET | `/api/notifications/unread-count` | Return `{ count: number }` for the badge |
| PATCH | `/api/notifications/:id/read` | Mark a single notification as read |
| POST | `/api/notifications/read-all` | Mark all current user's notifications as read |
| GET | `/api/notifications/stream` | SSE endpoint — keeps connection open, sends new notifications as they arrive |

#### 4. Notification Controller (`backend/src/controllers/notifications.ts`)

- `listNotifications`: Parse pagination params, filter by `recipient = currentUser`, sort `createdAt: -1`. Populate `actor` with `name`.
- `unreadCount`: `Notification.countDocuments({ recipient, read: false })`.
- `markAsRead`: Find by id + recipient, set `read: true`. 404 if not found.
- `markAllAsRead`: `Notification.updateMany({ recipient, read: false }, { read: true })`.
- `stream` (SSE): Set headers (`Content-Type: text/event-stream`, `Cache-Control: no-cache`, `Connection: keep-alive`). Keep track of connected clients. When a new notification is created (via the `notify` helper), push it to all connected clients. Use a simple in-memory map of `userId → Set<response>`. On client disconnect, remove from the map. Send a heartbeat comment every 30s to keep the connection alive.

#### 5. Integration Points

Modify existing controllers to create notifications when events happen:

- **`leaves.ts` → `decideLeave`**: After saving the decision, if `decision === "approved"` or `"rejected"`, call `notify()` to the leave owner with appropriate title/message/link.
- **`feedback.ts` → `updateFeedback`**: After saving a response, call `notify()` to the feedback author (unless anonymous) with the response info.
- **`announcements.ts` → `createAnnouncement`**: After creating, notify all department members about the new announcement. Use `User.find({ department })` to get recipient ids, then batch-create notifications.

The `notify` helper should also push to SSE connected clients via the `broadcastToUser(userId, notification)` function.

#### 6. Server Registration (`backend/src/server.ts`)

- Mount `notificationsRouter` at `/api/notifications`.
- Import and make the SSE broadcast function available to the `notify` helper.

### Frontend

#### 1. Types (`frontend/app/types.ts`)

Add notification-related types:

```ts
export type NotificationType = "leave_approved" | "leave_rejected" | "feedback_responded" | "announcement_created";

export interface Notification {
  _id: string;
  recipient: string;
  actor?: Pick<User, "_id" | "name"> | null;
  type: NotificationType;
  title: string;
  message: string;
  read: boolean;
  link?: string;
  createdAt: string;
}

export interface NotificationListResponse {
  notifications: Notification[];
  total: number;
  limit: number | null;
  offset: number;
}

export interface UnreadCountResponse {
  count: number;
}
```

#### 2. Hook: `useNotifications` (`frontend/app/hooks/use-notifications.ts`)

TanStack Query hooks:

- `useNotifications(params)`: Fetches paginated notifications list.
- `useUnreadCount()`: Fetches unread count (used for the badge). Polls every 30s as a fallback.
- `useMarkAsRead()`: Mutation to mark a single notification as read.
- `useMarkAllAsRead()`: Mutation to mark all as read.
- `useNotificationSSE()`: Custom hook that opens an SSE connection to `/api/notifications/stream`. On receiving a message, invalidate the notification queries and update the unread count optimistically. Returns `{ connected: boolean }`. Uses `useEffect` for setup/teardown, reconnection on error with exponential backoff (1s, 2s, 4s, max 30s).

#### 3. Notification Bell + Dropdown (`frontend/app/components/notifications/notification-bell.tsx`)

A new component placed in the app shell header:

- **Bell icon** with an unread count badge (red dot or number).
- **Clicking** opens a **Popover** (using the existing shadcn Popover component) with:
  - Header: "Notifications" title + "Mark all as read" button.
  - Scrollable list of notification items (use ScrollArea).
  - Each item shows: icon by type, title, message (truncated), relative time (e.g. "2m ago"), read/unread styling.
  - Clicking a notification navigates to `notification.link` (if present) and marks it as read.
  - Empty state when no notifications.
  - Loading state with skeletons.

#### 4. Header Integration (`frontend/app/components/layout/app-shell.tsx`)

Add the `NotificationBell` component to the header, between the `SidebarTrigger`/`Separator` and the right side of the header. The SSE hook should be initialized here (or in a provider) so it stays alive across page navigations.

#### 5. SSE Connection Management

The SSE connection should be established once when the user is authenticated and torn down on logout. Options:
- Initialize in `AppShell` (the layout wrapper for all protected routes) since it's always mounted when the user is logged in.
- Use a React context or just a hook in `AppShell` that manages the SSE connection lifecycle.

## Notification Content Examples

| Event | Title | Message | Link |
|-------|-------|---------|------|
| Leave approved | Leave approved | Your {type} leave request for {days} day(s) has been approved. | `/leaves` |
| Leave rejected | Leave rejected | Your {type} leave request for {days} day(s) was not approved. | `/leaves` |
| Feedback responded | Feedback response | An admin responded to your {category} feedback. | `/feedback` |
| New announcement | New announcement | A new announcement "{title}" has been posted in your department. | `/announcements` |

## Edge Cases

- Notifications for anonymous feedback: don't create a notification for the author (they chose anonymity).
- Deleted users: `actor` field may reference a deleted user — handle gracefully (show "System" or omit actor name).
- SSE reconnection: implement exponential backoff. Show a visual indicator if SSE is disconnected.
- Large departments: batch-create notifications efficiently (use `insertMany` instead of N individual creates for announcements).

## Done Criteria

- [ ] Notification model with proper indexes and toJSON transform
- [ ] Notification routes (list, unread-count, mark-read, mark-all-read, SSE stream)
- [ ] `notify()` helper function + SSE broadcast
- [ ] Integration into leave decision, feedback response, and announcement creation
- [ ] Frontend types added
- [ ] TanStack Query hooks (list, unread-count, mark-read, mark-all, SSE)
- [ ] NotificationBell component with popover, badge, empty/loading states
- [ ] SSE connection in AppShell with reconnection logic
- [ ] All notifications have proper links and content
- [ ] Anonymous feedback doesn't generate notifications for the author
- [ ] Batch inserts for department-wide announcement notifications
- [ ] Typecheck passes
