# Attendance Tracking — Implementation Prompt

## Goal

Implement a full attendance tracking system where heads of departments and admins can mark attendance for team members (with check-in/check-out times and status), employees can view their own records, and admins can view attendance statistics and reports.

## Architecture

### Backend

#### 1. Attendance Model (`backend/src/models/Attendance.ts`)

Mongoose model:

```ts
interface IAttendance {
  user: ObjectId;          // Employee whose attendance is recorded
  date: Date;              // The attendance date (stored as UTC midnight)
  status: AttendanceStatus; // "present" | "absent" | "late" | "half_day" | "on_leave"
  checkIn?: Date | null;   // Check-in timestamp
  checkOut?: Date | null;  // Check-out timestamp
  markedBy: ObjectId;      // Head/admin who marked the attendance
  notes?: string;          // Optional notes (e.g. reason for late/absence)
}
```

- `AttendanceStatus` enum: `"present" | "absent" | "late" | "half_day" | "on_leave"`
- Unique compound index on `{ user: 1, date: 1 }` — one record per employee per day.
- Index on `{ date: -1 }` for date-range queries.
- Index on `{ user: 1, date: -1 }` for per-employee history.
- Timestamps enabled, `__v` stripped via `toJSON` transform (matching existing patterns).

#### 2. Attendance Routes (`backend/src/routes/attendance.ts`)

All routes require auth.

| Method | Path | Roles | Description |
|--------|------|-------|-------------|
| POST | `/api/attendance` | head, admin | Mark attendance for one or more employees for a specific date |
| GET | `/api/attendance/mine` | any | Current user's own attendance records (paginated, date range filter) |
| GET | `/api/attendance/department` | head, admin | Attendance records for the head's department (or any department for admin) on a given date or date range |
| GET | `/api/attendance/:id` | any | Single attendance record detail |
| PATCH | `/api/attendance/:id` | head, admin | Update an attendance record (status, times, notes) |
| GET | `/api/attendance/stats` | admin | Attendance statistics: summary counts, rates, trends |

#### 3. Attendance Controller (`backend/src/controllers/attendance.ts`)

**`markAttendance`** (POST):
- Body: `{ date: "YYYY-MM-DD", records: [{ userId: string, status: AttendanceStatus, checkIn?: string, checkOut?: string, notes?: string }] }`
- Validates the date is not in the future.
- Validates each userId is a valid ObjectId and belongs to the head's department (or any user for admin).
- Uses `bulkWrite` with `updateOne` + `upsert: true` to efficiently batch-set attendance for multiple employees on the same date.
- Logs activity for each record created/updated.
- Returns the created/updated records.

**`myAttendance`** (GET):
- Query params: `?from=YYYY-MM-DD&to=YYYY-MM-DD&limit=&offset=`
- Filters by `user = currentUser`.
- Defaults to current month if no date range provided.

**`departmentAttendance`** (GET):
- Query params: `?date=YYYY-MM-DD&from=YYYY-MM-DD&to=YYYY-MM-DD&limit=&offset=`
- For heads: automatically filters to their department's members.
- For admins: optional `?department=departmentId` filter, or all if omitted.
- Populates `user` with `name email`.
- When a single `date` is provided, returns all department members for that date (including those with no record, who are implicitly absent).

**`updateAttendance`** (PATCH):
- Body: `{ status?, checkIn?, checkOut?, notes? }`
- Validates the updater is a head of the employee's department or an admin.

**`attendanceStats`** (GET):
- Query params: `?from=YYYY-MM-DD&to=YYYY-MM-DD&department=departmentId`
- Returns:
  ```ts
  {
    totalDays: number;
    summary: { present: number; absent: number; late: number; half_day: number; on_leave: number };
    rate: number; // percentage of present+late+half_day / total working days
    byEmployee: Array<{ user: { _id, name, email }, present: number; absent: number; late: number; half_day: number; on_leave: number; rate: number }>;
    dailyTrend: Array<{ date: string; present: number; absent: number; late: number; total: number }>;
  }
  ```
- Defaults to current month if no date range.

#### 4. Activity Log Integration

Add new activity actions to `ACTIVITY_ACTIONS` in `backend/src/models/ActivityLog.ts`:
- `"attendance_marked"` — when attendance is created/updated for an employee
- `"attendance_bulk_marked"` — when attendance is marked for multiple employees at once

Add corresponding `ActivityAction` type in `frontend/app/types.ts`.

#### 5. Server Registration (`backend/src/server.ts`)

Mount `attendanceRouter` at `/api/attendance`.

### Frontend

#### 1. Types (`frontend/app/types.ts`)

Add attendance-related types:

