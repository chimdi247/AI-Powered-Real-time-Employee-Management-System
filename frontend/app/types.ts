/**
 * Shared frontend types mirroring the backend DTOs (see backend/src).
 * The backend strips `password` and `__v` via its Mongoose toJSON transform.
 */

export type Role = "admin" | "employee" | "head";

/** Mirrors the backend User model as returned by the API (Mongoose toJSON). */
export interface User {
  _id: string;
  name: string;
  email: string;
  role: Role;
  /** Department id when assigned (single department per employee). */
  department?: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Mirrors the backend Department model as returned by the API (Mongoose toJSON). */
export interface Department {
  _id: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  /** Present on the admin list response. */
  memberCount?: number;
  /** Present on the detail response. */
  members?: DepartmentMember[];
}

/** Minimal user shape returned inside a department's member list. */
export interface DepartmentMember {
  _id: string;
  name: string;
  email: string;
  role: Role;
}

/** POST/PATCH /api/departments body. */
export interface DepartmentInput {
  name: string;
  description?: string;
}

/** PUT /api/departments/:id/employees body. */
export interface SetDepartmentEmployeesInput {
  userIds: string[];
}

/** Successful department responses are wrapped as `{ department }`. */
export interface DepartmentResponse {
  department: Department;
}

export interface DepartmentListResponse {
  departments: Department[];
  /** Total rows matching the filter (before pagination). */
  total: number;
  /** Applied page size — null when the endpoint returned all rows (no limit sent). */
  limit: number | null;
  offset: number;
}

export interface MyDepartmentResponse {
  department: Department | null;
}

export interface UsersListResponse {
  users: User[];
  /** Total rows matching the filter (before pagination). */
  total: number;
  /** Applied page size — null when the endpoint returned all rows (no limit sent). */
  limit: number | null;
  offset: number;
}

/** POST /api/auth/login body. */
export interface LoginInput {
  email: string;
  password: string;
}

/** POST /api/users body (admin-only endpoint). */
export interface CreateUserInput {
  name: string;
  email: string;
  password: string;
  role?: Role;
  department?: string | null;
}

/** PATCH /api/users/:id body (admin-only endpoint). */
export interface UpdateUserInput {
  name?: string;
  email?: string;
  role?: Role;
  /** Department id, or null to unassign. */
  department?: string | null;
  /** Optional password reset — omitted/empty keeps the current password. */
  password?: string;
}

/** PATCH /api/users/me body — employees may only change name + password. */
export interface UpdateProfileInput {
  name?: string;
  currentPassword?: string;
  password?: string;
}

/** Successful auth/user responses are wrapped as `{ user }`. */
export interface UserResponse {
  user: User;
}

/** Every action the activity log records — mirrors the backend `ACTIVITY_ACTIONS` enum. */
export type ActivityAction =
  | "login"
  | "login_failed"
  | "logout"
  | "user_created"
  | "user_updated"
  | "user_deleted"
  | "profile_updated"
  | "department_created"
  | "department_updated"
  | "department_deleted"
  | "department_members_updated"
  | "leave_created"
  | "leave_cancelled"
  | "leave_approved"
  | "leave_rejected"
  | "leave_balance_adjusted"
  | "leave_policy_updated"
  | "announcement_created"
  | "announcement_updated"
  | "announcement_deleted"
  | "feedback_created"
  | "feedback_responded"
  | "feedback_resolved"
  | "feedback_reopened"
  | "attendance_marked"
  | "attendance_bulk_marked"
  | "review_created"
  | "review_generated"
  | "review_acknowledged"
  | "review_completed"
  | "review_deleted"
  | "goal_updated"
  | "task_created"
  | "task_status_updated"
  | "task_submitted"
  | "task_reviewed"
  | "ai_insight_deleted";

/** Mirrors the backend ActivityLog model as returned by the API (Mongoose toJSON). */
export interface ActivityLog {
  _id: string;
  action: ActivityAction;
  /** Actor user id — null for failed logins (no matching user). */
  actor?: string | null;
  /** Snapshots so entries stay readable even after the actor/target is deleted. */
  actorName?: string;
  actorEmail?: string;
  actorRole?: Role;
  targetType?: string;
  targetId?: string;
  targetName?: string;
  details?: Record<string, unknown>;
  ip?: string;
  createdAt: string;
}

/** GET /api/activity-logs response. */
export interface ActivityLogListResponse {
  logs: ActivityLog[];
  /** Total rows matching the filter (before pagination). */
  total: number;
  /** Applied page size — null when the endpoint returned all rows (no limit sent). */
  limit: number | null;
  offset: number;
}

/* ------------------------------------------------------------------ */
/* Leaves                                                              */
/* ------------------------------------------------------------------ */

/** Fixed leave types — mirrors the backend `LeaveType` enum. */
export type LeaveType = "annual" | "sick" | "personal" | "unpaid";

/** Mirrors the backend `LeaveStatus` enum. */
export type LeaveStatus = "pending" | "approved" | "rejected" | "cancelled";

/** Status filter used by the admin requests list ("all" = no filter). */
export type LeaveStatusFilter = LeaveStatus | "all";

/** Per-employee annual leave balance for the tracked types (unpaid is not tracked). */
export interface LeaveBalance {
  /** The calendar year this balance applies to. */
  year: number;
  annual: number;
  sick: number;
  personal: number;
}

/** Mirrors the backend Leave model as returned by the API (user populated). */
export interface Leave {
  _id: string;
  user: Pick<User, "_id" | "name" | "email">;
  leaveType: LeaveType;
  /** Date-only strings (YYYY-MM-DD). */
  startDate: string;
  endDate: string;
  /** Inclusive calendar days between start and end. */
  days: number;
  reason: string;
  status: LeaveStatus;
  decidedBy?: string | null;
  decisionNote?: string;
  decidedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

/** POST /api/leaves body. */
export interface LeaveInput {
  leaveType: LeaveType;
  startDate: string;
  endDate: string;
  reason: string;
}

/** Admin-tunable per-type limits. */
export interface LeavePolicy {
  _id: string;
  leaveType: LeaveType;
  maxDaysPerRequest: number;
  maxDaysPerYear: number;
}

/** Successful leave responses are wrapped as `{ leave }`. */
export interface LeaveResponse {
  leave: Leave;
}

export interface LeaveListResponse {
  leaves: Leave[];
  /** Total rows matching the filter (before pagination). */
  total: number;
  /** Applied page size — null when the endpoint returned all rows (no limit sent). */
  limit: number | null;
  offset: number;
}

export interface LeaveBalanceResponse {
  balance: LeaveBalance;
}

/** GET /api/leaves/balances response (admin). */
export interface LeaveBalancesResponse {
  balances: { user: Pick<User, "_id" | "name" | "email">; balance: LeaveBalance }[];
  /** Total rows matching the filter (before pagination). */
  total: number;
  /** Applied page size — null when the endpoint returned all rows (no limit sent). */
  limit: number | null;
  offset: number;
}

export interface LeavePolicyResponse {
  policy: LeavePolicy;
}

export interface LeavePolicyListResponse {
  policies: LeavePolicy[];
}

/* ------------------------------------------------------------------ */
/* Announcements                                                       */
/* ------------------------------------------------------------------ */

/** Mirrors the backend Announcement model as returned by the API (author + department populated). */
export interface Announcement {
  _id: string;
  title: string;
  body: string;
  department: Pick<Department, "_id" | "name">;
  author: Pick<User, "_id" | "name">;
  createdAt: string;
  updatedAt: string;
}

/** POST /api/announcements and PATCH /api/announcements/:id body. */
export interface AnnouncementInput {
  title: string;
  body: string;
  /** Admin-only: the department to post to (heads post to their own). */
  department?: string;
}

/** Successful announcement responses are wrapped as `{ announcement }`. */
export interface AnnouncementResponse {
  announcement: Announcement;
}

export interface AnnouncementListResponse {
  announcements: Announcement[];
  /** Total rows matching the filter (before pagination). */
  total: number;
  /** Applied page size — null when the endpoint returned all rows (no limit sent). */
  limit: number | null;
  offset: number;
}

/* ------------------------------------------------------------------ */
/* Feedback                                                            */
/* ------------------------------------------------------------------ */

/** Fixed feedback categories — mirrors the backend `FeedbackCategory` enum. */
export type FeedbackCategory = "suggestion" | "complaint" | "praise" | "other";

/** Mirrors the backend `FeedbackStatus` enum. */
export type FeedbackStatus = "open" | "resolved";

/** Status filter used by feedback lists ("all" = no filter). */
export type FeedbackStatusFilter = FeedbackStatus | "all";

/** Mirrors the backend Feedback model as returned by the API. */
export interface Feedback {
  _id: string;
  /** Submitter — null for anonymous submissions on admin views (the owner always sees themselves). */
  author: Pick<User, "_id" | "name" | "email"> | null;
  isAnonymous: boolean;
  category: FeedbackCategory;
  message: string;
  status: FeedbackStatus;
  /** The latest admin response, if any. */
  response?: {
    body: string;
    respondedBy: Pick<User, "_id" | "name"> | null;
    respondedAt: string;
  } | null;
  createdAt: string;
  updatedAt: string;
}

/** POST /api/feedback body. */
export interface FeedbackInput {
  message: string;
  category: FeedbackCategory;
  /** When true, admins see the submission as "Anonymous". */
  isAnonymous?: boolean;
}

/** PATCH /api/feedback/:id body (admin-only). */
export interface FeedbackUpdateInput {
  response?: string;
  status?: FeedbackStatus;
}

/** Successful feedback responses are wrapped as `{ feedback }`. */
export interface FeedbackResponse {
  feedback: Feedback;
}

export interface FeedbackListResponse {
  feedback: Feedback[];
  /** Total rows matching the filter (before pagination). */
  total: number;
  /** Applied page size — null when the endpoint returned all rows (no limit sent). */
  limit: number | null;
  offset: number;
}

/* ------------------------------------------------------------------ */
/* Notifications                                                       */
/* ------------------------------------------------------------------ */

/** Fixed notification types — mirrors the backend `NOTIFICATION_TYPES` enum. */
export type NotificationType =
  | "leave_approved"
  | "leave_rejected"
  | "feedback_responded"
  | "announcement_created"
  | "review_assigned"
  | "review_acknowledged"
  | "task_assigned"
  | "task_completed"
  | "task_approved"
  | "task_rejected";

/** Mirrors the backend Notification model as returned by the API. */
export interface Notification {
  _id: string;
  /** User who receives the notification. */
  recipient: string;
  /** User who triggered the event — null for system notifications. */
  actor?: Pick<User, "_id" | "name"> | null;
  type: NotificationType;
  title: string;
  message: string;
  read: boolean;
  /** Optional frontend route to navigate to on click. */
  link?: string;
  createdAt: string;
  updatedAt: string;
}

/** GET /api/notifications response. */
export interface NotificationListResponse {
  notifications: Notification[];
  total: number;
  limit: number | null;
  offset: number;
}

/** GET /api/notifications/unread-count response. */
export interface UnreadCountResponse {
  count: number;
}

/** PATCH /api/notifications/:id/read response. */
export interface NotificationReadResponse {
  notification: Notification;
}

/* ------------------------------------------------------------------ */
/* Attendance                                                          */
/* ------------------------------------------------------------------ */

/** Fixed attendance statuses — mirrors the backend `ATTENDANCE_STATUSES` enum. */
export type AttendanceStatus = "present" | "absent" | "late" | "half_day" | "on_leave";

/** Mirrors the backend Attendance model as returned by the API (user + markedBy populated). */
export interface Attendance {
  _id: string;
  user: Pick<User, "_id" | "name" | "email">;
  /** Date string (YYYY-MM-DD). */
  date: string;
  status: AttendanceStatus;
  /** ISO datetime string or null. */
  checkIn?: string | null;
  /** ISO datetime string or null. */
  checkOut?: string | null;
  markedBy: Pick<User, "_id" | "name">;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

/** POST /api/attendance body — mark attendance for one or more employees. */
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

/** PATCH /api/attendance/:id body. */
export interface AttendanceUpdateInput {
  status?: AttendanceStatus;
  checkIn?: string | null;
  checkOut?: string | null;
  notes?: string;
}

/** Successful attendance responses. */
export interface AttendanceResponse {
  attendance: Attendance;
}

export interface AttendanceMarkResponse {
  attendance: Attendance[];
  count: number;
}

export interface AttendanceListResponse {
  attendance: Attendance[];
  /** For department view: list of department members. */
  members?: Array<Pick<User, "_id" | "name" | "email">>;
  total: number;
  limit: number | null;
  offset: number;
}

/** GET /api/attendance/stats response. */
export interface AttendanceStats {
  totalDays: number;
  summary: {
    present: number;
    absent: number;
    late: number;
    half_day: number;
    on_leave: number;
  };
  /** Attendance rate as a percentage (0–100). */
  rate: number;
  byEmployee: Array<{
    user: Pick<User, "_id" | "name" | "email">;
    present: number;
    absent: number;
    late: number;
    half_day: number;
    on_leave: number;
    rate: number;
  }>;
  dailyTrend: Array<{
    date: string;
    present: number;
    absent: number;
    late: number;
    total: number;
  }>;
}

export interface AttendanceStatsResponse {
  stats: AttendanceStats;
}

/* ------------------------------------------------------------------ */
/* Reports                                                             */
/* ------------------------------------------------------------------ */

export interface EmployeePerformanceReport {
  period: { from: string; to: string };
  employees: Array<{
    user: Pick<User, "_id" | "name" | "email"> & { department?: string | null };
    departmentName?: string;
    attendance: {
      present: number;
      absent: number;
      late: number;
      half_day: number;
      on_leave: number;
      rate: number;
    };
    leaves: {
      annual: number;
      sick: number;
      personal: number;
      unpaid: number;
      total: number;
      approved: number;
      approvalRate: number;
    };
  }>;
}

export interface LeaveStatisticsReport {
  period: { from: string; to: string };
  summary: {
    total: number;
    pending: number;
    approved: number;
    rejected: number;
    cancelled: number;
  };
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

/* ------------------------------------------------------------------ */
/* Performance Reviews                                                 */
/* ------------------------------------------------------------------ */

/** Fixed review statuses — mirrors the backend `REVIEW_STATUSES` enum. */
export type ReviewStatus =
  | "draft"
  | "pending_acknowledgment"
  | "acknowledged"
  | "completed";

/** Status filter used by review lists. */
export type ReviewStatusFilter = ReviewStatus | "all";

/** Fixed goal statuses — mirrors the backend `GOAL_STATUSES` enum. */
export type GoalStatus = "not_started" | "in_progress" | "completed";

/** A single category rating within a review. */
export interface ReviewRating {
  category: string;
  score: number;
  comment?: string;
}

/** A single improvement goal within a review. */
export interface ReviewGoal {
  title: string;
  description?: string;
  status: GoalStatus;
  dueDate?: string;
  completedAt?: string;
}

/** Mirrors the backend PerformanceReview model as returned by the API. */
export interface PerformanceReview {
  _id: string;
  employee: Pick<User, "_id" | "name" | "email"> & {
    department?: Pick<Department, "_id" | "name"> | null;
  };
  reviewer: Pick<User, "_id" | "name" | "email">;
  period: string;
  status: ReviewStatus;
  ratings: ReviewRating[];
  overallScore?: number;
  strengths?: string;
  improvements?: string;
  summary?: string;
  goals: ReviewGoal[];
  employeeComments?: string;
  acknowledgedAt?: string;
  aiGenerated: boolean;
  createdAt: string;
  updatedAt: string;
}

/** POST /api/performance-reviews body. */
export interface CreateReviewInput {
  employeeId: string;
  period: string;
  ratings?: Array<{ category: string; score: number; comment?: string }>;
  goals?: Array<{
    title: string;
    description?: string;
    status?: GoalStatus;
    dueDate?: string;
  }>;
}

/** PATCH /api/performance-reviews/:id body. */
export interface UpdateReviewInput {
  ratings?: Array<{ category: string; score: number; comment?: string }>;
  goals?: Array<{
    title: string;
    description?: string;
    status?: GoalStatus;
    dueDate?: string;
    completedAt?: string;
  }>;
  status?: ReviewStatus;
  strengths?: string;
  improvements?: string;
  summary?: string;
}

/** POST /api/performance-reviews/:id/acknowledge body. */
export interface AcknowledgeReviewInput {
  comments?: string;
}

/** PATCH /api/performance-reviews/:id/goals/:goalIndex body. */
export interface UpdateGoalInput {
  status?: GoalStatus;
  description?: string;
}

/** Successful review responses are wrapped as `{ review }`. */
export interface ReviewResponse {
  review: PerformanceReview;
}

export interface ReviewListResponse {
  reviews: PerformanceReview[];
  total: number;
  limit: number | null;
  offset: number;
}

/* ------------------------------------------------------------------ */
/* Tasks                                                               */
/* ------------------------------------------------------------------ */

/** Fixed task statuses — mirrors the backend `TASK_STATUSES` enum. */
export type TaskStatus = "todo" | "in_progress" | "in_review" | "completed" | "rejected";

/** Status filter used by task lists. */
export type TaskStatusFilter = TaskStatus | "all";

/** Fixed task priorities — mirrors the backend `TASK_PRIORITIES` enum. */
export type TaskPriority = "low" | "medium" | "high" | "urgent";

/** Mirrors the backend Task model as returned by the API (populated refs). */
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

/** POST /api/tasks body. */
export interface TaskInput {
  title: string;
  description?: string;
  assignedTo: string;
  priority?: TaskPriority;
  dueDate?: string;
}

/** PATCH /api/tasks/:id body. */
export interface TaskUpdateInput {
  title?: string;
  description?: string;
  assignedTo?: string;
  priority?: TaskPriority;
  dueDate?: string;
}

/** POST /api/tasks/:id/submit body. */
export interface TaskSubmitInput {
  submissionNotes?: string;
}

/** POST /api/tasks/:id/review body. */
export interface TaskReviewInput {
  decision: "approved" | "rejected";
  reviewNotes?: string;
}

/** Successful task responses are wrapped as `{ task }`. */
export interface TaskResponse {
  task: Task;
}

export interface TaskListResponse {
  tasks: Task[];
  total: number;
  limit: number | null;
  offset: number;
}

/* ------------------------------------------------------------------ */
/* AI Insights                                                          */
/* ------------------------------------------------------------------ */

/** Mirrors the backend AiInsight model as returned by the API. */
export interface AiInsight {
  _id: string;
  createdBy: Pick<User, "_id" | "name">;
  scope: "organization" | "department";
  department?: Pick<Department, "_id" | "name"> | null;
  status: "pending" | "generating" | "completed" | "failed";
  title?: string;
  content?: string;
  summary?: string;
  period: string;
  error?: string;
  createdAt: string;
  updatedAt: string;
}

/** POST /api/ai-insights/generate body. */
export interface GenerateInsightInput {
  period: string;
}

/** Successful insight responses are wrapped as `{ insight }`. */
export interface AiInsightResponse {
  insight: AiInsight;
}

export interface AiInsightListResponse {
  insights: AiInsight[];
  total: number;
  limit: number | null;
  offset: number;
}

/* ------------------------------------------------------------------ */
/* SSE — Real-time events                                              */
/* ------------------------------------------------------------------ */

/** All event types that can be pushed via SSE. */
export type SSEEventType =
  | "notification"
  | "task-updated"
  | "leave-updated"
  | "attendance-updated"
  | "announcement-new"
  | "review-updated"
  | "insight-ready"
  | "review-ready";

/** The shape of every SSE event pushed to clients. */
export interface SSEEvent {
  type: SSEEventType;
  data: unknown;
  timestamp: number;
}

/* ------------------------------------------------------------------ */
/* Dashboard Analytics                                                 */
/* ------------------------------------------------------------------ */

/** Employee dashboard — personal stats for the logged-in user. */
export interface EmployeeDashboardAnalytics {
  scope: "employee";
  attendance: {
    overview: {
      present: number;
      absent: number;
      late: number;
      half_day: number;
      on_leave: number;
    };
    rate: number;
    workingDays: number;
  };
  leaveBalance: Record<
    string,
    { used: number; remaining: number; total: number }
  >;
  tasks: {
    active: Array<{
      _id: string;
      title: string;
      status: string;
      priority: string;
      dueDate?: string | null;
    }>;
    completedCount: number;
  };
  recentActivity: Array<{
    action: string;
    targetName: string;
    createdAt: string;
  }>;
}

export interface DashboardAnalytics {
  scope: "admin";
  summary: {
    totalEmployees: number;
    totalDepartments: number;
    activeTasks: number;
    pendingLeaves: number;
    attendanceRate: number;
    completedTasks: number;
  };
  attendanceOverview: {
    present: number;
    absent: number;
    late: number;
    half_day: number;
    on_leave: number;
  };
  leaveStats: {
    pending: number;
    approved: number;
    rejected: number;
    byType: Array<{ type: string; count: number }>;
  };
  taskStats: {
    todo: number;
    in_progress: number;
    in_review: number;
    completed: number;
    rejected: number;
  };
  departmentStats: Array<{
    name: string;
    memberCount: number;
    attendanceRate: number;
  }>;
  recentActivity: Array<{
    action: string;
    actorName: string;
    targetName: string;
    createdAt: string;
    details?: Record<string, unknown>;
  }>;
}
