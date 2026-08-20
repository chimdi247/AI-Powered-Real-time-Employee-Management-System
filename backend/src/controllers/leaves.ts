import type { Request, Response } from "express";
import mongoose from "mongoose";
import { logActivity } from "../lib/activityLog.js";
import { notify } from "../lib/notifications.js";
import { getPolicies, policyFor } from "../lib/leavePolicies.js";
import { parsePagination, searchRegex } from "../lib/pagination.js";
import { pushToUsers, createEvent } from "../lib/sse.js";
import { Leave } from "../models/Leave.js";
import type { ILeave } from "../models/Leave.js";
import {
  BALANCE_TRACKED_TYPES,
  LEAVE_STATUSES,
  LEAVE_TYPES,
  type BalanceTrackedType,
  type LeaveStatus,
  type LeaveType,
} from "../models/LeaveType.js";
import type { IUser, LeaveBalance } from "../models/User.js";
import { User } from "../models/User.js";

const MS_PER_DAY = 86_400_000;

interface CreateLeaveBody {
  leaveType?: unknown;
  startDate?: unknown;
  endDate?: unknown;
  reason?: unknown;
}

interface DecideLeaveBody {
  decision?: unknown;
  note?: unknown;
}

interface AdjustBalanceBody {
  leaveType?: unknown;
  days?: unknown;
}

function isInvalidObjectId(id: string): boolean {
  return !mongoose.isValidObjectId(id);
}

/** Express 5 types params as `string | string[] | undefined` — normalize to a single value. */
function param(req: Request, name: string): string | undefined {
  const value = req.params[name];
  return typeof value === "string" ? value : undefined;
}

async function getLeaveOr404(req: Request, res: Response): Promise<ILeave | undefined> {
  const id = param(req, "id");
  if (!id || isInvalidObjectId(id)) {
    res.status(404).json({ error: "Leave request not found" });
    return undefined;
  }
  const leave = await Leave.findById(id);
  if (!leave) {
    res.status(404).json({ error: "Leave request not found" });
    return undefined;
  }
  return leave;
}

/** Parses a "YYYY-MM-DD" string as a UTC-midnight date; null when invalid or impossible. */
function parseDateOnly(value: unknown): Date | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return null;
  // Reject dates like 2026-02-31 that roll over silently.
  if (date.toISOString().slice(0, 10) !== value) return null;
  return date;
}

/** Inclusive calendar days between two UTC-midnight dates. */
function countDays(start: Date, end: Date): number {
  return Math.floor((end.getTime() - start.getTime()) / MS_PER_DAY) + 1;
}

function todayUtc(): Date {
  const today = new Date();
  return new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));
}

function currentYear(): number {
  return new Date().getFullYear();
}

function isBalanceTracked(type: LeaveType): type is BalanceTrackedType {
  return (BALANCE_TRACKED_TYPES as readonly LeaveType[]).includes(type);
}

/** Returns the user's current-year balance, lazily resetting from policy entitlements after a year rollover. */
async function getBalance(user: IUser, policies: Awaited<ReturnType<typeof getPolicies>>): Promise<LeaveBalance> {
  const year = currentYear();
  const current = user.leaveBalance;
  if (current && current.year === year) {
    return { year, annual: current.annual, sick: current.sick, personal: current.personal };
  }

  const balance: LeaveBalance = { year, annual: 0, sick: 0, personal: 0 };
  for (const type of BALANCE_TRACKED_TYPES) {
    balance[type] = policyFor(policies, type)?.maxDaysPerYear ?? 0;
  }
  user.leaveBalance = balance;
  await user.save();
  return balance;
}

/** Adds `delta` days to the user's current-year balance for a tracked type and persists it. */
async function applyBalanceDelta(
  user: IUser,
  policies: Awaited<ReturnType<typeof getPolicies>>,
  type: BalanceTrackedType,
  delta: number
): Promise<LeaveBalance> {
  const balance = await getBalance(user, policies);
  balance[type] = Math.max(0, balance[type] + delta);
  user.leaveBalance = balance;
  await user.save();
  return balance;
}

