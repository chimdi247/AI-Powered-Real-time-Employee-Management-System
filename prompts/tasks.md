# Employee Tasks

## Goal

Heads of departments can assign tasks to their team members, set deadlines, and track progress. Employees can view their assigned tasks, update status, and submit completed work for review. Push notifications are sent when tasks are assigned.

## Data Model

### Task (backend/src/models/Task.ts)

```ts
interface ITask extends mongoose.Document {
  title: string;
  description?: string;
  // Who the task is assigned to
  assignedTo: mongoose.Types.ObjectId; // ref: User
  // Who created/assigned the task
  assignedBy: mongoose.Types.ObjectId; // ref: User
  // Department context (auto-populated from assignee)
  department?: mongoose.Types.ObjectId | null; // ref: Department
  status: "todo" | "in_progress" | "in_review" | "completed" | "rejected";
  priority: "low" | "medium" | "high" | "urgent";
  dueDate?: Date | null;
  // Employee submission when marking complete
  submissionNotes?: string;
  submittedAt?: Date | null;
  // Head/admin review
  reviewNotes?: string;
  reviewedAt?: Date | null;
  reviewedBy?: mongoose.Types.ObjectId | null; // ref: User
  completedAt?: Date | null;
}
```

Indexes:
- `{ assignedTo: 1, createdAt: -1 }` — employee's task list
- `{ assignedBy: 1, createdAt: -1 }` — head's created tasks
- `{ department: 1, status: 1, createdAt: -1 }` — admin overview
- `{ status: 1, dueDate: 1 }` — overdue tasks query

### Notification Types

Add to `NOTIFICATION_TYPES` in `backend/src/models/Notification.ts`:
- `"task_assigned"` — when a head/admin assigns a task
- `"task_completed"` — when employee marks task as completed (for reviewer)
- `"task_approved"` — when head/admin approves completed work
- `"task_rejected"` — when head/admin rejects and sends back

### Activity Actions

Add to `ACTIVITY_ACTIONS` in `backend/src/models/ActivityLog.ts`:
- `"task_created"`
- `"task_status_updated"`
- `"task_submitted"`
- `"task_reviewed"`

## Backend

### Routes (`/api/tasks`)

| Method | Path | Role | Description |
|--------|------|------|-------------|
| POST | `/` | head, admin | Create/assign a task |
| GET | `/mine` | any | Employee's own assigned tasks |
| GET | `/created` | head, admin | Tasks the user created |
| GET | `/` | admin | All tasks (admin overview) |
| GET | `/:id` | any (assigned or creator) | Task detail |
| PATCH | `/:id/status` | employee (assigned) | Update status (todo → in_progress → in_review) |
| POST | `/:id/submit` | employee (assigned) | Submit completed work with notes |
| POST | `/:id/review` | head, admin (creator) | Approve or reject submission |
| DELETE | `/:id` | admin, creator | Delete a task |

### Controller Logic (`backend/src/controllers/tasks.ts`)

**createTask**: 
- Validate title (required), assignedTo (required, valid ObjectId), priority, dueDate
- Head can only assign to members of their own department
- Auto-set department from assignee's department
- Send `task_assigned` notification to assignee
- Log `task_created` activity

**myTasks**:
- Returns tasks assigned to the current user, newest first
- Optional `?status=` filter, `?search=` on title/description, pagination

**createdTasks**:
- Returns tasks created by the current head/admin, newest first
- Optional `?status=` filter, `?assignee=` filter, pagination

**listTasks** (admin only):
- All tasks with optional `?status=`, `?department=`, `?assignee=`, `?search=` filters, pagination

**updateStatus**:
- Employee can only update their own tasks
- Valid transitions: todo→in_progress, in_progress→in_review, in_review→in_progress
- Log `task_status_updated`

**submitTask**:
- Employee submits their own task with `submissionNotes`
- Sets status to `in_review`, `submittedAt` to now
- Notifies the task creator (`task_completed` notification)
- Log `task_submitted`

**reviewTask**:
- Head/admin reviews (must be the creator or admin)
- Accepts `decision: "approved" | "rejected"` and optional `reviewNotes`
- Approved: status→completed, completedAt, reviewedAt, reviewedBy
- Rejected: status→rejected (employee can resubmit)
- Notifies assignee (`task_approved` or `task_rejected`)
- Log `task_reviewed`

### Mount in server.ts

```ts
import tasksRouter from "./routes/tasks.js";
app.use("/api/tasks", tasksRouter);
```

## Frontend

### Types (`frontend/app/types.ts`)

