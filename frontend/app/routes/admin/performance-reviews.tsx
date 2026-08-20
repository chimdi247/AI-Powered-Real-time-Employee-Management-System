import { useEffect, useState, type FormEvent } from "react";
import { format } from "date-fns";
import {
  AlertCircle,
  CheckCircle,
  Clock,
  Eye,
  LoaderCircle,
  Plus,
  RefreshCw,
  Star,
  Target,
  Trash2,
  Trophy,
  Wand2,
} from "lucide-react";

import { DataTablePagination } from "@/components/globals/data-table-pagination";
import { DataTableSearch } from "@/components/globals/data-table-search";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { Input } from "@/components/ui/input";
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
import {
  useCreateReview,
  useDeleteReview,
  useReviews,
  useUpdateGoal,
  useUpdateReview,
} from "@/hooks/use-performance-reviews";
import { usePagination } from "@/hooks/use-pagination";
import { api, getErrorMessage } from "@/lib/api";
import type {
  PerformanceReview,
  ReviewStatus,
  ReviewStatusFilter,
  UpdateReviewInput,
  User,
} from "@/types";

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

export function meta() {
  return [{ title: "Manage Performance Reviews | Employee Management System" }];
}

/**
 * Admin/head performance reviews: create reviews, manage ratings and goals,
 * trigger AI generation, and view all employee reviews.
 */
export default function AdminPerformanceReviewsPage() {
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
  } = useReviews({
    status: status === "all" ? undefined : status,
    search: search || undefined,
    limit: PAGE_SIZE,
    offset,
  });
  const reviews = data?.reviews;
  const [createOpen, setCreateOpen] = useState(false);
  const [viewing, setViewing] = useState<PerformanceReview | null>(null);
  const [deleting, setDeleting] = useState<PerformanceReview | null>(null);

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
            Schedule reviews, manage ratings, and track employee progress.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus />
          Create review
        </Button>
      </header>

      <div className="mt-8 space-y-4">
        {(total > 0 || search !== "") && (
          <div className="flex flex-wrap items-center gap-3">
            <DataTableSearch
              value={search}
              onValueChange={setSearch}
              placeholder="Search by employee name…"
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
                <AdminReviewCard
                  key={review._id}
                  review={review}
                  onView={() => setViewing(review)}
                  onDelete={() => setDeleting(review)}
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
                No reviews match this status filter.
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
              <EmptyTitle>No performance reviews</EmptyTitle>
              <EmptyDescription>
                Create your first performance review to get started.
              </EmptyDescription>
            </EmptyHeader>
            <Button onClick={() => setCreateOpen(true)}>
              <Plus />
              Create review
            </Button>
          </Empty>
        )}
      </div>

      <CreateReviewDialog
        open={createOpen}
        onOpenChange={(open) => {
          if (!open) setCreateOpen(false);
        }}
      />
      <AdminReviewDetailDialog
        review={viewing}
        onOpenChange={(open) => {
          if (!open) setViewing(null);
        }}
      />
      <DeleteReviewDialog
        review={deleting}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Admin Review Card
// ---------------------------------------------------------------------------

