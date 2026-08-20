import type { Request, Response } from "express";
import mongoose from "mongoose";
import { Attendance } from "../models/Attendance.js";
import { ActivityLog } from "../models/ActivityLog.js";
import { Department } from "../models/Department.js";
import { Leave } from "../models/Leave.js";
import { LEAVE_TYPES, type LeaveStatus, type LeaveType } from "../models/LeaveType.js";
import { User } from "../models/User.js";

// ---------------------------------------------------------------------------

function isInvalidObjectId(id: string): boolean {
  return !mongoose.isValidObjectId(id);
}

/** Parses a "YYYY-MM-DD" string as a UTC-midnight date; null when invalid. */
function parseDateOnly(value: unknown): Date | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return null;
  if (date.toISOString().slice(0, 10) !== value) return null;
  return date;
}

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

/** Formats a Date as "YYYY-MM". */
function toYearMonth(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

// ---------------------------------------------------------------------------
// Employee Performance Report
// ---------------------------------------------------------------------------

export async function employeePerformance(req: Request, res: Response): Promise<void> {
  const from = parseDateOnly(req.query.from) ?? startOfCurrentMonth();
  const to = parseDateOnly(req.query.to) ?? endOfCurrentMonth();
  const toExclusive = new Date(to.getTime() + 86_400_000);

  // Optional department filter.
  const deptParam = req.query.department;
  let departmentFilter: Record<string, unknown> = {};
  if (typeof deptParam === "string" && !isInvalidObjectId(deptParam)) {
    departmentFilter = { department: new mongoose.Types.ObjectId(deptParam) };
  }

  // Get employees in scope.
  const employees = await User.find({ ...departmentFilter, role: { $ne: "admin" } })
    .select("name email department")
    .sort({ name: 1 });

  if (employees.length === 0) {
    res.json({ period: { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) }, employees: [] });
    return;
  }

  const employeeIds = employees.map((e) => e._id);
  const workingDays = workingDaysBetween(from, toExclusive);

  // Fetch attendance records in range.
  const attendanceRecords = await Attendance.find({
    user: { $in: employeeIds },
    date: { $gte: from, $lt: toExclusive },
  }).select("user status");

  // Fetch leave records in range.
  const leaveRecords = await Leave.find({
    user: { $in: employeeIds },
    startDate: { $gte: from },
    endDate: { $lt: toExclusive },
  }).select("user leaveType status days");

  // Fetch department names.
  const deptIds = employees
    .map((e) => e.department)
    .filter((d): d is mongoose.Types.ObjectId => d != null);
  const departments = deptIds.length > 0
    ? await Department.find({ _id: { $in: deptIds } }).select("name")
    : [];
  const deptMap = new Map(departments.map((d) => [d._id.toString(), d.name]));

  // Build per-employee data.
  const attendanceMap = new Map<string, { present: number; absent: number; late: number; half_day: number; on_leave: number }>();
  for (const emp of employees) {
    attendanceMap.set(emp._id.toString(), { present: 0, absent: 0, late: 0, half_day: 0, on_leave: 0 });
  }
  for (const record of attendanceRecords) {
    const entry = attendanceMap.get(record.user.toString());
    if (entry) entry[record.status]++;
  }

  const leaveMap = new Map<string, { annual: number; sick: number; personal: number; unpaid: number; total: number; approved: number }>();
  for (const emp of employees) {
    leaveMap.set(emp._id.toString(), { annual: 0, sick: 0, personal: 0, unpaid: 0, total: 0, approved: 0 });
  }
  for (const record of leaveRecords) {
    const entry = leaveMap.get(record.user.toString());
    if (entry) {
      entry[record.leaveType as LeaveType]++;
      entry.total++;
      if (record.status === "approved") entry.approved++;
    }
  }

  const result = employees.map((emp) => {
    const key = emp._id.toString();
    const att = attendanceMap.get(key)!;
    const leave = leaveMap.get(key)!;
    const attendedCount = att.present + att.late + att.half_day;
    const attendanceRate = workingDays > 0
      ? Math.round((attendedCount / workingDays) * 10000) / 100
      : 0;
    const approvalRate = leave.total > 0
      ? Math.round((leave.approved / leave.total) * 10000) / 100
      : 0;

    return {
      user: { _id: emp._id, name: emp.name, email: emp.email, department: emp.department },
      departmentName: emp.department ? deptMap.get(emp.department.toString()) ?? undefined : undefined,
      attendance: { ...att, rate: attendanceRate },
      leaves: { ...leave, approvalRate },
    };
  });

  res.json({
    period: { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) },
    employees: result,
  });
}

