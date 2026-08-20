# Dashboard Analytics — Implementation Prompt

## Goal
Replace the placeholder dashboard with a full analytics page showing key metrics and visualizations for admins and heads of departments.

## Backend

### New endpoint: `GET /api/dashboard/analytics`
**File:** `backend/src/controllers/dashboard.ts`
**Route:** `backend/src/routes/dashboard.ts`

Returns aggregated data for the dashboard in a single response:

```json
{
  "summary": {
    "totalEmployees": number,
    "totalDepartments": number,
    "activeTasks": number,
    "pendingLeaves": number,
    "attendanceRate": number,
    "completedTasks": number
  },
  "attendanceOverview": {
    "present": number,
    "absent": number,
    "late": number,
    "half_day": number,
    "on_leave": number
  },
  "leaveStats": {
    "pending": number,
    "approved": number,
    "rejected": number,
    "byType": [{ "type": string, "count": number }]
  },
  "taskStats": {
    "todo": number,
    "in_progress": number,
    "in_review": number,
    "completed": number,
    "rejected": number
  },
  "departmentStats": [{
    "name": string,
    "memberCount": number,
    "attendanceRate": number
  }],
  "recentActivity": [{
    "action": string,
    "actorName": string,
    "targetName": string,
    "createdAt": string
  }]
}
```

**Logic:**
- `totalEmployees`: Count users where role !== "admin"
- `totalDepartments`: Count departments
- `activeTasks`: Count tasks where status is NOT "completed" or "rejected"
- `pendingLeaves`: Count leaves where status === "pending"
- `attendanceRate`: Current month attendance rate (present + late + half_day) / working days * employee count
- `completedTasks`: Count tasks where status === "completed"
- `attendanceOverview`: Current month attendance breakdown by status
- `leaveStats`: Current month leave stats (pending, approved, rejected, by type)
- `taskStats`: Current month task status distribution
- `departmentStats`: Per-department member count and attendance rate
- `recentActivity`: Last 10 activity log entries with actor name populated

**Route guards:** `requireAuth` + `requireRole("admin", "head")`
- Heads are scoped to their department for: employees, attendance, leaves, tasks, department stats
- Admins see organization-wide data

## Frontend

### Types
**File:** `frontend/app/types.ts`

Add `DashboardAnalytics` interface matching the backend response shape.

### Hook
**File:** `frontend/app/hooks/use-dashboard.ts`

`useDashboardAnalytics()` — fetches `GET /api/dashboard/analytics`

### Dashboard Page
**File:** `frontend/app/routes/dashboard.tsx`

Layout:
1. **Header**: Welcome message with user name
2. **Stats Row** (4 cards): Total Employees, Active Tasks, Pending Leaves, Attendance Rate
3. **Charts Row** (2 columns):
   - Left: Task Status Distribution (PieChart)
   - Right: Attendance Overview (PieChart)
4. **Charts Row 2** (2 columns):
   - Left: Leave Statistics (BarChart — by type)
   - Right: Department Performance (BarChart — member count + attendance rate)
5. **Recent Activity** (table/list): Last 10 activities with icon, actor, action, target, timestamp

**Conventions:**
- Use existing shadcn components: Card, Badge, Skeleton, Table
- Use recharts: PieChart, BarChart, ResponsiveContainer (already used in reports page)
- Use lucide-react icons
- Loading state: Skeleton cards
- Empty state: Appropriate empty messages
- Responsive: grid layout adapts to screen size

## Files to create
1. `backend/src/controllers/dashboard.ts`
2. `backend/src/routes/dashboard.ts`
3. `frontend/app/hooks/use-dashboard.ts`

## Files to modify
1. `backend/src/server.ts` — mount dashboard route
2. `frontend/app/types.ts` — add DashboardAnalytics type
3. `frontend/app/routes/dashboard.tsx` — full rewrite with analytics

## Done when
- Backend returns aggregated dashboard data
- Dashboard shows 6 stat cards, 4 charts, and recent activity
- Loading skeletons display while data loads
- Heads see department-scoped data, admins see org-wide
- No typecheck errors in new/modified files
