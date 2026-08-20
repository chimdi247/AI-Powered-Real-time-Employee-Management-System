import { useEffect, useState, type FormEvent } from "react";
import {
  AlertCircle,
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  Clock,
  FileText,
  LoaderCircle,
  RefreshCw,
  Send,
  XCircle,
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
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  useMyTasks,
  useSubmitTask,
  useUpdateTaskStatus,
} from "@/hooks/use-tasks";
import { usePagination } from "@/hooks/use-pagination";
import { getErrorMessage } from "@/lib/api";
import type { Task, TaskPriority, TaskStatus, TaskStatusFilter } from "@/types";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import type { Route } from "./+types/tasks";

export function meta({}: Route.MetaArgs) {
  return [{ title: "My Tasks | Employee Management System" }];
}

const PAGE_SIZE = 10;

const PRIORITY_META: Record<
  TaskPriority,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  low: { label: "Low", variant: "outline" },
  medium: { label: "Medium", variant: "secondary" },
  high: { label: "High", variant: "default" },
  urgent: { label: "Urgent", variant: "destructive" },
};

const STATUS_META: Record<
  TaskStatus,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  todo: { label: "To Do", variant: "outline" },
  in_progress: { label: "In Progress", variant: "secondary" },
  in_review: { label: "In Review", variant: "default" },
  completed: { label: "Completed", variant: "secondary" },
  rejected: { label: "Rejected", variant: "destructive" },
};

const STATUS_FILTERS: { value: TaskStatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "todo", label: "To Do" },
  { value: "in_progress", label: "In Progress" },
  { value: "in_review", label: "In Review" },
  { value: "completed", label: "Completed" },
  { value: "rejected", label: "Rejected" },
];

/**
 * Employee task management: view assigned tasks, start work, submit for review,
 * and resubmit rejected tasks.
 */