```ts
export type AttendanceStatus = "present" | "absent" | "late" | "half_day" | "on_leave";

export interface Attendance {
  _id: string;
  user: Pick<User, "_id" | "name" | "email">;
  date: string; // "YYYY-MM-DD"
  status: AttendanceStatus;
  checkIn?: string | null;
  checkOut?: string | null;
  markedBy: Pick<User, "_id" | "name">;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AttendanceInput {
  date: string;
  records: Array<{
    userId: string;
    status: AttendanceStatus;
    checkIn?: string;
    checkOut?: string;
    notes?: string;
  }>;
}

export interface AttendanceStats {
  totalDays: number;
  summary: { present: number; absent: number; late: number; half_day: number; on_leave: number };
  rate: number;
  byEmployee: Array<{
    user: Pick<User, "_id" | "name" | "email">;
    present: number; absent: number; late: number; half_day: number; on_leave: number; rate: number;
  }>;
  dailyTrend: Array<{ date: string; present: number; absent: number; late: number; total: number }>;
}
```

Plus response wrappers: `AttendanceResponse`, `AttendanceListResponse`, `AttendanceStatsResponse`.

#### 2. Lib helpers (`frontend/app/lib/attendance.ts`)

Constants and helpers:
- `ATTENDANCE_STATUSES` array
- `ATTENDANCE_STATUS_LABELS` record (e.g. `{ present: "Present", absent: "Absent", ... }`)
- `ATTENDANCE_STATUS_META` record with badge variants (e.g. present → `default`/green, absent → `destructive`, late → `secondary`/yellow, half_day → `outline`, on_leave → `secondary`)
- Date helpers for formatting attendance dates

#### 3. Hooks (`frontend/app/hooks/use-attendance.ts`)

TanStack Query hooks:

- `useMyAttendance(params)`: Fetches current user's attendance records.
- `useDepartmentAttendance(params)`: Fetches attendance for head's department.
- `useMarkAttendance()`: Mutation to mark attendance for one or more employees.
- `useUpdateAttendance()`: Mutation to update an existing record.
- `useAttendanceStats(params)`: Fetches attendance statistics.
- Query keys sharing `["attendance"]` prefix.

#### 4. Head Attendance Page (`frontend/app/routes/attendance.tsx`)

**For heads and admins**: Mark attendance for their team members.

- Date picker at the top (defaults to today).
- When a date is selected, fetch department members and their existing attendance for that date.
- Display a table with columns: Employee name, Status (select), Check-in (time input), Check-out (time input), Notes (optional text).
- Pre-populate existing records. Show members with no record as "not marked" with a default status.
- "Save Attendance" button that batch-submits all records.
- Success/error feedback.

**For employees (read-only view)**: Show their own attendance history.

- Monthly calendar view or table showing their attendance records.
- Filter by date range.
- Status badges with color coding.

Route logic: If user role is `employee`, show their own records. If `head` or `admin`, show the mark-attendance interface.

#### 5. Admin Reports Page (`frontend/app/routes/admin/reports.tsx`)

Replace the placeholder with attendance statistics:

- Date range selector (from/to) defaulting to current month.
- Department filter dropdown (admin can pick any department or "All").
- Summary stat cards: Total days in range, Present count, Absent count, Late count, Attendance rate %.
- Table: Per-employee breakdown with name, present/absent/late/half_day/on_leave counts, and attendance rate %.
- Daily trend: A simple visual (table or bar representation) showing daily present/absent/late counts across the date range.

#### 6. Sidebar Navigation (`frontend/app/components/layout/app-sidebar.tsx`)

Add attendance links:

- **"My workspace"** group (employee, head): Add `{ title: "Attendance", to: "/attendance", icon: CalendarCheck }` using the `CalendarCheck` icon from lucide-react.
- **"Administration"** group (admin): Add `{ title: "Attendance", to: "/attendance", icon: CalendarCheck }` and the existing Reports page now shows attendance stats.

## Edge Cases

- **Duplicate marking**: The unique compound index on `{ user, date }` prevents duplicate records. The `bulkWrite` upsert handles this gracefully.
- **Future dates**: Attendance cannot be marked for future dates.
- **On-leave employees**: If an employee has an approved leave for a date, heads can mark them as `on_leave` or leave them unmarked (treated as absent in stats).
- **Department validation**: Heads can only mark attendance for users in their own department.
- **Timezone**: Dates are stored as UTC midnight. Check-in/out times are full timestamps.
- **Empty state**: When no attendance has been marked for a date, show all department members with "Not marked" status.

## Done Criteria

- [ ] Attendance model with compound unique index and proper toJSON transform
- [ ] Activity log actions updated with new attendance actions
- [ ] Attendance routes (mark, mine, department, detail, update, stats)
- [ ] Attendance controller with bulk marking and stats aggregation
- [ ] Server.ts updated with attendance router
- [ ] Frontend types added
- [ ] Frontend lib helpers (constants, status meta)
- [ ] TanStack Query hooks
- [ ] Head/Admin attendance page with date picker and bulk marking table
- [ ] Employee own attendance view
- [ ] Admin reports page with statistics, per-employee breakdown, and daily trend
- [ ] Sidebar navigation updated with attendance links
- [ ] All empty/loading/error states designed
- [ ] Typecheck passes
