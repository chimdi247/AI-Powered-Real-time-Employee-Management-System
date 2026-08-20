import { useEffect, useState, type FormEvent } from "react";
import { format } from "date-fns";
import {
  AlertCircle,
  CheckCircle,
  Clock,
  Eye,
  LoaderCircle,
  RefreshCw,
  Star,
  Target,
  Trophy,
} from "lucide-react";

import { DataTablePagination } from "@/components/globals/data-table-pagination";
import { DataTableSearch } from "@/components/globals/data-table-search";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useAcknowledgeReview, useMyReviews } from "@/hooks/use-performance-reviews";
import { usePagination } from "@/hooks/use-pagination";
import { getErrorMessage } from "@/lib/api";
import type {
  PerformanceReview,
  ReviewStatus,
  ReviewStatusFilter,
} from "@/types";

import type { Route } from "./+types/performance-reviews";

const PAGE_SIZE = 10;

const STATUS_FILTERS: { value: ReviewStatusFilter; label: string }[] = [
  { value: "all", label: "All reviews" },
  { value: "draft", label: "Draft" },
  { value: "pending_acknowledgment", label: "Pending acknowledgment" },
  { value: "acknowledged", label: "Acknowledged" },
  { value: "completed", label: "Completed" },
];

const STATUS_META: Record<
  ReviewStatus,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  draft: { label: "Draft", variant: "secondary" },
  pending_acknowledgment: { label: "Pending", variant: "outline" },
  acknowledged: { label: "Acknowledged", variant: "default" },
  completed: { label: "Completed", variant: "default" },
};

const DEFAULT_CATEGORIES = [
  "Communication",
  "Technical Skills",
  "Teamwork",
  "Leadership",
];

export function meta({}: Route.MetaArgs) {
  return [{ title: "Performance Reviews | Employee Management System" }];
}

/**
 * Employee performance reviews: view reviews assigned to you, see ratings
 * and AI-generated feedback, acknowledge, and track goal progress.
 */
