import type { Request, Response } from "express";
import mongoose from "mongoose";
import { ActivityLog } from "../models/ActivityLog.js";
import { Attendance } from "../models/Attendance.js";
import { Department } from "../models/Department.js";
import { Leave } from "../models/Leave.js";
import { LEAVE_TYPES } from "../models/LeaveType.js";
import { LeavePolicy } from "../models/LeavePolicy.js";
import { PerformanceReview } from "../models/PerformanceReview.js";
import { Task } from "../models/Task.js";
import { User } from "../models/User.js";

// ---------------------------------------------------------------------------

/** Returns the first day of the current month as UTC midnight. */
function startOfCurrentMonth(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1));
}

/** Returns the last day of the current month as UTC midnight. */
function endOfCurrentMonth(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getFullYear(), now.getMonth() + 1, 0));
}

/** Calculates working days (excludes weekends) in a date range. */
function workingDaysBetween(from: Date, toExclusive: Date): number {
  const msPerDay = 86_400_000;
  const totalDays = Math.floor((toExclusive.getTime() - from.getTime()) / msPerDay);
  let count = 0;
  for (let i = 0; i < totalDays; i++) {
    const day = new Date(from.getTime() + i * msPerDay);
    const dow = day.getUTCDay();
    if (dow !== 0 && dow !== 6) count++;
  }
  return count;
}

// ---------------------------------------------------------------------------

/**
 * Dashboard analytics endpoint — returns aggregated metrics for the dashboard.
 * Admins see org-wide data; heads are scoped to their department.
 */
