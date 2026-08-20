import mongoose, { Schema } from "mongoose";
import { LEAVE_TYPES, type LeaveType } from "./LeaveType.js";

export interface ILeavePolicy extends mongoose.Document {
  leaveType: LeaveType;
  /** Maximum days a single request can span. */
  maxDaysPerRequest: number;
  /** Per-calendar-year cap; also the annual entitlement for balance-tracked types. */
  maxDaysPerYear: number;
}

export const DEFAULT_LEAVE_POLICIES: Record<
  LeaveType,
  { maxDaysPerRequest: number; maxDaysPerYear: number }
> = {
  annual: { maxDaysPerRequest: 14, maxDaysPerYear: 20 },
  sick: { maxDaysPerRequest: 5, maxDaysPerYear: 10 },
  personal: { maxDaysPerRequest: 3, maxDaysPerYear: 5 },
  unpaid: { maxDaysPerRequest: 30, maxDaysPerYear: 30 },
};

const leavePolicySchema = new Schema<ILeavePolicy>(
  {
    leaveType: { type: String, required: true, unique: true, enum: LEAVE_TYPES },
    maxDaysPerRequest: { type: Number, required: true, min: 1 },
    maxDaysPerYear: { type: Number, required: true, min: 0 },
  },
  { timestamps: true }
);

// Never leak the internal version key in JSON responses
leavePolicySchema.set("toJSON", {
  transform: (_doc, ret) => {
    const json = ret as unknown as Record<string, unknown>;
    delete json.__v;
    return json;
  },
});

export const LeavePolicy = mongoose.model<ILeavePolicy>("LeavePolicy", leavePolicySchema);