// ---------------------------------------------------------------------------
// Leave Statistics Report
// ---------------------------------------------------------------------------

export async function leaveStatistics(req: Request, res: Response): Promise<void> {
  const from = parseDateOnly(req.query.from) ?? startOfCurrentMonth();
  const to = parseDateOnly(req.query.to) ?? endOfCurrentMonth();
  const toExclusive = new Date(to.getTime() + 86_400_000);

  // Optional department filter.
  const deptParam = req.query.department;
  let departmentFilter: Record<string, unknown> = {};
  if (typeof deptParam === "string" && !isInvalidObjectId(deptParam)) {
    departmentFilter = { department: new mongoose.Types.ObjectId(deptParam) };
  }

  // Get employees in scope.
  const employees = await User.find({ ...departmentFilter, role: { $ne: "admin" } })
    .select("name email department")
    .sort({ name: 1 });

  if (employees.length === 0) {
    res.json({
      period: { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) },
      summary: { total: 0, pending: 0, approved: 0, rejected: 0, cancelled: 0 },
      byType: [],
      byDepartment: [],
      monthlyTrend: [],
    });
    return;
  }

  const employeeIds = employees.map((e) => e._id);

  // Fetch leaves in range.
  const leaves = await Leave.find({
    user: { $in: employeeIds },
    createdAt: { $gte: from, $lt: toExclusive },
  }).select("user leaveType status startDate days");

  // Summary.
  const summary = { total: leaves.length, pending: 0, approved: 0, rejected: 0, cancelled: 0 };
  for (const leave of leaves) {
    if (leave.status === "pending") summary.pending++;
    else if (leave.status === "approved") summary.approved++;
    else if (leave.status === "rejected") summary.rejected++;
    else if (leave.status === "cancelled") summary.cancelled++;
  }

  // By type.
  const byTypeMap = new Map<string, { count: number; approved: number; rejected: number }>();
  for (const lt of LEAVE_TYPES) {
    byTypeMap.set(lt, { count: 0, approved: 0, rejected: 0 });
  }
  for (const leave of leaves) {
    const entry = byTypeMap.get(leave.leaveType);
    if (entry) {
      entry.count++;
      if (leave.status === "approved") entry.approved++;
      if (leave.status === "rejected") entry.rejected++;
    }
  }
  const byType = Array.from(byTypeMap.entries()).map(([type, data]) => ({ type, ...data }));

  // By department.
  const deptIds = employees
    .map((e) => e.department)
    .filter((d): d is mongoose.Types.ObjectId => d != null);
  const departments = deptIds.length > 0
    ? await Department.find({ _id: { $in: deptIds } }).select("name")
    : [];
  const deptMap = new Map(departments.map((d) => [d._id.toString(), d.name]));

  // Map user → department.
  const userDeptMap = new Map<string, string>();
  for (const emp of employees) {
    const deptId = emp.department?.toString();
    if (deptId) {
      userDeptMap.set(emp._id.toString(), deptMap.get(deptId) ?? "Unknown");
    }
  }

  const byDeptMap = new Map<string, { total: number; approved: number; rejected: number }>();
  for (const leave of leaves) {
    const deptName = userDeptMap.get(leave.user.toString()) ?? "Unassigned";
    const entry = byDeptMap.get(deptName) ?? { total: 0, approved: 0, rejected: 0 };
    entry.total++;
    if (leave.status === "approved") entry.approved++;
    if (leave.status === "rejected") entry.rejected++;
    byDeptMap.set(deptName, entry);
  }
  const byDepartment = Array.from(byDeptMap.entries())
    .map(([department, data]) => ({ department, ...data }))
    .sort((a, b) => b.total - a.total);

  // Monthly trend (grouped by leave start month).
  const monthlyMap = new Map<string, { total: number; approved: number; rejected: number }>();
  for (const leave of leaves) {
    const month = toYearMonth(leave.startDate);
    const entry = monthlyMap.get(month) ?? { total: 0, approved: 0, rejected: 0 };
    entry.total++;
    if (leave.status === "approved") entry.approved++;
    if (leave.status === "rejected") entry.rejected++;
    monthlyMap.set(month, entry);
  }
  const monthlyTrend = Array.from(monthlyMap.entries())
    .map(([month, data]) => ({ month, ...data }))
    .sort((a, b) => a.month.localeCompare(b.month));

  res.json({
    period: { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) },
    summary: {
      total: summary.total,
      pending: summary.pending,
      approved: summary.approved,
      rejected: summary.rejected,
      cancelled: summary.cancelled,
    },
    byType,
    byDepartment,
    monthlyTrend,
  });
}