export async function getDashboardAnalytics(req: Request, res: Response): Promise<void> {
  const user = req.user!;
  const isAdmin = user.role === "admin";

  const from = startOfCurrentMonth();
  const to = endOfCurrentMonth();
  const toExclusive = new Date(to.getTime() + 86_400_000);

  // Department filter for heads.
  const departmentFilter: Record<string, unknown> = {};
  if (!isAdmin && user.department) {
    departmentFilter.department = user.department;
  }

  // Employee filter (exclude admins).
  const employeeFilter: Record<string, unknown> = { role: { $ne: "admin" } };
  if (!isAdmin && user.department) {
    employeeFilter.department = user.department;
  }

  // ---------------------------------------------------------------
  // 1. Summary counts
  // ---------------------------------------------------------------
  const [totalEmployees, totalDepartments, activeTasks, pendingLeaves, completedTasks] =
    await Promise.all([
      User.countDocuments(employeeFilter),
      isAdmin ? Department.countDocuments() : Department.countDocuments({ _id: user.department }),
      Task.countDocuments({
        ...departmentFilter,
        status: { $nin: ["completed", "rejected"] },
      }),
      Leave.countDocuments({
        ...departmentFilter,
        status: "pending",
      }),
      Task.countDocuments({
        ...departmentFilter,
        status: "completed",
      }),
    ]);

  // ---------------------------------------------------------------
  // 2. Attendance overview (current month)
  // ---------------------------------------------------------------
  const employees = await User.find(employeeFilter).select("_id");
  const employeeIds = employees.map((e) => e._id);

  const attendanceOverview = { present: 0, absent: 0, late: 0, half_day: 0, on_leave: 0 };
  let attendanceRate = 0;

  if (employeeIds.length > 0) {
    const attendanceRecords = await Attendance.find({
      user: { $in: employeeIds },
      date: { $gte: from, $lt: toExclusive },
    }).select("user status");

    for (const record of attendanceRecords) {
      attendanceOverview[record.status as keyof typeof attendanceOverview]++;
    }

    const workingDays = workingDaysBetween(from, toExclusive);
    const attendedCount =
      attendanceOverview.present + attendanceOverview.late + attendanceOverview.half_day;
    attendanceRate =
      workingDays > 0 && employeeIds.length > 0
        ? Math.round((attendedCount / (workingDays * employeeIds.length)) * 10000) / 100
        : 0;
  }

  // ---------------------------------------------------------------
  // 3. Leave stats (current month)
  // ---------------------------------------------------------------
  const leaveStats = { pending: 0, approved: 0, rejected: 0, byType: [] as { type: string; count: number }[] };

  if (employeeIds.length > 0) {
    const leaveRecords = await Leave.find({
      user: { $in: employeeIds },
      createdAt: { $gte: from, $lt: toExclusive },
    }).select("leaveType status");

    for (const leave of leaveRecords) {
      if (leave.status === "pending") leaveStats.pending++;
      else if (leave.status === "approved") leaveStats.approved++;
      else if (leave.status === "rejected") leaveStats.rejected++;
    }

    // By type
    const typeMap = new Map<string, number>();
    for (const leave of leaveRecords) {
      typeMap.set(leave.leaveType, (typeMap.get(leave.leaveType) ?? 0) + 1);
    }
    leaveStats.byType = Array.from(typeMap.entries()).map(([type, count]) => ({ type, count }));
  }

  // ---------------------------------------------------------------
  // 4. Task stats (current month)
  // ---------------------------------------------------------------
  const taskStats = { todo: 0, in_progress: 0, in_review: 0, completed: 0, rejected: 0 };

  if (employeeIds.length > 0) {
    const taskRecords = await Task.find({
      ...departmentFilter,
      createdAt: { $gte: from, $lt: toExclusive },
    }).select("status");

    for (const task of taskRecords) {
      taskStats[task.status as keyof typeof taskStats]++;
    }
  }

  // ---------------------------------------------------------------
  // 5. Department stats
  // ---------------------------------------------------------------
  const departments = isAdmin
    ? await Department.find().sort({ name: 1 })
    : user.department
      ? await Department.find({ _id: user.department })
      : [];

  const departmentStats: {
    name: string;
    memberCount: number;
    attendanceRate: number;
  }[] = [];

  if (departments.length > 0) {
    const deptIds = departments.map((d) => d._id);
    const deptEmployees = await User.find({
      department: { $in: deptIds },
      role: { $ne: "admin" },
    }).select("name department");

    const membersByDept = new Map<string, mongoose.Types.ObjectId[]>();
    for (const emp of deptEmployees) {
      const deptId = emp.department!.toString();
      const list = membersByDept.get(deptId) ?? [];
      list.push(emp._id);
      membersByDept.set(deptId, list);
    }

    const allDeptEmployeeIds = deptEmployees.map((e) => e._id);
    const deptAttendance = allDeptEmployeeIds.length > 0
      ? await Attendance.find({
          user: { $in: allDeptEmployeeIds },
          date: { $gte: from, $lt: toExclusive },
        }).select("user status")
      : [];

    const workingDays = workingDaysBetween(from, toExclusive);

    for (const dept of departments) {
      const deptId = dept._id.toString();
      const memberIds = membersByDept.get(deptId) ?? [];
      const memberIdSet = new Set(memberIds.map((id) => id.toString()));

      let present = 0;
      let late = 0;
      let halfDay = 0;
      for (const record of deptAttendance) {
        if (memberIdSet.has(record.user.toString())) {
          if (record.status === "present") present++;
          else if (record.status === "late") late++;
          else if (record.status === "half_day") halfDay++;
        }
      }

      const attendedCount = present + late + halfDay;
      const deptAttendanceRate =
        workingDays > 0 && memberIds.length > 0
          ? Math.round((attendedCount / (workingDays * memberIds.length)) * 10000) / 100
          : 0;

      departmentStats.push({
        name: dept.name,
        memberCount: memberIds.length,
        attendanceRate: deptAttendanceRate,
      });
    }
  }

  // ---------------------------------------------------------------
  // 6. Recent activity (last 10)
  // ---------------------------------------------------------------
  const recentActivityRaw = await ActivityLog.find()
    .sort({ createdAt: -1 })
    .limit(10)
    .select("action actorName targetName details")
    .lean();

  const recentActivity = recentActivityRaw.map((log) => ({
    action: log.action,
    actorName: log.actorName ?? "System",
    targetName: log.targetName ?? "",
    createdAt: (log as unknown as Record<string, unknown>)["createdAt"] as string,
    details: log.details as Record<string, unknown> | undefined,
  }));

  // ---------------------------------------------------------------
  // Response
  // ---------------------------------------------------------------
  res.json({
    scope: "admin",

    summary: {
      totalEmployees,
      totalDepartments,
      activeTasks,
      pendingLeaves,
      attendanceRate,
      completedTasks,
    },
    attendanceOverview,
    leaveStats,
    taskStats,
    departmentStats,
    recentActivity,
  });
}