function AdminReviewCard({
  review,
  onView,
  onDelete,
}: {
  review: PerformanceReview;
  onView: () => void;
  onDelete: () => void;
}) {
  return (
    <Card className="transition-colors hover:bg-muted/30">
      <CardContent className="flex flex-wrap items-center gap-4 p-4 sm:p-6">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-heading text-lg font-semibold text-foreground">
              {review.employee.name}
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
            {review.period} · {review.employee.email}
            {review.overallScore !== undefined && (
              <> · Overall: {review.overallScore.toFixed(1)}/5</>
            )}
          </p>
          {review.goals.length > 0 && (
            <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
              <Target className="size-3" />
              {review.goals.filter((g) => g.status === "completed").length}/
              {review.goals.length} goals completed
            </div>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={onView}>
            <Eye />
            View
          </Button>
          <Button variant="ghost" size="sm" onClick={onDelete} className="text-destructive hover:text-destructive">
            <Trash2 />
            Delete
          </Button>
        </div>
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
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-5 w-20" />
            </div>
            <Skeleton className="h-4 w-48" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Create Review Dialog
// ---------------------------------------------------------------------------

function CreateReviewDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const create = useCreateReview();
  const [employees, setEmployees] = useState<User[]>([]);
  const [loadingEmployees, setLoadingEmployees] = useState(false);

  const [employeeId, setEmployeeId] = useState("");
  const [period, setPeriod] = useState("");
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (open) {
      setEmployeeId("");
      setPeriod("");
      setSubmitted(false);
      // Fetch employees for the select.
      setLoadingEmployees(true);
      api
        .get<{ users: User[] }>("/users", { params: { limit: 200 } })
        .then((res) => setEmployees(res.data.users))
        .catch(() => setEmployees([]))
        .finally(() => setLoadingEmployees(false));
    }
  }, [open]);

  const employeeInvalid = submitted && !employeeId;
  const periodInvalid = submitted && !period.trim();

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    if (!employeeId || !period.trim()) return;

    create.mutate(
      { employeeId, period: period.trim() },
      { onSuccess: () => onOpenChange(false) }
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create performance review</DialogTitle>
          <DialogDescription>
            Schedule a new performance review for an employee. AI will
            automatically generate the review content based on the ratings
            you provide.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="review-employee">Employee</Label>
            <Select
              value={employeeId}
              onValueChange={setEmployeeId}
              disabled={loadingEmployees}
            >
              <SelectTrigger
                id="review-employee"
                className="w-full"
                aria-invalid={employeeInvalid}
              >
                <SelectValue
                  placeholder={
                    loadingEmployees ? "Loading employees…" : "Select an employee"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {employees.map((emp) => (
                  <SelectItem key={emp._id} value={emp._id}>
                    {emp.name} ({emp.email})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {employeeInvalid && (
              <p className="text-xs text-destructive">
                Please select an employee.
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="review-period">Review period</Label>
            <Input
              id="review-period"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              placeholder="e.g. Q1 2026, 2025"
              aria-invalid={periodInvalid}
            />
            {periodInvalid && (
              <p className="text-xs text-destructive">
                Please enter a review period.
              </p>
            )}
          </div>

          {create.isError && (
            <Alert variant="destructive">
              <AlertCircle className="size-4" />
              <AlertTitle>Couldn&apos;t create review</AlertTitle>
              <AlertDescription>{getErrorMessage(create.error)}</AlertDescription>
            </Alert>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={create.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? <LoaderCircle className="animate-spin" /> : <Wand2 />}
              {create.isPending ? "Creating…" : "Create & Generate with AI"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Admin Review Detail Dialog
// ---------------------------------------------------------------------------

function AdminReviewDetailDialog({
  review: initialReview,
  onOpenChange,
}: {
  review: PerformanceReview | null;
  onOpenChange: (open: boolean) => void;
}) {
  const open = initialReview !== null;
  const updateReview = useUpdateReview();
  const updateGoalMut = useUpdateGoal();
  const [review, setReview] = useState<PerformanceReview | null>(null);

  // Keep local state in sync when prop changes (e.g. after mutation).
  useEffect(() => {
    setReview(initialReview);
  }, [initialReview]);

  if (!review) return null;

  function handleUpdate(input: UpdateReviewInput) {
    updateReview.mutate(
      { id: review!._id, input },
      {
        onSuccess: (res) => setReview(res.review),
      }
    );
  }

  function handleGoalUpdate(goalIndex: number, status: string) {
    updateGoalMut.mutate(
      {
        reviewId: review!._id,
        goalIndex,
        input: { status: status as "not_started" | "in_progress" | "completed" },
      },
      {
        onSuccess: (res) => setReview(res.review),
      }
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
          <DialogTitle>
            {review.employee.name} — {review.period}
          </DialogTitle>
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
              <div className="flex items-center gap-0.5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star
                    key={i}
                    className={`size-4 ${
                      i < Math.round(review.overallScore!)
                        ? "fill-yellow-400 text-yellow-400"
                        : "fill-muted text-muted"
                    }`}
                  />
                ))}
              </div>
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
                    <div className="flex items-center gap-0.5">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star
                          key={i}
                          className={`size-3.5 ${
                            i < rating.score
                              ? "fill-yellow-400 text-yellow-400"
                              : "fill-muted text-muted"
                          }`}
                        />
                      ))}
                    </div>
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
                  <Select
                    value={goal.status}
                    onValueChange={(value) => handleGoalUpdate(idx, value)}
                  >
                    <SelectTrigger className="w-36">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="not_started">Not started</SelectItem>
                      <SelectItem value="in_progress">In progress</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Employee Comments */}
        {review.employeeComments && (
          <div className="space-y-2 border-t pt-4">
            <h4 className="text-sm font-medium text-foreground">
              Employee&apos;s Comments
            </h4>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
              {review.employeeComments}
            </p>
            {review.acknowledgedAt && (
              <p className="text-xs text-muted-foreground">
                Acknowledged on {format(new Date(review.acknowledgedAt), "MMM d, yyyy")}
              </p>
            )}
          </div>
        )}

        {/* Status Actions */}
        <div className="flex flex-wrap gap-2 border-t pt-4">
          {review.status === "draft" && (
            <Button
              size="sm"
              onClick={() => handleUpdate({ status: "pending_acknowledgment" })}
              disabled={updateReview.isPending}
            >
              {updateReview.isPending ? (
                <LoaderCircle className="animate-spin" />
              ) : (
                <CheckCircle />
              )}
              Mark as pending acknowledgment
            </Button>
          )}
          {review.status === "acknowledged" && (
            <Button
              size="sm"
              onClick={() => handleUpdate({ status: "completed" })}
              disabled={updateReview.isPending}
            >
              {updateReview.isPending ? (
                <LoaderCircle className="animate-spin" />
              ) : (
                <CheckCircle />
              )}
              Mark as completed
            </Button>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Delete Review Dialog
// ---------------------------------------------------------------------------

function DeleteReviewDialog({
  review,
  onOpenChange,
}: {
  review: PerformanceReview | null;
  onOpenChange: (open: boolean) => void;
}) {
  const open = review !== null;
  const deleteReviewMut = useDeleteReview();

  if (!review) return null;

  function handleDelete() {
    deleteReviewMut.mutate(review!._id, {
      onSuccess: () => onOpenChange(false),
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete performance review</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete the {review.period} review for{' '}
            {review.employee.name}? This action cannot be undone.
          </DialogDescription>
        </DialogHeader>

        {deleteReviewMut.isError && (
          <Alert variant="destructive">
            <AlertCircle className="size-4" />
            <AlertTitle>Couldn&apos;t delete review</AlertTitle>
            <AlertDescription>{getErrorMessage(deleteReviewMut.error)}</AlertDescription>
          </Alert>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={deleteReviewMut.isPending}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={deleteReviewMut.isPending}
          >
            {deleteReviewMut.isPending ? <LoaderCircle className="animate-spin" /> : <Trash2 />}
            {deleteReviewMut.isPending ? "Deleting…" : "Delete review"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
