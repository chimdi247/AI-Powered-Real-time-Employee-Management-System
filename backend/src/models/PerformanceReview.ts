import mongoose, { Schema } from "mongoose";

// ---------------------------------------------------------------------------
// Review statuses — the lifecycle of a performance review.
// ---------------------------------------------------------------------------
export const REVIEW_STATUSES = [
  "draft",
  "pending_acknowledgment",
  "acknowledged",
  "completed",
] as const;
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

// ---------------------------------------------------------------------------
// Rating sub-document — one per competency category.
// ---------------------------------------------------------------------------
export interface ReviewRating {
  category: string;
  /** Score from 1 to 5. */
  score: number;
  comment?: string;
}

const ratingSchema = new Schema<ReviewRating>(
  {
    category: { type: String, required: true, trim: true },
    score: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, trim: true },
  },
  { _id: false }
);

// ---------------------------------------------------------------------------
// Goal sub-document — improvement goals set by the reviewer.
// ---------------------------------------------------------------------------
export const GOAL_STATUSES = [
  "not_started",
  "in_progress",
  "completed",
] as const;
export type GoalStatus = (typeof GOAL_STATUSES)[number];

export interface ReviewGoal {
  title: string;
  description?: string;
  status: GoalStatus;
  dueDate?: Date;
  completedAt?: Date;
}

const goalSchema = new Schema<ReviewGoal>(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    status: {
      type: String,
      required: true,
      enum: GOAL_STATUSES,
      default: "not_started",
    },
    dueDate: { type: Date },
    completedAt: { type: Date },
  },
  { _id: false }
);

// ---------------------------------------------------------------------------
// PerformanceReview — the main document.
// ---------------------------------------------------------------------------
export interface IPerformanceReview extends mongoose.Document {
  /** Employee being reviewed. */
  employee: mongoose.Types.ObjectId;
  /** Admin or head who created the review. */
  reviewer: mongoose.Types.ObjectId;
  /** Human-readable period, e.g. "Q1 2026", "2025". */
  period: string;
  status: ReviewStatus;
  /** Category ratings (Communication, Technical Skills, Teamwork, Leadership). */
  ratings: ReviewRating[];
  /** Computed overall score (1-5) — set after AI generation. */
  overallScore?: number;
  /** AI-generated strengths paragraph. */
  strengths?: string;
  /** AI-generated areas for improvement paragraph. */
  improvements?: string;
  /** AI-generated overall narrative summary. */
  summary?: string;
  /** Improvement goals set by the reviewer. */
  goals: ReviewGoal[];
  /** Employee's acknowledgment comments (optional). */
  employeeComments?: string;
  /** When the employee acknowledged the review. */
  acknowledgedAt?: Date;
  /** Whether AI generated the review content. */
  aiGenerated: boolean;
}

const performanceReviewSchema = new Schema<IPerformanceReview>(
  {
    employee: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    reviewer: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    period: { type: String, required: true, trim: true },
    status: {
      type: String,
      required: true,
      enum: REVIEW_STATUSES,
      default: "draft",
    },
    ratings: { type: [ratingSchema], default: [] },
    overallScore: { type: Number, min: 1, max: 5 },
    strengths: { type: String, trim: true },
    improvements: { type: String, trim: true },
    summary: { type: String, trim: true },
    goals: { type: [goalSchema], default: [] },
    employeeComments: { type: String, trim: true },
    acknowledgedAt: { type: Date },
    aiGenerated: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Primary access patterns: employee's reviews, reviewer's reviews, status filter.
performanceReviewSchema.index({ employee: 1, createdAt: -1 });
performanceReviewSchema.index({ reviewer: 1, createdAt: -1 });
performanceReviewSchema.index({ status: 1, createdAt: -1 });
performanceReviewSchema.index({ employee: 1, period: 1 });

// Never leak the internal version key in JSON responses.
performanceReviewSchema.set("toJSON", {
  transform: (_doc, ret) => {
    const json = ret as unknown as Record<string, unknown>;
    delete json.__v;
    return json;
  },
});

export const PerformanceReview = mongoose.model<IPerformanceReview>(
  "PerformanceReview",
  performanceReviewSchema
);
