/** Fixed leave types — admins tune per-type limits, they don't add types. */
export const LEAVE_TYPES = ["annual", "sick", "personal", "unpaid"] as const;
export type LeaveType = (typeof LEAVE_TYPES)[number];

export const LEAVE_STATUSES = [
  "pending",
  "approved",
  "rejected",
  "cancelled",
] as const;
export type LeaveStatus = (typeof LEAVE_STATUSES)[number];

/**
 * Leave types with an annual per-employee balance. Unpaid leave is not
 * balance-tracked (it's allowed up to its per-request limit).
 */
export const BALANCE_TRACKED_TYPES = ["annual", "sick", "personal"] as const;
export type BalanceTrackedType = (typeof BALANCE_TRACKED_TYPES)[number];