```ts
export type TaskStatus = "todo" | "in_progress" | "in_review" | "completed" | "rejected";
export type TaskPriority = "low" | "medium" | "high" | "urgent";

export interface Task {
  _id: string;
  title: string;
  description?: string;
  assignedTo: Pick<User, "_id" | "name" | "email">;
  assignedBy: Pick<User, "_id" | "name" | "email">;
  department?: Pick<Department, "_id" | "name"> | null;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate?: string | null;
  submissionNotes?: string;
  submittedAt?: string | null;
  reviewNotes?: string;
  reviewedAt?: string | null;
  reviewedBy?: Pick<User, "_id" | "name"> | null;
  completedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export type TaskStatusFilter = TaskStatus | "all";

export interface TaskInput {
  title: string;
  description?: string;
  assignedTo: string;
  priority?: TaskPriority;
  dueDate?: string;
}

export interface TaskResponse { task: Task; }
export interface TaskListResponse {
  tasks: Task[];
  total: number;
  limit: number | null;
  offset: number;
}
```

Update `NotificationType` to include `"task_assigned" | "task_completed" | "task_approved" | "task_rejected"`.

Update `ActivityAction` to include `"task_created" | "task_status_updated" | "task_submitted" | "task_reviewed"`.

### Hooks (`frontend/app/hooks/use-tasks.ts`)

```ts
// Query keys
export const taskKeys = {
  all: ["tasks"] as const,
  mine: (status, search, limit, offset) => ["tasks", "mine", { status, search, limit, offset }] as const,
  created: (status, assignee, search, limit, offset) => ["tasks", "created", { status, assignee, search, limit, offset }] as const,
  list: (status, department, assignee, search, limit, offset) => ["tasks", "list", { status, department, assignee, search, limit, offset }] as const,
  detail: (id: string) => ["tasks", id] as const,
};

// Hooks: useMyTasks, useCreatedTasks, useTasks (admin), useTask
// Mutations: useCreateTask, useUpdateTaskStatus, useSubmitTask, useReviewTask, useDeleteTask
// All mutations include toast notifications (success/error) per the established pattern
```

### Routes

Add to `frontend/app/routes.ts` inside the protected layout:
```ts
route("tasks", "routes/tasks.tsx"),
...prefix("admin", [
  route("tasks", "routes/admin/tasks.tsx"),
]),
```

### Employee View (`frontend/app/routes/tasks.tsx`)

- Header: "My Tasks" with stats cards (Todo, In Progress, In Review, Completed)
- Table: title, priority badge, status badge, due date, assigned by, actions
- Actions depend on status:
  - todo → "Start" (sets in_progress)
  - in_progress → "Submit for Review" (opens submit dialog with notes)
  - in_review → read-only (waiting for review)
  - rejected → "Resubmit" (opens submit dialog)
- Empty state: "No tasks assigned yet"
- Skeleton loading state
- Search by title/description

### Admin/Head View (`frontend/app/routes/admin/tasks.tsx`)

- Header: "Task Management" with "Assign Task" button
- Table: title, assigned to, priority, status, due date, actions
- Filters: status dropdown, search
- "Assign Task" dialog: title, description, assignee (combobox from department members for heads, all users for admins), priority select, due date
- Review dialog (for in_review tasks): approve/reject with review notes
- Empty state: "No tasks yet"
- Stats cards: total, pending, in progress, completed

### Update Notification Bell

Add task notification icons to `frontend/app/components/notifications/notification-bell.tsx`:
- `task_assigned` → `ClipboardList` icon
- `task_completed` → `ClipboardCheck` icon
- `task_approved` → `CircleCheck` icon
- `task_rejected` → `XCircle` icon

## Files to Create/Modify

### Backend (new)
1. `backend/src/models/Task.ts` — Mongoose model
2. `backend/src/controllers/tasks.ts` — CRUD + status/review logic
3. `backend/src/routes/tasks.ts` — Express router

### Backend (modify)
4. `backend/src/server.ts` — mount tasks router
5. `backend/src/models/Notification.ts` — add task notification types
6. `backend/src/models/ActivityLog.ts` — add task activity actions
7. `backend/src/lib/notifications.ts` — handle task notification emails
8. `frontend/app/components/notifications/notification-bell.tsx` — add task icons

### Frontend (new)
9. `frontend/app/hooks/use-tasks.ts` — TanStack Query hooks
10. `frontend/app/routes/tasks.tsx` — Employee task view
11. `frontend/app/routes/admin/tasks.tsx` — Admin/head task management

### Frontend (modify)
12. `frontend/app/types.ts` — add Task types + update NotificationType/ActivityAction
13. `frontend/app/routes.ts` — add task routes
14. `frontend/app/hooks/use-notifications.ts` — no changes needed (SSE handles new types)

## Done when

- Heads can assign tasks to department members with title, description, priority, due date
- Employees see their tasks, can start, submit with notes, and resubmit rejected tasks
- Heads/admins review submissions (approve/reject with notes)
- Push notifications sent on assignment, submission, approval, rejection
- `bun run typecheck` passes (no new errors beyond pre-existing ones)
