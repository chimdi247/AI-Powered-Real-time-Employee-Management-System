import {
  DEFAULT_LEAVE_POLICIES,
  LeavePolicy,
  type ILeavePolicy,
} from "../models/LeavePolicy.js";
import { LEAVE_TYPES, type LeaveType } from "../models/LeaveType.js";

/**
 * All policies in canonical type order, lazily seeding a default for any type
 * that doesn't have one yet (no migration or seed run required).
 */
export async function getPolicies(): Promise<ILeavePolicy[]> {
  const existing = await LeavePolicy.find();
  const byType = new Map(existing.map((policy) => [policy.leaveType, policy]));

  const missing = LEAVE_TYPES.filter((type) => !byType.has(type));
  if (missing.length > 0) {
    try {
      const created = await LeavePolicy.insertMany(
        missing.map((type) => ({ leaveType: type, ...DEFAULT_LEAVE_POLICIES[type] }))
      );
      for (const policy of created) byType.set(policy.leaveType, policy);
    } catch {
      // Concurrent seed — re-read and merge.
      const refreshed = await LeavePolicy.find();
      for (const policy of refreshed) byType.set(policy.leaveType, policy);
    }
  }

  const policies: ILeavePolicy[] = [];
  for (const type of LEAVE_TYPES) {
    const policy = byType.get(type);
    if (policy) policies.push(policy);
  }
  return policies;
}

export function policyFor(
  policies: ILeavePolicy[],
  leaveType: LeaveType
): ILeavePolicy | undefined {
  return policies.find((policy) => policy.leaveType === leaveType);
}