// ---------------------------------------------------------------------------
// Employee dashboard
// ---------------------------------------------------------------------------

/**
 * Employee dashboard — returns the logged-in user's personal stats:
 * attendance, leave balance, tasks, and recent activity.
 */
export async function getEmployeeDashboard(req: Request, res: Response): Promise<void> {
  const userId = req.user!._id;

  const now = new Date();
  const from = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1));
  const to = new Date(Date.UTC(now.getFullYear(), now.getMonth() + 1, 0));
  const toExclusive = new Date(to.getTime() + 86_400_000);

  // Year start for leave balance calculation.
  const yearStart = new Date(Date.UTC(now.getFullYear(), 0, 1));

  // ---------------------------------------------------------------
  // 1. Attendance this month
  // ---------------------------------------------------------------
  const attendanceRecords = await Attendance.find({
    user: userId,
    date: { $gte: from, $lt: toExclusive },
  }).select("status date");

  const attendanceOverview = { present: 0, absent: 0, late: 0, half_day: 0, on_leave: 0 };
  for (const record of attendanceRecords) {
    attendanceOverview[record.status as keyof typeof attendanceOverview]++;
  }

  const workingDays = workingDaysBetween(from, toExclusive);
  const attended = attendanceOverview.present + attendanceOverview.late + attendanceOverview.half_day;
  const attendanceRate =
    workingDays > 0
      ? Math.round((attended / workingDays) * 10000) / 100
      : 0;

  // ---------------------------------------------------------------
  // 2. Leave balance
  // ---------------------------------------------------------------
  const policies = await LeavePolicy.find();
  const policyMap = new Map(policies.map((p) => [p.leaveType, p]));

  const usedLeaves = await Leave.find({
    user: userId,
    status: { $in: ["approved", "pending"] },
    startDate: { $gte: yearStart },
  }).select("leaveType days status");

  const leaveBalance: Record<string, { used: number; remaining: number; total: number }> = {};
  for (const type of LEAVE_TYPES) {
    const policy = policyMap.get(type);
    const total = policy?.maxDaysPerYear ?? 0;
    const used = usedLeaves
      .filter((l) => l.leaveType === type)
      .reduce((sum, l) => sum + l.days, 0);
    leaveBalance[type] = { used, remaining: Math.max(0, total - used), total };
  }

  // ---------------------------------------------------------------
  // 3. Tasks
  // ---------------------------------------------------------------
  const [activeTasks, completedTasks] = await Promise.all([
    Task.find({ assignedTo: userId, status: { $nin: ["completed", "rejected"] } })
      .select("title status priority dueDate")
      .sort({ dueDate: 1 })
      .limit(5),
    Task.countDocuments({ assignedTo: userId, status: "completed" }),
  ]);

  // ---------------------------------------------------------------
  // 4. Recent activity (user's own)
  // ---------------------------------------------------------------
  const recentActivityRaw = await ActivityLog.find({ actor: userId })
    .sort({ createdAt: -1 })
    .limit(5)
    .select("action targetName createdAt")
    .lean();

  const recentActivity = recentActivityRaw.map((log) => ({
    action: log.action,
    targetName: log.targetName ?? "",
    createdAt: (log as unknown as Record<string, unknown>)["createdAt"] as string,
  }));

  // ---------------------------------------------------------------
  // Response
  // ---------------------------------------------------------------
  res.json({
    scope: "employee",
    attendance: {
      overview: attendanceOverview,
      rate: attendanceRate,
      workingDays,
    },
    leaveBalance,
    tasks: {
      active: activeTasks.map((t) => t.toJSON()),
      completedCount: completedTasks,
    },
    recentActivity,
  });
}
