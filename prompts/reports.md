# Reporting Feature — Implementation Prompt

## Goal

Implement a comprehensive admin reporting system that generates reports on employee performance, leave statistics, and department activities. Reports should be exportable as PDF and Excel for easy sharing and analysis.

The existing `frontend/app/routes/admin/reports.tsx` currently shows attendance stats only. We'll expand it into a multi-tab reports hub with three report types and export functionality.

## Context

- Backend: Express 5 + Bun + TS. Existing models: User, Department, Attendance, Leave, LeavePolicy, LeaveBalance, ActivityLog. Controllers already handle attendance stats, leave listing, and user listing. The attendance stats endpoint (`GET /api/attendance/stats`) returns rich aggregate data.
- Frontend: React Router framework mode + TanStack Query + Axios + recharts (already installed). Existing hooks: useAttendanceStats, useDepartments, useLeaves, useUsers. UI kit includes Card, Badge, Table, Tabs, Skeleton, Empty states, Select, Input, Button.
- `verbatimModuleSyntax` → `import type`. Local backend imports end with `.js` (Vercel deployment). Package manager: Bun.

## Architecture

### Backend — Report Data Endpoints

No new models needed. We create a new controller that aggregates data from existing models and returns JSON. The frontend handles PDF/Excel generation client-side.

#### 1. Report Controller (`backend/src/controllers/reports.ts`)

**`employeePerformance` (GET `/api/reports/employee-performance`)**:
- Query params: `?from=YYYY-MM-DD&to=YYYY-MM-DD&department=departmentId`
- Aggregates per-employee metrics:
  - Attendance: present/absent/late/half_day/on_leave counts + rate (reuse attendance logic)
  - Leaves: total requests by type (annual/sick/personal/unpaid), approval rate
  - Department name (if assigned)
- Returns:
  ```ts
  {
    period: { from: string; to: string };
    employees: Array<{
      user: { _id: string; name: string; email: string; department?: string | null };
      departmentName?: string;
      attendance: { present: number; absent: number; late: number; half_day: number; on_leave: number; rate: number };
      leaves: { annual: number; sick: number; personal: number; unpaid: number; total: number; approved: number; approvalRate: number };
    }>;
  }
  ```

**`leaveStatistics` (GET `/api/reports/leave-statistics`)**:
- Query params: `?from=YYYY-MM-DD&to=YYYY-MM-DD&department=departmentId`
- Aggregates leave data:
  - Total requests by type and status
  - Per-department breakdown
  - Monthly trend (requests per month in range)
  - Approval/rejection rates
- Returns:
  ```ts
  {
    period: { from: string; to: string };
    summary: { total: number; pending: number; approved: number; rejected: number; cancelled: number };
    byType: Array<{ type: string; count: number; approved: number; rejected: number }>;
    byDepartment: Array<{ department: string; total: number; approved: number; rejected: number }>;
    monthlyTrend: Array<{ month: string; total: number; approved: number; rejected: number }>;
  }
  ```

**`departmentActivities` (GET `/api/reports/department-activities`)**:
- Query params: `?from=YYYY-MM-DD&to=YYYY-MM-DD`
- Per-department summary:
  - Member count
  - Average attendance rate
  - Leave usage (total days)
  - Recent activity count (from ActivityLog)
- Returns:
  ```ts
  {
    period: { from: string; to: string };
    departments: Array<{
      _id: string;
      name: string;
      memberCount: number;
      avgAttendanceRate: number;
      leaveDaysUsed: number;
      recentActivities: number;
    }>;
  }
  ```

#### 2. Report Routes (`backend/src/routes/reports.ts`)

All routes require `requireAuth` + `requireRole("admin")`.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/reports/employee-performance` | Employee performance data |
| GET | `/api/reports/leave-statistics` | Leave statistics data |
| GET | `/api/reports/department-activities` | Department activity summary |

#### 3. Server Registration (`backend/src/server.ts`)

Mount `reportsRouter` at `/api/reports`.

### Frontend

#### 1. Types (`frontend/app/types.ts`)

Add report response types:

```ts
export interface EmployeePerformanceReport {
  period: { from: string; to: string };
  employees: Array<{
    user: Pick<User, "_id" | "name" | "email"> & { department?: string | null };
    departmentName?: string;
    attendance: { present: number; absent: number; late: number; half_day: number; on_leave: number; rate: number };
    leaves: { annual: number; sick: number; personal: number; unpaid: number; total: number; approved: number; approvalRate: number };
  }>;
}

