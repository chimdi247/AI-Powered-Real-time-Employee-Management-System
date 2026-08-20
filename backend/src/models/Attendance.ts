import mongoose, { Schema } from "mongoose";

/** Fixed attendance statuses. */
export const ATTENDANCE_STATUSES = [
  "present",
  "absent",
  "late",
  "half_day",
  "on_leave",
] as const;

export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];

export interface IAttendance extends mongoose.Document {
  /** Employee whose attendance is recorded. */
  user: mongoose.Types.ObjectId;
  /** The attendance date (stored as UTC midnight). */
  date: Date;
  status: AttendanceStatus;
  /** Check-in timestamp (full datetime). */
  checkIn?: Date | null;
  /** Check-out timestamp (full datetime). */
  checkOut?: Date | null;
  /** Head/admin who marked the attendance. */
  markedBy: mongoose.Types.ObjectId;
  /** Optional notes (e.g. reason for late/absence). */
  notes?: string;
}

const attendanceSchema = new Schema<IAttendance>(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    date: { type: Date, required: true },
    status: { type: String, required: true, enum: ATTENDANCE_STATUSES },
    checkIn: { type: Date, default: null },
    checkOut: { type: Date, default: null },
    markedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    notes: { type: String, trim: true },
  },
  { timestamps: true }
);

// One record per employee per day.
attendanceSchema.index({ user: 1, date: 1 }, { unique: true });

// Date-range queries (newest first).
attendanceSchema.index({ date: -1 });

// Per-employee history.
attendanceSchema.index({ user: 1, date: -1 });

// Never leak the internal version key in JSON responses.
attendanceSchema.set("toJSON", {
  transform: (_doc, ret) => {
    const json = ret as unknown as Record<string, unknown>;
    delete json.__v;
    return json;
  },
});

export const Attendance = mongoose.model<IAttendance>(
  "Attendance",
  attendanceSchema
);
