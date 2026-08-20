import type { Request, Response } from "express";
import { logActivity } from "../lib/activityLog.js";
import { getPolicies } from "../lib/leavePolicies.js";
import { DEFAULT_LEAVE_POLICIES, LeavePolicy } from "../models/LeavePolicy.js";
import { LEAVE_TYPES, type LeaveType } from "../models/LeaveType.js";

interface UpdatePolicyBody {
  maxDaysPerRequest?: unknown;
  maxDaysPerYear?: unknown;
}

/** Express 5 types params as `string | string[] | undefined` — normalize to a single value. */
function param(req: Request, name: string): string | undefined {
  const value = req.params[name];
  return typeof value === "string" ? value : undefined;
}

/** Admin-only: lists all policies in canonical type order (defaults self-seed). */
export async function listPolicies(_req: Request, res: Response): Promise<void> {
  const policies = await getPolicies();
  res.json({ policies: policies.map((policy) => policy.toJSON()) });
}

/** Admin-only: updates the numeric limits for a leave type. */
export async function updatePolicy(req: Request, res: Response): Promise<void> {
  const leaveType = param(req, "type");
  if (!leaveType || !LEAVE_TYPES.includes(leaveType as LeaveType)) {
    res.status(400).json({
      error: "leave type must be one of: annual, sick, personal, unpaid",
    });
    return;
  }
  const type = leaveType as LeaveType;

  const { maxDaysPerRequest, maxDaysPerYear } = (req.body ?? {}) as UpdatePolicyBody;
  const hasAnyField = maxDaysPerRequest !== undefined || maxDaysPerYear !== undefined;
  if (!hasAnyField) {
    res.status(400).json({ error: "At least one field to update is required" });
    return;
  }
  if (
    maxDaysPerRequest !== undefined &&
    (typeof maxDaysPerRequest !== "number" ||
      !Number.isInteger(maxDaysPerRequest) ||
      maxDaysPerRequest < 1)
  ) {
    res.status(400).json({ error: "maxDaysPerRequest must be an integer of at least 1" });
    return;
  }
  if (
    maxDaysPerYear !== undefined &&
    (typeof maxDaysPerYear !== "number" ||
      !Number.isInteger(maxDaysPerYear) ||
      maxDaysPerYear < 0)
  ) {
    res.status(400).json({ error: "maxDaysPerYear must be a non-negative integer" });
    return;
  }

  let policy = await LeavePolicy.findOne({ leaveType: type });
  if (!policy) {
    policy = await LeavePolicy.create({ leaveType: type, ...DEFAULT_LEAVE_POLICIES[type] });
  }

  const changed: string[] = [];
  if (maxDaysPerRequest !== undefined) {
    policy.maxDaysPerRequest = maxDaysPerRequest;
    changed.push("maxDaysPerRequest");
  }
  if (maxDaysPerYear !== undefined) {
    policy.maxDaysPerYear = maxDaysPerYear;
    changed.push("maxDaysPerYear");
  }
  await policy.save();

  logActivity({
    action: "leave_policy_updated",
    actor: req.user,
    targetType: "leave_policy",
    targetName: `${type} leave policy`,
    details: { leaveType: type, changed },
    ip: req.ip,
  });

  res.json({ policy: policy.toJSON() });
}
