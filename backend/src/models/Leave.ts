import mongoose, { Schema } from "mongoose";
import { LEAVE_STATUSES, LEAVE_TYPES, type LeaveStatus, type LeaveType } from "./LeaveType.js";

export interface ILeave extends mongoose.Document {
  user: mongoose.Types.ObjectId;
  leaveType: LeaveType;
  /** Date-only (UTC midnight) — day counts are timezone-stable. */
  startDate: Date;
  endDate: Date;
  /** Inclusive calendar days between start and end. */
  days: number;
  reason: string;
  status: LeaveStatus;
  /** Admin who approved/rejected (null until decided). */
  decidedBy?: mongoose.Types.ObjectId | null;
  decisionNote?: string;
  decidedAt?: Date | null;
}

const leaveSchema = new Schema<ILeave>(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    leaveType: { type: String, required: true, enum: LEAVE_TYPES },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    days: { type: Number, required: true, min: 1 },
    reason: { type: String, required: true, trim: true },
    status: { type: String, required: true, enum: LEAVE_STATUSES, default: "pending", index: true },
    decidedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    decisionNote: { type: String, trim: true },
    decidedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// Newest-first is the common access pattern for both employee and admin lists.
leaveSchema.index({ user: 1, createdAt: -1 });
leaveSchema.index({ status: 1, createdAt: -1 });

// Never leak the internal version key in JSON responses
leaveSchema.set("toJSON", {
  transform: (_doc, ret) => {
    const json = ret as unknown as Record<string, unknown>;
    delete json.__v;
    return json;
  },
});

export const Leave = mongoose.model<ILeave>("Leave", leaveSchema);
