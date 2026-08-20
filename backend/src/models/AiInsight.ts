import mongoose, { Schema } from "mongoose";

export const AI_INSIGHT_SCOPES = ["organization", "department"] as const;
export type AiInsightScope = (typeof AI_INSIGHT_SCOPES)[number];

export const AI_INSIGHT_STATUSES = [
  "pending",
  "generating",
  "completed",
  "failed",
] as const;
export type AiInsightStatus = (typeof AI_INSIGHT_STATUSES)[number];

export interface IAiInsight extends mongoose.Document {
  /** User who triggered the insight generation. */
  createdBy: mongoose.Types.ObjectId;
  /** Whether this is an org-wide or department-scoped insight. */
  scope: AiInsightScope;
  /** Department id — set when scope is "department". */
  department?: mongoose.Types.ObjectId | null;
  /** Generation status. */
  status: AiInsightStatus;
  /** AI-generated title. */
  title?: string;
  /** AI-generated markdown content with full analysis. */
  content?: string;
  /** Short one-line summary. */
  summary?: string;
  /** Human-readable period, e.g. "Last 30 days". */
  period: string;
  /** Inngest run id for tracking execution. */
  inngestRunId?: string;
  /** Error message if generation failed. */
  error?: string;
}

const aiInsightSchema = new Schema<IAiInsight>(
  {
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    scope: {
      type: String,
      required: true,
      enum: AI_INSIGHT_SCOPES,
    },
    department: {
      type: Schema.Types.ObjectId,
      ref: "Department",
      default: null,
    },
    status: {
      type: String,
      required: true,
      enum: AI_INSIGHT_STATUSES,
      default: "pending",
    },
    title: { type: String, trim: true },
    content: { type: String, trim: true },
    summary: { type: String, trim: true },
    period: { type: String, required: true, trim: true },
    inngestRunId: { type: String, trim: true },
    error: { type: String, trim: true },
  },
  { timestamps: true }
);

// Primary access patterns: user's insights, scope filter.
aiInsightSchema.index({ createdBy: 1, createdAt: -1 });
aiInsightSchema.index({ scope: 1, createdAt: -1 });
aiInsightSchema.index({ department: 1, createdAt: -1 });

// Never leak the internal version key in JSON responses.
aiInsightSchema.set("toJSON", {
  transform: (_doc, ret) => {
    const json = ret as unknown as Record<string, unknown>;
    delete json.__v;
    return json;
  },
});

export const AiInsight = mongoose.model<IAiInsight>(
  "AiInsight",
  aiInsightSchema
);