export default function Tasks() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<TaskStatusFilter>("all");
  const { page, setPage, offset, total, setTotal } = usePagination({
    limit: PAGE_SIZE,
    resetKey: `${search}-${statusFilter}`,
  });
  const {
    data,
    isPending,
    isError,
    error,
    refetch,
    isRefetching,
  } = useMyTasks({
    status: statusFilter,
    search: search || undefined,
    limit: PAGE_SIZE,
    offset,
  });
  const tasks = data?.tasks;

  const [submitting, setSubmitting] = useState<Task | null>(null);

  useEffect(() => {
    setTotal(data?.total ?? 0);
  }, [data?.total, setTotal]);

  // Compute stats from the full dataset (first page without status filter)
  const stats = tasks
    ? {
        total: data?.total ?? 0,
        todo: tasks.filter((t) => t.status === "todo").length,
        inProgress: tasks.filter((t) => t.status === "in_progress").length,
        inReview: tasks.filter((t) => t.status === "in_review").length,
        completed: tasks.filter((t) => t.status === "completed").length,
      }
    : null;

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-semibold tracking-tight text-foreground">
            My Tasks
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            View and manage your assigned tasks.
          </p>
        </div>
      </header>

      <div className="mt-8 space-y-6">
        {/* Stats */}
        {stats && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              icon={<ClipboardList className="size-4 text-muted-foreground" />}
              label="To Do"
              value={stats.todo}
            />
            <StatCard
              icon={<Clock className="size-4 text-blue-500" />}
              label="In Progress"
              value={stats.inProgress}
            />
            <StatCard
              icon={<FileText className="size-4 text-amber-500" />}
              label="In Review"
              value={stats.inReview}
            />
            <StatCard
              icon={<CheckCircle2 className="size-4 text-emerald-500" />}
              label="Completed"
              value={stats.completed}
            />
          </div>
        )}

        <div className="space-y-4">
          {/* Status filter tabs */}
          <div className="flex flex-wrap gap-2">
            {STATUS_FILTERS.map((filter) => (
              <Button
                key={filter.value}
                variant={statusFilter === filter.value ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  setStatusFilter(filter.value);
                  setPage(1);
                }}
              >
                {filter.label}
              </Button>
            ))}
          </div>

          {(total > 0 || search !== "" || statusFilter !== "all") && (
            <DataTableSearch
              value={search}
              onValueChange={(value) => {
                setSearch(value);
                setPage(1);
              }}
              placeholder="Search tasks…"
            />
          )}

          {isPending ? (
            <TaskListSkeleton />
          ) : isError ? (
            <Alert variant="destructive">
              <AlertCircle className="size-4" />
              <AlertTitle>Couldn&apos;t load your tasks</AlertTitle>
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
              <Card>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Task</TableHead>
                          <TableHead>Priority</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Due Date</TableHead>
                          <TableHead>Assigned By</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {tasks?.map((task) => (
                          <TaskRow
                            key={task._id}
                            task={task}
                            onSubmit={() => setSubmitting(task)}
                          />
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
              <DataTablePagination
                page={page}
                limit={PAGE_SIZE}
                total={total}
                onPageChange={setPage}
              />
            </>
          ) : search !== "" || statusFilter !== "all" ? (
            <Empty className="py-12">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <ClipboardList />
                </EmptyMedia>
                <EmptyTitle>No matching tasks</EmptyTitle>
                <EmptyDescription>
                  No tasks match your filters. Try a different search or status.
                </EmptyDescription>
              </EmptyHeader>
              <Button
                variant="outline"
                onClick={() => {
                  setSearch("");
                  setStatusFilter("all");
                }}
              >
                Clear filters
              </Button>
            </Empty>
          ) : (
            <Empty className="py-12">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <ClipboardList />
                </EmptyMedia>
                <EmptyTitle>No tasks assigned yet</EmptyTitle>
                <EmptyDescription>
                  Your head or admin will assign tasks to you. Check back later.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
        </div>
      </div>

      <SubmitDialog
        task={submitting}
        onOpenChange={(open) => {
          if (!open) setSubmitting(null);
        }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2">
          {icon}
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
        </div>
        <p className="mt-1 font-heading text-2xl font-semibold tracking-tight text-foreground">
          {value}
        </p>
      </CardContent>
    </Card>
  );
}

function TaskRow({
  task,
  onSubmit,
}: {
  task: Task;
  onSubmit: () => void;
}) {
  const startStatus = useUpdateTaskStatus();
  const isOverdue =
    task.dueDate &&
    task.status !== "completed" &&
    new Date(task.dueDate) < new Date();

  function handleStart() {
    startStatus.mutate({ id: task._id, status: "in_progress" });
  }

  return (
    <TableRow>
      <TableCell>
        <div className="min-w-0">
          <p className="font-medium">{task.title}</p>
          {task.description && (
            <p className="max-w-xs truncate text-xs text-muted-foreground">
              {task.description}
            </p>
          )}
        </div>
      </TableCell>
      <TableCell>
        <Badge variant={PRIORITY_META[task.priority].variant}>
          {PRIORITY_META[task.priority].label}
        </Badge>
      </TableCell>
      <TableCell>
        <Badge variant={STATUS_META[task.status].variant}>
          {STATUS_META[task.status].label}
        </Badge>
      </TableCell>
      <TableCell>
        {task.dueDate ? (
          <span
            className={`text-sm ${isOverdue ? "font-medium text-destructive" : "text-muted-foreground"}`}
          >
            {new Date(task.dueDate).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
            {isOverdue && " (overdue)"}
          </span>
        ) : (
          <span className="text-sm text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">
        {task.assignedBy.name}
      </TableCell>
      <TableCell>
        <div className="flex justify-end gap-1">
          {task.status === "todo" && (
            <Button variant="ghost" size="sm" onClick={handleStart} disabled={startStatus.isPending}>
              <Clock />
              Start
            </Button>
          )}
          {(task.status === "in_progress" || task.status === "rejected") && (
            <Button variant="ghost" size="sm" onClick={onSubmit}>
              <Send />
              Submit
            </Button>
          )}
          {task.status === "in_review" && (
            <span className="text-xs text-muted-foreground">Awaiting review</span>
          )}
          {task.status === "completed" && (
            <span className="flex items-center gap-1 text-xs text-emerald-600">
              <CheckCircle2 className="size-3.5" />
              Done
            </span>
          )}
        </div>
      </TableCell>
    </TableRow>
  );
}

function TaskListSkeleton() {
  return (
    <Card aria-busy="true" aria-label="Loading tasks">
      <CardContent className="space-y-4 p-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="flex items-center gap-3">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-5 w-16" />
            <Skeleton className="h-5 w-20" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-20" />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Submit dialog
// ---------------------------------------------------------------------------

function SubmitDialog({
  task,
  onOpenChange,
}: {
  task: Task | null;
  onOpenChange: (open: boolean) => void;
}) {
  const submit = useSubmitTask();
  const [notes, setNotes] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const open = task !== null;

  useEffect(() => {
    if (open) {
      setNotes("");
      setSubmitted(false);
    }
  }, [open]);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitted(true);
    if (!task) return;

    submit.mutate(
      { id: task._id, input: { submissionNotes: notes.trim() || undefined } },
      { onSuccess: () => onOpenChange(false) }
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Submit task for review</DialogTitle>
          <DialogDescription>
            Submit &ldquo;{task?.title}&rdquo; for your head or admin to review.
            Add any notes about your work.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          <div className="space-y-1.5">
            <label
              htmlFor="submission-notes"
              className="text-sm font-medium text-foreground"
            >
              Submission notes (optional)
            </label>
            <Textarea
              id="submission-notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Describe what you did, any notes for the reviewer…"
              rows={4}
            />
          </div>

          {submit.isError && (
            <Alert variant="destructive">
              <AlertCircle className="size-4" />
              <AlertTitle>Submission failed</AlertTitle>
              <AlertDescription>{getErrorMessage(submit.error)}</AlertDescription>
            </Alert>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submit.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submit.isPending}>
              {submit.isPending ? (
                <LoaderCircle className="animate-spin" />
              ) : (
                <Send />
              )}
              {submit.isPending ? "Submitting…" : "Submit for review"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
