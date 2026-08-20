import mongoose, { Schema } from "mongoose";

/** Fixed notification types — keeps backend and frontend in sync. */
export const NOTIFICATION_TYPES = [
  "leave_approved",
  "leave_rejected",
  "feedback_responded",
  "announcement_created",
  "review_assigned",
  "review_acknowledged",
  "task_assigned",
  "task_completed",
  "task_approved",
  "task_rejected",
] as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export interface INotification extends mongoose.Document {
  /** User who receives the notification. */
  recipient: mongoose.Types.ObjectId;
  /** User who triggered the event (null for system-generated notifications). */
  actor?: mongoose.Types.ObjectId | null;
  type: NotificationType;
  /** Short human-readable title. */
  title: string;
  /** Longer description of the event. */
  message: string;
  read: boolean;
  /** Optional frontend route to navigate to when the notification is clicked. */
  link?: string;
}

const notificationSchema = new Schema<INotification>(
  {
    recipient: { type: Schema.Types.ObjectId, ref: "User", required: true },
    actor: { type: Schema.Types.ObjectId, ref: "User", default: null },
    type: { type: String, required: true, enum: NOTIFICATION_TYPES },
    title: { type: String, required: true, trim: true },
    message: { type: String, required: true, trim: true },
    read: { type: Boolean, default: false },
    link: { type: String, trim: true },
  },
  { timestamps: true }
);

// Primary access pattern: user's notifications, newest first.
notificationSchema.index({ recipient: 1, createdAt: -1 });
// Unread count query.
notificationSchema.index({ recipient: 1, read: 1 });

// Never leak the internal version key in JSON responses.
notificationSchema.set("toJSON", {
  transform: (_doc, ret) => {
    const json = ret as unknown as Record<string, unknown>;
    delete json.__v;
    return json;
  },
});

export const Notification = mongoose.model<INotification>(
  "Notification",
  notificationSchema
);