export default function PerformanceReviewsPage() {
  const [status, setStatus] = useState<ReviewStatusFilter>("all");
  const [search, setSearch] = useState("");
  const { page, setPage, offset, total, setTotal } = usePagination({
    limit: PAGE_SIZE,
    resetKey: search,
  });
  const {
    data,
    isPending,
    isError,
    error,
    refetch,
    isRefetching,
  } = useMyReviews({
    status: status === "all" ? undefined : status,
    search: search || undefined,
    limit: PAGE_SIZE,
    offset,
  });
  const reviews = data?.reviews;
  const [viewing, setViewing] = useState<PerformanceReview | null>(null);

  useEffect(() => {
    setTotal(data?.total ?? 0);
  }, [data?.total, setTotal]);

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-semibold tracking-tight text-foreground">
            Performance Reviews
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            View your performance feedback, track goals, and acknowledge reviews.
          </p>
        </div>
      </header>

      <div className="mt-8 space-y-4">
        {(total > 0 || search !== "") && (
          <div className="flex flex-wrap items-center gap-3">
            <DataTableSearch
              value={search}
              onValueChange={setSearch}
              placeholder="Search reviews…"
              className="flex-1"
            />
            <div className="w-48">
              <Select
                value={status}
                onValueChange={(value) => setStatus(value as ReviewStatusFilter)}
              >
                <SelectTrigger id="review-status-filter" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_FILTERS.map((filter) => (
                    <SelectItem key={filter.value} value={filter.value}>
                      {filter.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {isPending ? (
          <ReviewListSkeleton />
        ) : isError ? (
          <Alert variant="destructive">
            <AlertCircle className="size-4" />
            <AlertTitle>Couldn&apos;t load reviews</AlertTitle>
            <AlertDescription className="flex flex-wrap items-center gap-2">
              {getErrorMessage(error)}
              <Button
                variant="outline"
                size="sm"
                onClick={() => void refetch()}
                disabled={isRefetching}
              >
                {isRefetching ? <LoaderCircle className="animate-spin" /> : <RefreshCw />}
                Retry
              </Button>
            </AlertDescription>
          </Alert>
        ) : total > 0 ? (
          <>
            <div className="grid gap-4">
              {reviews?.map((review) => (
                <ReviewCard
                  key={review._id}
                  review={review}
                  onView={() => setViewing(review)}
                />
              ))}
            </div>
            <DataTablePagination
              page={page}
              limit={PAGE_SIZE}
              total={total}
              onPageChange={setPage}
            />
          </>
        ) : search !== "" ? (
          <Empty className="py-12">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Trophy />
              </EmptyMedia>
              <EmptyTitle>No matching reviews</EmptyTitle>
              <EmptyDescription>
                Nothing matches &ldquo;{search}&rdquo;. Try a different keyword.
              </EmptyDescription>
            </EmptyHeader>
            <Button variant="outline" onClick={() => setSearch("")}>
              Clear search
            </Button>
          </Empty>
        ) : status !== "all" ? (
          <Empty className="py-12">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Trophy />
              </EmptyMedia>
              <EmptyTitle>No {STATUS_META[status as ReviewStatus]?.label} reviews</EmptyTitle>
              <EmptyDescription>
                You don&apos;t have any reviews with this status right now.
              </EmptyDescription>
            </EmptyHeader>
            <Button variant="outline" onClick={() => setStatus("all")}>
              Show all reviews
            </Button>
          </Empty>
        ) : (
          <Empty className="py-12">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Trophy />
              </EmptyMedia>
              <EmptyTitle>No performance reviews yet</EmptyTitle>
              <EmptyDescription>
                Your performance reviews will appear here once they&apos;re assigned
                by your manager.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
      </div>

      <ReviewDetailDialog
        review={viewing}
        onOpenChange={(open) => {
          if (!open) setViewing(null);
        }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Review Card
// ---------------------------------------------------------------------------

function ReviewCard({
  review,
  onView,
}: {
  review: PerformanceReview;
  onView: () => void;
}) {
  return (
    <Card className="transition-colors hover:bg-muted/30">
      <CardContent className="flex flex-wrap items-center gap-4 p-4 sm:p-6">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-heading text-lg font-semibold text-foreground">
              {review.period}
            </h3>
            <Badge variant={STATUS_META[review.status].variant}>
              {STATUS_META[review.status].label}
            </Badge>
            {review.aiGenerated && (
              <Badge variant="secondary" className="gap-1">
                <Star className="size-3" />
                AI Generated
              </Badge>
            )}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Reviewed by {review.reviewer.name}
            {review.overallScore !== undefined && (
              <> · Overall: {review.overallScore.toFixed(1)}/5</>
            )}
          </p>
          {review.ratings.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {review.ratings.map((rating) => (
                <span
                  key={rating.category}
                  className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                >
                  {rating.category}: {rating.score}/5
                </span>
              ))}
            </div>
          )}
          {review.goals.length > 0 && (
            <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
              <Target className="size-3" />
              {review.goals.filter((g) => g.status === "completed").length}/
              {review.goals.length} goals completed
            </div>
          )}
        </div>
        <Button variant="ghost" size="sm" onClick={onView}>
          <Eye />
          View
        </Button>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function ReviewListSkeleton() {
  return (
    <div className="grid gap-4">
      {Array.from({ length: 3 }).map((_, i) => (
        <Card key={i} aria-busy="true" aria-label="Loading review">
          <CardContent className="space-y-3 p-4 sm:p-6">
            <div className="flex items-center gap-2">
              <Skeleton className="h-6 w-24" />
              <Skeleton className="h-5 w-20" />
            </div>
            <Skeleton className="h-4 w-48" />
            <div className="flex gap-2">
              <Skeleton className="h-5 w-20" />
              <Skeleton className="h-5 w-20" />
              <Skeleton className="h-5 w-20" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Star Rating Display
// ---------------------------------------------------------------------------

function StarRating({ score, max = 5 }: { score: number; max?: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: max }).map((_, i) => (
        <Star
          key={i}
          className={`size-4 ${
            i < score
              ? "fill-yellow-400 text-yellow-400"
              : "fill-muted text-muted"
          }`}
        />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Review Detail Dialog
// ---------------------------------------------------------------------------

function ReviewDetailDialog({
  review,
  onOpenChange,
}: {
  review: PerformanceReview | null;
  onOpenChange: (open: boolean) => void;
}) {
  const open = review !== null;
  const acknowledge = useAcknowledgeReview();
  const [comments, setComments] = useState("");

  useEffect(() => {
    if (open) setComments("");
  }, [open]);

  if (!review) return null;

  const canAcknowledge =
    review.status === "pending_acknowledgment" ||
    review.status === "acknowledged";

  function handleAcknowledge(e: FormEvent) {
    e.preventDefault();
    acknowledge.mutate(
      { id: review!._id, input: { comments: comments.trim() || undefined } },
      { onSuccess: () => onOpenChange(false) }
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={STATUS_META[review.status].variant}>
              {STATUS_META[review.status].label}
            </Badge>
            {review.aiGenerated && (
              <Badge variant="secondary" className="gap-1">
                <Star className="size-3" />
                AI Generated
              </Badge>
            )}
          </div>
          <DialogTitle>{review.period} Performance Review</DialogTitle>
          <DialogDescription>
            Reviewed by {review.reviewer.name} ·{" "}
            {format(new Date(review.createdAt), "MMM d, yyyy")}
          </DialogDescription>
        </DialogHeader>

        {/* Overall Score */}
        {review.overallScore !== undefined && (
          <div className="flex items-center gap-3 rounded-lg border bg-muted/30 p-4">
            <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <span className="text-xl font-bold">{review.overallScore.toFixed(1)}</span>
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">Overall Score</p>
              <StarRating score={Math.round(review.overallScore)} />
            </div>
          </div>
        )}

        {/* Category Ratings */}
        {review.ratings.length > 0 && (
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-foreground">Category Ratings</h4>
            <div className="grid gap-2">
              {review.ratings.map((rating) => (
                <div
                  key={rating.category}
                  className="flex items-center justify-between rounded-md border p-3"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">
                      {rating.category}
                    </p>
                    {rating.comment && (
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {rating.comment}
                      </p>
                    )}
                  </div>
                  <div className="ml-3 flex items-center gap-2">
                    <StarRating score={rating.score} />
                    <span className="text-sm font-semibold text-foreground">
                      {rating.score}/5
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* AI-Generated Summary */}
        {review.summary && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-foreground">Summary</h4>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
              {review.summary}
            </p>
          </div>
        )}

        {/* Strengths */}
        {review.strengths && (
          <div className="space-y-2">
            <h4 className="flex items-center gap-1.5 text-sm font-medium text-foreground">
              <Trophy className="size-4 text-green-500" />
              Strengths
            </h4>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
              {review.strengths}
            </p>
          </div>
        )}

        {/* Improvements */}
        {review.improvements && (
          <div className="space-y-2">
            <h4 className="flex items-center gap-1.5 text-sm font-medium text-foreground">
              <Target className="size-4 text-orange-500" />
              Areas for Improvement
            </h4>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
              {review.improvements}
            </p>
          </div>
        )}

        {/* Goals */}
        {review.goals.length > 0 && (
          <div className="space-y-2">
            <h4 className="flex items-center gap-1.5 text-sm font-medium text-foreground">
              <Target className="size-4 text-blue-500" />
              Goals
            </h4>
            <div className="space-y-2">
              {review.goals.map((goal, idx) => (
                <div
                  key={idx}
                  className="flex items-start gap-3 rounded-md border p-3"
                >
                  <div className="mt-0.5">
                    {goal.status === "completed" ? (
                      <CheckCircle className="size-4 text-green-500" />
                    ) : goal.status === "in_progress" ? (
                      <Clock className="size-4 text-blue-500" />
                    ) : (
                      <div className="size-4 rounded-full border-2 border-muted-foreground/30" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{goal.title}</p>
                    {goal.description && (
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {goal.description}
                      </p>
                    )}
                    {goal.dueDate && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Due: {format(new Date(goal.dueDate), "MMM d, yyyy")}
                      </p>
                    )}
                  </div>
                  <Badge
                    variant={
                      goal.status === "completed"
                        ? "default"
                        : goal.status === "in_progress"
                          ? "secondary"
                          : "outline"
                    }
                    className="capitalize"
                  >
                    {goal.status.replace("_", " ")}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Employee Comments (if acknowledged) */}
        {review.employeeComments && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-foreground">Your Comments</h4>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
              {review.employeeComments}
            </p>
          </div>
        )}

        {/* Acknowledge Form */}
        {canAcknowledge && review.status === "pending_acknowledgment" && (
          <form onSubmit={handleAcknowledge} className="space-y-3 border-t pt-4">
            <h4 className="text-sm font-medium text-foreground">
              Acknowledge this review
            </h4>
            <p className="text-xs text-muted-foreground">
              By acknowledging, you confirm you&apos;ve reviewed the feedback above.
              You can optionally add comments.
            </p>
            <Textarea
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              placeholder="Optional comments about your review…"
              rows={3}
            />
            {acknowledge.isError && (
              <Alert variant="destructive">
                <AlertCircle className="size-4" />
                <AlertDescription>{getErrorMessage(acknowledge.error)}</AlertDescription>
              </Alert>
            )}
            <Button type="submit" disabled={acknowledge.isPending}>
              {acknowledge.isPending ? (
                <LoaderCircle className="animate-spin" />
              ) : (
                <CheckCircle />
              )}
              {acknowledge.isPending ? "Acknowledging…" : "Acknowledge Review"}
            </Button>
          </form>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
