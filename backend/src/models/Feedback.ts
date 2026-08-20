import mongoose, { Schema } from "mongoose";

/** Fixed feedback categories — single source of truth (mirrors the LeaveType pattern). */
export const FEEDBACK_CATEGORIES = ["suggestion", "complaint", "praise", "other"] as const;
export type FeedbackCategory = (typeof FEEDBACK_CATEGORIES)[number];

/** Fixed feedback statuses. */
export const FEEDBACK_STATUSES = ["open", "resolved"] as const;
export type FeedbackStatus = (typeof FEEDBACK_STATUSES)[number];

/** Latest admin response on a submission (single response, overwritten on re-respond). */
export interface FeedbackResponse {
  body: string;
  respondedBy: mongoose.Types.ObjectId;
  respondedAt: Date;
}

export interface IFeedback extends mongoose.Document {
  /**
   * Always stored so the submitter can track their own feedback. When
   * `isAnonymous` is true, admin-facing responses null this out — the
   * identity is never exposed.
   */
  author: mongoose.Types.ObjectId;
  isAnonymous: boolean;
  category: FeedbackCategory;
  message: string;
  status: FeedbackStatus;
  response?: FeedbackResponse;
}

const feedbackResponseSchema = new Schema<FeedbackResponse>(
  {
    body: { type: String, required: true, trim: true },
    respondedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    respondedAt: { type: Date, required: true },
  },
  { _id: false }
);

const feedbackSchema = new Schema<IFeedback>(
  {
    author: { type: Schema.Types.ObjectId, ref: "User", required: true },
    isAnonymous: { type: Boolean, default: false },
    category: { type: String, required: true, enum: FEEDBACK_CATEGORIES },
    message: { type: String, required: true, trim: true },
    status: { type: String, default: "open", enum: FEEDBACK_STATUSES },
    response: { type: feedbackResponseSchema },
  },
  { timestamps: true }
);

// Owner-scoped listing (my feedback) and admin status filter are the access patterns.
feedbackSchema.index({ author: 1, createdAt: -1 });
feedbackSchema.index({ status: 1, createdAt: -1 });

// Never leak the internal version key in JSON responses
feedbackSchema.set("toJSON", {
  transform: (_doc, ret) => {
    const json = ret as unknown as Record<string, unknown>;
    delete json.__v;
    return json;
  },
});

export const Feedback = mongoose.model<IFeedback>("Feedback", feedbackSchema);