/** Any authenticated user (admins included): applies for leave. */
export async function createLeave(req: Request, res: Response): Promise<void> {
  const user = req.user!;
  const { leaveType, startDate, endDate, reason } = (req.body ?? {}) as CreateLeaveBody;

  if (typeof leaveType !== "string" || !LEAVE_TYPES.includes(leaveType as LeaveType)) {
    res.status(400).json({
      error: "leaveType must be one of: annual, sick, personal, unpaid",
    });
    return;
  }
  const type = leaveType as LeaveType;

  const start = parseDateOnly(startDate);
  const end = parseDateOnly(endDate);
  if (!start || !end) {
    res.status(400).json({ error: "startDate and endDate must be valid dates (YYYY-MM-DD)" });
    return;
  }
  if (end.getTime() < start.getTime()) {
    res.status(400).json({ error: "endDate must be on or after startDate" });
    return;
  }
  if (start.getTime() < todayUtc().getTime()) {
    res.status(400).json({ error: "Leave cannot start in the past" });
    return;
  }
  if (typeof reason !== "string" || !reason.trim()) {
    res.status(400).json({ error: "reason is required" });
    return;
  }

  const days = countDays(start, end);
  const policies = await getPolicies();
  const policy = policyFor(policies, type);
  if (!policy) {
    res.status(400).json({ error: "No leave policy is configured for this type" });
    return;
  }
  if (days > policy.maxDaysPerRequest) {
    res.status(400).json({
      error: `Leave requests of this type are limited to ${policy.maxDaysPerRequest} day(s) per request`,
    });
    return;
  }

  if (isBalanceTracked(type)) {
    const balance = await getBalance(user, policies);
    if (days > balance[type]) {
      res.status(400).json({
        error: `Insufficient ${type} leave balance (${balance[type]} day(s) left)`,
      });
      return;
    }
  }

  // No overlapping pending/approved requests (prevents double-booking).
  const overlap = await Leave.findOne({
    user: user._id,
    status: { $in: ["pending", "approved"] },
    startDate: { $lte: end },
    endDate: { $gte: start },
  });
  if (overlap) {
    res.status(400).json({
      error: "You already have a pending or approved request overlapping these dates",
    });
    return;
  }

  const leave = await Leave.create({
    user: user._id,
    leaveType: type,
    startDate: start,
    endDate: end,
    days,
    reason: reason.trim(),
    status: "pending",
  });

  logActivity({
    action: "leave_created",
    actor: user,
    targetType: "leave",
    targetId: leave._id,
    targetName: `${type} leave`,
    details: { leaveType: type, days },
    ip: req.ip,
  });

  // Real-time SSE push to admins and department heads
  const { User } = await import("../models/User.js");
  const adminsAndHeads = await User.find({
    role: { $in: ["admin", "head"] },
    _id: { $ne: user._id },
  }).select("_id");
  const notifyUserIds = adminsAndHeads.map((u) => u._id.toString());
  if (notifyUserIds.length > 0) {
    pushToUsers(
      notifyUserIds,
      createEvent("leave-updated", {
        leaveId: leave._id,
        action: "created",
        leaveType: type,
        days,
        status: "pending",
        requestedBy: user.name,
      })
    );
  }

  res.status(201).json({ leave: leave.toJSON() });
}

/** Any authenticated user: their own requests, newest first, with optional search + pagination. */
export async function myLeaves(req: Request, res: Response): Promise<void> {
  const user = req.user!;
  const { limit, offset } = parsePagination(req);
  const search = searchRegex(req.query.search);

  const filter: Record<string, unknown> = { user: user._id };
  if (search) {
    filter.$or = [{ leaveType: search }, { status: search }, { reason: search }];
  }

  let query = Leave.find(filter).populate("user", "name email").sort({ createdAt: -1 });
  if (limit !== null) {
    query = query.skip(offset).limit(limit);
  }

  const [leaves, total] = await Promise.all([query, Leave.countDocuments(filter)]);
  res.json({ leaves: leaves.map((leave) => leave.toJSON()), total, limit, offset });
}