// ---------------------------------------------------------------------------
// Department Activities Report
// ---------------------------------------------------------------------------

export async function departmentActivities(req: Request, res: Response): Promise<void> {
  const from = parseDateOnly(req.query.from) ?? startOfCurrentMonth();
  const to = parseDateOnly(req.query.to) ?? endOfCurrentMonth();
  const toExclusive = new Date(to.getTime() + 86_400_000);

  const departments = await Department.find().sort({ name: 1 });

  if (departments.length === 0) {
    res.json({
      period: { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) },
      departments: [],
    });
    return;
  }

  const deptIds = departments.map((d) => d._id);

  // Get employees grouped by department.
  const employees = await User.find({
    department: { $in: deptIds },
    role: { $ne: "admin" },
  }).select("name department");

  const membersByDept = new Map<string, mongoose.Types.ObjectId[]>();
  for (const emp of employees) {
    const deptId = emp.department!.toString();
    const list = membersByDept.get(deptId) ?? [];
    list.push(emp._id);
    membersByDept.set(deptId, list);
  }

  const allEmployeeIds = employees.map((e) => e._id);

  // Attendance in range.
  const attendanceRecords = allEmployeeIds.length > 0
    ? await Attendance.find({
        user: { $in: allEmployeeIds },
        date: { $gte: from, $lt: toExclusive },
      }).select("user status")
    : [];

  // Leave days used in range.
  const leaveRecords = allEmployeeIds.length > 0
    ? await Leave.find({
        user: { $in: allEmployeeIds },
        status: "approved",
        startDate: { $gte: from },
        endDate: { $lt: toExclusive },
      }).select("user days")
    : [];

  // Activity logs in range.
  const activityCounts = await ActivityLog.aggregate([
    { $match: { createdAt: { $gte: from, $lt: toExclusive } } },
    { $group: { _id: "$actor", count: { $sum: 1 } } },
  ]);
  const activityCountByUser = new Map<string, number>();
  for (const entry of activityCounts) {
    if (entry._id) activityCountByUser.set(entry._id.toString(), entry.count);
  }

  const workingDays = workingDaysBetween(from, toExclusive);

  const result = departments.map((dept) => {
    const deptId = dept._id.toString();
    const memberIds = membersByDept.get(deptId) ?? [];

    // Attendance stats for this department.
    const statusCounts = { present: 0, absent: 0, late: 0, half_day: 0, on_leave: 0 };
    const memberIdSet = new Set(memberIds.map((id) => id.toString()));
    for (const record of attendanceRecords) {
      if (memberIdSet.has(record.user.toString())) {
        statusCounts[record.status]++;
      }
    }
    const attendedCount = statusCounts.present + statusCounts.late + statusCounts.half_day;
    const avgAttendanceRate = workingDays > 0 && memberIds.length > 0
      ? Math.round((attendedCount / (workingDays * memberIds.length)) * 10000) / 100
      : 0;

    // Leave days used.
    let leaveDaysUsed = 0;
    for (const record of leaveRecords) {
      if (memberIdSet.has(record.user.toString())) {
        leaveDaysUsed += record.days;
      }
    }

    // Recent activity count.
    let recentActivities = 0;
    for (const memberId of memberIds) {
      recentActivities += activityCountByUser.get(memberId.toString()) ?? 0;
    }

    return {
      _id: dept._id,
      name: dept.name,
      memberCount: memberIds.length,
      avgAttendanceRate,
      leaveDaysUsed,
      recentActivities,
    };
  });

  res.json({
    period: { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) },
    departments: result,
  });
}