export interface LeaveStatisticsReport {
  period: { from: string; to: string };
  summary: { total: number; pending: number; approved: number; rejected: number; cancelled: number };
  byType: Array<{ type: string; count: number; approved: number; rejected: number }>;
  byDepartment: Array<{ department: string; total: number; approved: number; rejected: number }>;
  monthlyTrend: Array<{ month: string; total: number; approved: number; rejected: number }>;
}

export interface DepartmentActivitiesReport {
  period: { from: string; to: string };
  departments: Array<{
    _id: string;
    name: string;
    memberCount: number;
    avgAttendanceRate: number;
    leaveDaysUsed: number;
    recentActivities: number;
  }>;
}
```

#### 2. Hooks (`frontend/app/hooks/use-reports.ts`)

TanStack Query hooks sharing `["reports"]` prefix:

- `useEmployeePerformanceReport(params)`: fetches employee performance data
- `useLeaveStatisticsReport(params)`: fetches leave statistics
- `useDepartmentActivitiesReport(params)`: fetches department activities

Each hook accepts `{ from, to, department? }` params.

#### 3. Report Export Utility (`frontend/app/lib/report-export.ts`)

Client-side export utilities:

**PDF Export** (using `jspdf` + `jspdf-autotable`):
- `exportToPDF(reportData, reportType, title)`: generates a styled PDF with tables, headers, and date range info
- Each report type gets its own layout (tables for performance, summary cards for leave stats, department comparison for activities)

**Excel Export** (using `xlsx`):
- `exportToExcel(reportData, reportType, title)`: generates an .xlsx file with properly formatted sheets
- Each report type gets a sheet with headers, data rows, and a summary row

#### 4. Dependencies

Install in `frontend/`:
- `jspdf` + `jspdf-autotable` — PDF generation with auto-table layouts
- `xlsx` — Excel file generation

#### 5. Reports Page (`frontend/app/routes/admin/reports.tsx`)

**Complete rewrite** — expand from attendance-only to multi-tab reports hub:

- **Tab layout**: "Employee Performance" | "Leave Statistics" | "Department Activities" (the existing attendance stats become a sub-section of employee performance)
- **Shared filter bar**: Date range (from/to) + department filter (admin only) at the top, applies to the active tab
- **Export buttons**: PDF and Excel buttons in the top-right of each tab, using the export utility

**Employee Performance Tab**:
- Summary cards: total employees, average attendance rate, total leaves taken
- Table: Employee name, department, attendance rate, leaves by type, overall score badge
- Recharts bar chart: attendance rate distribution across employees
- Empty/loading/error states

**Leave Statistics Tab**:
- Summary cards: total requests, approval rate, pending count
- Table: leave requests by type with approval/rejection counts
- Recharts pie chart: leave type distribution
- Department comparison table
- Monthly trend line chart
- Empty/loading/error states

**Department Activities Tab**:
- Table: department name, member count, avg attendance, leave days used, activity count
- Recharts bar chart: department comparison
- Empty/loading/error states

#### 6. Export Flow

1. User clicks PDF or Excel button
2. Current tab's data is already loaded in TanStack Query cache
3. Export function receives the cached data
4. `exportToPDF()` or `exportToExcel()` generates the file
5. Browser's download dialog triggers automatically (using `URL.createObjectURL` + dynamic `<a>` click)

## Edge Cases

- **No data in range**: Empty state with clear message and suggestion to adjust date range.
- **No departments**: All-employees view when no department filter is applied.
- **Export with no data**: Disable export buttons when there's no data; show a toast if somehow triggered.
- **Large datasets**: PDF tables paginate automatically via jspdf-autotable; Excel handles large datasets natively.
- **Date validation**: Same as existing attendance page — from ≤ to, valid dates.
- **Loading states**: Show skeleton while report data loads; disable export buttons during load.

## Affected Files

- **Backend (new)**: `backend/src/controllers/reports.ts`, `backend/src/routes/reports.ts`
- **Backend (modified)**: `backend/src/server.ts` (mount reports router)
- **Frontend (new)**: `frontend/app/hooks/use-reports.ts`, `frontend/app/lib/report-export.ts`
- **Frontend (modified)**: `frontend/app/types.ts`, `frontend/app/routes/admin/reports.tsx`

## Done Criteria

- [ ] Backend report endpoints return correct aggregated data
- [ ] Report routes mounted and protected with admin role
- [ ] Frontend hooks fetch report data with date/department filters
- [ ] Reports page shows three tabs with charts, tables, and summary cards
- [ ] PDF export generates styled, readable documents
- [ ] Excel export generates properly formatted spreadsheets
- [ ] All empty/loading/error states designed
- [ ] `bun run typecheck` passes in both `backend/` and `frontend/`
- [ ] `bun run build` passes in `frontend/`