/** Any authenticated user: their current-year leave balance. */
export async function myBalance(req: Request, res: Response): Promise<void> {
  const user = req.user!;
  const policies = await getPolicies();
  const balance = await getBalance(user, policies);
  res.json({ balance });
}

/** Admin-only: all requests, optionally filtered by status/employee and paginated. */
export async function listLeaves(req: Request, res: Response): Promise<void> {
  const status = req.query.status;
  const { limit, offset } = parsePagination(req);
  const search = searchRegex(req.query.search);

  const filter: Record<string, unknown> = {};
  if (status !== undefined) {
    if (typeof status !== "string" || !LEAVE_STATUSES.includes(status as LeaveStatus)) {
      res.status(400).json({
        error: "status must be one of: pending, approved, rejected, cancelled",
      });
      return;
    }
    filter.status = status;
  }

  if (search) {
    // Search over the populated employee — population can't be filtered directly,
    // so resolve matching user ids first, then narrow the leaves by them.
    const matchingUsers = await User.find({
      $or: [{ name: search }, { email: search }],
    }).select("_id");
    const ids = matchingUsers.map((user) => user._id);
    if (ids.length === 0) {
      res.json({ leaves: [], total: 0, limit, offset });
      return;
    }
    filter.user = { $in: ids };
  }

  let query = Leave.find(filter).populate("user", "name email").sort({ createdAt: -1 });
  if (limit !== null) {
    query = query.skip(offset).limit(limit);
  }

  const [leaves, total] = await Promise.all([query, Leave.countDocuments(filter)]);
  res.json({ leaves: leaves.map((leave) => leave.toJSON()), total, limit, offset });
}

/** Admin-only: approves or rejects a pending request. Approval deducts the balance. */
export async function decideLeave(req: Request, res: Response): Promise<void> {
  const leave = await getLeaveOr404(req, res);
  if (!leave) return;
  const admin = req.user!;

  const { decision, note } = (req.body ?? {}) as DecideLeaveBody;
  if (decision !== "approved" && decision !== "rejected") {
    res.status(400).json({ error: "decision must be approved or rejected" });
    return;
  }
  if (note !== undefined && (typeof note !== "string" || note.trim().length > 500)) {
    res.status(400).json({ error: "note must be a short string" });
    return;
  }
  if (leave.status !== "pending") {
    res.status(400).json({ error: "Only pending requests can be decided" });
    return;
  }

  if (decision === "approved") {
    const owner = await User.findById(leave.user);
    if (!owner) {
      res.status(404).json({ error: "The leave owner no longer exists" });
      return;
    }
    const policies = await getPolicies();
    if (isBalanceTracked(leave.leaveType)) {
      const balance = await getBalance(owner, policies);
      if (leave.days > balance[leave.leaveType]) {
        res.status(400).json({
          error: `Insufficient ${leave.leaveType} leave balance (${balance[leave.leaveType]} day(s) left)`,
        });
        return;
      }
      await applyBalanceDelta(owner, policies, leave.leaveType, -leave.days);
    }
    leave.status = "approved";
  } else {
    leave.status = "rejected";
  }

  leave.decidedBy = admin._id;
  leave.decidedAt = new Date();
  if (note !== undefined) leave.decisionNote = (note as string).trim() || undefined;
  await leave.save();

  logActivity({
    action: decision === "approved" ? "leave_approved" : "leave_rejected",
    actor: admin,
    targetType: "leave",
    targetId: leave._id,
    targetName: `${leave.leaveType} leave`,
    details: { leaveType: leave.leaveType, days: leave.days, note: leave.decisionNote },
    ip: req.ip,
  });

  // Notify the leave owner about the decision.
  const isApproved = decision === "approved";
  notify({
    recipient: leave.user,
    actor: admin,
    type: isApproved ? "leave_approved" : "leave_rejected",
    title: isApproved ? "Leave approved" : "Leave rejected",
    message: `Your ${leave.leaveType} leave request for ${leave.days} day(s) has been ${decision}.`,
    link: "/leaves",
    data: {
      leaveType: leave.leaveType,
      startDate: leave.startDate.toISOString().slice(0, 10),
      endDate: leave.endDate.toISOString().slice(0, 10),
      days: leave.days,
      note: leave.decisionNote,
    },
  });

  // Real-time SSE push to employee and admin
  pushToUsers(
    [leave.user.toString(), admin._id.toString()],
    createEvent("leave-updated", {
      leaveId: leave._id,
      action: decision,
      leaveType: leave.leaveType,
      days: leave.days,
      status: decision === "approved" ? "approved" : "rejected",
    })
  );

  res.json({ leave: leave.toJSON() });
}

