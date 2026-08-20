import type { VariantProps } from "class-variance-authority";
import { format } from "date-fns";

import { badgeVariants } from "@/components/ui/badge";
import type { LeaveStatus, LeaveType } from "@/types";

export const LEAVE_TYPE_LABELS: Record<LeaveType, string> = {
  annual: "Annual leave",
  sick: "Sick leave",
  personal: "Personal leave",
  unpaid: "Unpaid leave",
};

export const LEAVE_STATUS_META: Record<
  LeaveStatus,
  { label: string; variant: NonNullable<VariantProps<typeof badgeVariants>["variant"]> }
> = {
  pending: { label: "Pending", variant: "secondary" },
  approved: { label: "Approved", variant: "default" },
  rejected: { label: "Rejected", variant: "destructive" },
  cancelled: { label: "Cancelled", variant: "outline" },
};

/** Inclusive calendar days between two "YYYY-MM-DD" strings; null when either date is invalid or end precedes start. */
export function countLeaveDays(start: string, end: string): number | null {
  if (!start || !end) return null;
  const startDate = new Date(`${start}T00:00:00.000Z`);
  const endDate = new Date(`${end}T00:00:00.000Z`);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return null;
  if (endDate.getTime() < startDate.getTime()) return null;
  return Math.floor((endDate.getTime() - startDate.getTime()) / 86_400_000) + 1;
}

/** Formats a date-only or ISO date string for display (e.g. "Aug 17, 2026"). */
export function formatLeaveDate(value: string): string {
  return format(new Date(value), "MMM d, yyyy");
}
