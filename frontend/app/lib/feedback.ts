import type { VariantProps } from "class-variance-authority";

import { badgeVariants } from "@/components/ui/badge";
import type { FeedbackCategory, FeedbackStatus } from "@/types";

export const FEEDBACK_CATEGORIES: FeedbackCategory[] = [
  "suggestion",
  "complaint",
  "praise",
  "other",
];

export const FEEDBACK_CATEGORY_LABELS: Record<FeedbackCategory, string> = {
  suggestion: "Suggestion",
  complaint: "Complaint",
  praise: "Praise",
  other: "Other",
};

export const FEEDBACK_STATUS_META: Record<
  FeedbackStatus,
  { label: string; variant: NonNullable<VariantProps<typeof badgeVariants>["variant"]> }
> = {
  open: { label: "Open", variant: "secondary" },
  resolved: { label: "Resolved", variant: "default" },
};
