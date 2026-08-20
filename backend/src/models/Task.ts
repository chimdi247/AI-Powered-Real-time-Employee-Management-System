import mongoose, { Schema } from "mongoose";

export const TASK_STATUSES = [
  "todo",
  "in_progress",
  "in_review",
  "completed",
  "rejected",
] as const;

export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_PRIORITIES = ["low", "medium", "high", "urgent"] as const;

export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export interface ITask extends mongoose.Document {
  title: string;
  description?: string;
  /** Employee the task is assigned to. */
  assignedTo: mongoose.Types.ObjectId;
  /** Head/admin who created and assigned the task. */
  assignedBy: mongoose.Types.ObjectId;
  /** Department context — auto-populated from the assignee. */
  department?: mongoose.Types.ObjectId | null;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate?: Date | null;
  /** Employee's notes when submitting completed work. */
  submissionNotes?: string;
  submittedAt?: Date | null;
  /** Reviewer's notes on approval/rejection. */
  reviewNotes?: string;
  reviewedAt?: Date | null;
  reviewedBy?: mongoose.Types.ObjectId | null;
  completedAt?: Date | null;
}

const taskSchema = new Schema<ITask>(
  {
    title: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, trim: true, maxlength: 2000 },
    assignedTo: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    assignedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    department: {
      type: Schema.Types.ObjectId,
      ref: "Department",
      default: null,
    },
    status: {
      type: String,
      required: true,
      enum: TASK_STATUSES,
      default: "todo",
      index: true,
    },
    priority: {
      type: String,
      required: true,
      enum: TASK_PRIORITIES,
      default: "medium",
    },
    dueDate: { type: Date, default: null },
    submissionNotes: { type: String, trim: true, maxlength: 2000 },
    submittedAt: { type: Date, default: null },
    reviewNotes: { type: String, trim: true, maxlength: 2000 },
    reviewedAt: { type: Date, default: null },
    reviewedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    completedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// Employee's task list — newest first.
taskSchema.index({ assignedTo: 1, createdAt: -1 });
// Head's created tasks — newest first.
taskSchema.index({ assignedBy: 1, createdAt: -1 });
// Admin overview — filter by department + status.
taskSchema.index({ department: 1, status: 1, createdAt: -1 });
// Overdue tasks query.
taskSchema.index({ status: 1, dueDate: 1 });

// Never leak the internal version key in JSON responses.
taskSchema.set("toJSON", {
  transform: (_doc, ret) => {
    const json = ret as unknown as Record<string, unknown>;
    delete json.__v;
    return json;
  },
});

export const Task = mongoose.model<ITask>("Task", taskSchema);