/** Owner-only: cancels their own pending or approved request (approved refunds the days). */
export async function cancelLeave(req: Request, res: Response): Promise<void> {
  const leave = await getLeaveOr404(req, res);
  if (!leave) return;
  const user = req.user!;

  if (!leave.user.equals(user._id)) {
    res.status(403).json({ error: "You can only cancel your own leave requests" });
    return;
  }
  if (leave.status !== "pending" && leave.status !== "approved") {
    res.status(400).json({ error: "Only pending or approved requests can be cancelled" });
    return;
  }

  const wasApproved = leave.status === "approved";
  leave.status = "cancelled";
  await leave.save();

  if (wasApproved && isBalanceTracked(leave.leaveType)) {
    const policies = await getPolicies();
    await applyBalanceDelta(user, policies, leave.leaveType, leave.days);
  }

  logActivity({
    action: "leave_cancelled",
    actor: user,
    targetType: "leave",
    targetId: leave._id,
    targetName: `${leave.leaveType} leave`,
    details: { leaveType: leave.leaveType, days: leave.days, refunded: wasApproved },
    ip: req.ip,
  });

  // Real-time SSE push to user
  pushToUsers(
    [user._id.toString()],
    createEvent("leave-updated", {
      leaveId: leave._id,
      action: "cancelled",
      leaveType: leave.leaveType,
      days: leave.days,
      status: "cancelled",
    })
  );

  res.json({ leave: leave.toJSON() });
}

/** Admin-only: users with their current-year balances, sorted by name, with optional search + pagination. */
export async function listBalances(req: Request, res: Response): Promise<void> {
  const { limit, offset } = parsePagination(req);
  const search = searchRegex(req.query.search);

  const filter: Record<string, unknown> = {};
  if (search) {
    filter.$or = [{ name: search }, { email: search }];
  }

  let query = User.find(filter).sort({ name: 1 }).select("name email leaveBalance");
  if (limit !== null) {
    query = query.skip(offset).limit(limit);
  }

  const [users, total] = await Promise.all([query, User.countDocuments(filter)]);
  const policies = await getPolicies();

  const balances = await Promise.all(
    users.map(async (user) => {
      const balance = await getBalance(user, policies);
      return {
        user: { _id: user._id, name: user.name, email: user.email },
        balance,
      };
    })
  );

  res.json({ balances, total, limit, offset });
}

/** Admin-only: sets a user's remaining days for a tracked leave type this year. */
export async function adjustBalance(req: Request, res: Response): Promise<void> {
  const userId = param(req, "userId");
  if (!userId || isInvalidObjectId(userId)) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  const user = await User.findById(userId);
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const { leaveType, days } = (req.body ?? {}) as AdjustBalanceBody;
  if (typeof leaveType !== "string" || !isBalanceTracked(leaveType as LeaveType)) {
    res.status(400).json({ error: "leaveType must be one of: annual, sick, personal" });
    return;
  }
  if (typeof days !== "number" || !Number.isInteger(days) || days < 0) {
    res.status(400).json({ error: "days must be a non-negative integer" });
    return;
  }

  const type = leaveType as BalanceTrackedType;
  const policies = await getPolicies();
  const balance = await getBalance(user, policies);
  balance[type] = days;
  user.leaveBalance = balance;
  await user.save();

  logActivity({
    action: "leave_balance_adjusted",
    actor: req.user,
    targetType: "user",
    targetId: user._id,
    targetName: user.name,
    details: { leaveType: type, days },
    ip: req.ip,
  });

  res.json({ balance });
}
