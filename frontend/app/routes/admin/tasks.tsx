import { useEffect, useState, type FormEvent } from "react";
import {
  AlertCircle,
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  Clock,
  FileText,
  LoaderCircle,
  Pencil,
  Plus,
  RefreshCw,
  Send,
  Trash2,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import {
  useCreateTask,
  useDeleteTask,
  useReviewTask,
  useTasks,
  useUpdateTask,
} from "@/hooks/use-tasks";
import { usePagination } from "@/hooks/use-pagination";
import { useUsers } from "@/hooks/use-users";
import { useCurrentUser } from "@/hooks/use-auth";
import { getErrorMessage } from "@/lib/api";
import type {
  Task,
  TaskInput,
  TaskPriority,
  TaskStatus,
  TaskStatusFilter,
  TaskUpdateInput,
} from "@/types";

import type { Route } from "./+types/tasks";

export function meta({}: Route.MetaArgs) {
  return [{ title: "Task Management | Employee Management System" }];
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

const PRIORITY_OPTIONS: { value: TaskPriority; label: string }[] = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" },
];

/**
 * Admin/head task management: create tasks, assign to employees,
 * review submissions, and track overall progress.
 */
export default function AdminTasks() {
  const { data: currentUser } = useCurrentUser();
  const isAdmin = currentUser?.role === "admin";

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
  } = useTasks({
    status: statusFilter,
    search: search || undefined,
    limit: PAGE_SIZE,
    offset,
  });
  const tasks = data?.tasks;

  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [reviewing, setReviewing] = useState<Task | null>(null);
  const [deleting, setDeleting] = useState<Task | null>(null);

  useEffect(() => {
    setTotal(data?.total ?? 0);
  }, [data?.total, setTotal]);

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
            Task Management
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {isAdmin
              ? "Assign tasks, track progress, and review submissions."
              : "Assign tasks to your department members and review their work."}
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus />
          Assign task
        </Button>
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
              placeholder="Search tasks or assignees…"
            />
          )}

          {isPending ? (
            <TaskListSkeleton />
          ) : isError ? (
            <Alert variant="destructive">
              <AlertCircle className="size-4" />
              <AlertTitle>Couldn&apos;t load tasks</AlertTitle>
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
                          <TableHead>Assigned To</TableHead>
                          <TableHead>Priority</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Due Date</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {tasks?.map((task) => (
                          <TaskRow
                            key={task._id}
                            task={task}
                            onEdit={() => setEditing(task)}
                            onReview={() => setReviewing(task)}
                            onDelete={() => setDeleting(task)}
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
                <EmptyTitle>No tasks yet</EmptyTitle>
                <EmptyDescription>
                  Create your first task to get started.
                </EmptyDescription>
              </EmptyHeader>
              <Button onClick={() => setCreateOpen(true)}>
                <Plus />
                Assign task
              </Button>
            </Empty>
          )}
        </div>
      </div>

      <CreateTaskDialog
        open={createOpen}
        onOpenChange={(open) => {
          if (!open) setCreateOpen(false);
        }}
        isAdmin={isAdmin}
      />
      <EditTaskDialog
        task={editing}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
        isAdmin={isAdmin}
      />
      <ReviewDialog
        task={reviewing}
        onOpenChange={(open) => {
          if (!open) setReviewing(null);
        }}
      />
      <DeleteDialog
        task={deleting}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
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
  onEdit,
  onReview,
  onDelete,
}: {
  task: Task;
  onEdit: () => void;
  onReview: () => void;
  onDelete: () => void;
}) {
  const isOverdue =
    task.dueDate &&
    task.status !== "completed" &&
    new Date(task.dueDate) < new Date();

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
      <TableCell className="text-sm text-muted-foreground">
        {task.assignedTo.name}
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
      <TableCell>
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="icon-sm" onClick={onEdit} aria-label={`Edit ${task.title}`}>
            <Pencil />
          </Button>
          {task.status === "in_review" && (
            <Button variant="ghost" size="sm" onClick={onReview}>
              <ClipboardCheck />
              Review
            </Button>
          )}
          <Button variant="ghost" size="icon-sm" onClick={onDelete} aria-label={`Delete ${task.title}`}>
            <Trash2 />
          </Button>
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
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-5 w-16" />
            <Skeleton className="h-5 w-20" />
            <Skeleton className="h-4 w-24" />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Create task dialog
// ---------------------------------------------------------------------------

function CreateTaskDialog({
  open,
  onOpenChange,
  isAdmin,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isAdmin: boolean;
}) {
  const create = useCreateTask();
  const { data: usersData, isPending: usersPending } = useUsers();
  const users = usersData?.users;

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [assignedTo, setAssignedTo] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [dueDate, setDueDate] = useState("");
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (open) {
      setTitle("");
      setDescription("");
      setAssignedTo("");
      setPriority("medium");
      setDueDate("");
      setSubmitted(false);
    }
  }, [open]);

  const titleInvalid = submitted && title.trim() === "";
  const assigneeInvalid = submitted && assignedTo === "";
  const today = new Date().toISOString().slice(0, 10);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitted(true);
    if (!title.trim() || !assignedTo) return;

    const input: TaskInput = {
      title: title.trim(),
      description: description.trim() || undefined,
      assignedTo,
      priority,
      dueDate: dueDate || undefined,
    };

    create.mutate(input, { onSuccess: () => onOpenChange(false) });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Assign a task</DialogTitle>
          <DialogDescription>
            Create a new task and assign it to a team member.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="task-title">Title</Label>
            <Input
              id="task-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="e.g. Review Q2 report"
              autoFocus
              aria-invalid={titleInvalid}
              aria-describedby={titleInvalid ? "task-title-error" : undefined}
            />
            {titleInvalid && (
              <p id="task-title-error" className="text-xs text-destructive">
                Title is required.
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="task-description">Description</Label>
            <Textarea
              id="task-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="What needs to be done?"
              rows={3}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="task-assignee">Assign to</Label>
            {usersPending ? (
              <Skeleton className="h-10 w-full" />
            ) : (
              <>
                <Select value={assignedTo} onValueChange={(value) => setAssignedTo(value ?? "")}>
                  <SelectTrigger
                    id="task-assignee"
                    className="w-full"
                    aria-invalid={assigneeInvalid}
                    aria-describedby={assigneeInvalid ? "task-assignee-error" : undefined}
                  >
                    <SelectValue placeholder="Select a team member" />
                  </SelectTrigger>
                  <SelectContent>
                    {users?.map((user) => (
                      <SelectItem key={user._id} value={user._id}>
                        {user.name} ({user.email})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {assigneeInvalid && (
                  <p id="task-assignee-error" className="text-xs text-destructive">
                    Please select a team member.
                  </p>
                )}
              </>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="task-priority">Priority</Label>
              <Select value={priority} onValueChange={(value) => setPriority(value as TaskPriority)}>
                <SelectTrigger id="task-priority" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITY_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="task-due-date">Due date</Label>
              <Input
                id="task-due-date"
                type="date"
                value={dueDate}
                onChange={(event) => setDueDate(event.target.value)}
                min={today}
              />
            </div>
          </div>

          {create.isError && (
            <Alert variant="destructive">
              <AlertCircle className="size-4" />
              <AlertTitle>Couldn&apos;t create task</AlertTitle>
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
              {create.isPending ? (
                <LoaderCircle className="animate-spin" />
              ) : (
                <Send />
              )}
              {create.isPending ? "Assigning…" : "Assign task"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Edit task dialog
// ---------------------------------------------------------------------------

function EditTaskDialog({
  task,
  onOpenChange,
  isAdmin,
}: {
  task: Task | null;
  onOpenChange: (open: boolean) => void;
  isAdmin: boolean;
}) {
  const update = useUpdateTask();
  const { data: usersData, isPending: usersPending } = useUsers();
  const users = usersData?.users;
  const open = task !== null;

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [assignedTo, setAssignedTo] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [dueDate, setDueDate] = useState("");
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (open && task) {
      setTitle(task.title);
      setDescription(task.description ?? "");
      setAssignedTo(task.assignedTo._id);
      setPriority(task.priority);
      setDueDate(task.dueDate ? task.dueDate.slice(0, 10) : "");
      setSubmitted(false);
    }
  }, [open, task]);

  const titleInvalid = submitted && title.trim() === "";
  const assigneeInvalid = submitted && assignedTo === "";
  const today = new Date().toISOString().slice(0, 10);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitted(true);
    if (!task || !title.trim() || !assignedTo) return;

    const input: TaskUpdateInput = {
      title: title.trim(),
      description: description.trim() || undefined,
      assignedTo,
      priority,
      dueDate: dueDate || undefined,
    };

    update.mutate({ id: task._id, input }, { onSuccess: () => onOpenChange(false) });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit task</DialogTitle>
          <DialogDescription>
            Update the details for &ldquo;{task?.title}&rdquo;.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="edit-task-title">Title</Label>
            <Input
              id="edit-task-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="e.g. Review Q2 report"
              autoFocus
              aria-invalid={titleInvalid}
              aria-describedby={titleInvalid ? "edit-task-title-error" : undefined}
            />
            {titleInvalid && (
              <p id="edit-task-title-error" className="text-xs text-destructive">
                Title is required.
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="edit-task-description">Description</Label>
            <Textarea
              id="edit-task-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="What needs to be done?"
              rows={3}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="edit-task-assignee">Assign to</Label>
            {usersPending ? (
              <Skeleton className="h-10 w-full" />
            ) : (
              <>
                <Select value={assignedTo} onValueChange={(value) => setAssignedTo(value ?? "")}>
                  <SelectTrigger
                    id="edit-task-assignee"
                    className="w-full"
                    aria-invalid={assigneeInvalid}
                    aria-describedby={assigneeInvalid ? "edit-task-assignee-error" : undefined}
                  >
                    <SelectValue placeholder="Select a team member" />
                  </SelectTrigger>
                  <SelectContent>
                    {users?.map((user) => (
                      <SelectItem key={user._id} value={user._id}>
                        {user.name} ({user.email})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {assigneeInvalid && (
                  <p id="edit-task-assignee-error" className="text-xs text-destructive">
                    Please select a team member.
                  </p>
                )}
              </>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="edit-task-priority">Priority</Label>
              <Select value={priority} onValueChange={(value) => setPriority(value as TaskPriority)}>
                <SelectTrigger id="edit-task-priority" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITY_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-task-due-date">Due date</Label>
              <Input
                id="edit-task-due-date"
                type="date"
                value={dueDate}
                onChange={(event) => setDueDate(event.target.value)}
                min={today}
              />
            </div>
          </div>

          {update.isError && (
            <Alert variant="destructive">
              <AlertCircle className="size-4" />
              <AlertTitle>Couldn&apos;t update task</AlertTitle>
              <AlertDescription>{getErrorMessage(update.error)}</AlertDescription>
            </Alert>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={update.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={update.isPending}>
              {update.isPending ? (
                <LoaderCircle className="animate-spin" />
              ) : (
                <Pencil />
              )}
              {update.isPending ? "Saving…" : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Review dialog
// ---------------------------------------------------------------------------

function ReviewDialog({
  task,
  onOpenChange,
}: {
  task: Task | null;
  onOpenChange: (open: boolean) => void;
}) {
  const review = useReviewTask();
  const [decision, setDecision] = useState<"approved" | "rejected">("approved");
  const [notes, setNotes] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const open = task !== null;

  useEffect(() => {
    if (open) {
      setDecision("approved");
      setNotes("");
      setSubmitted(false);
    }
  }, [open]);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitted(true);
    if (!task) return;

    review.mutate(
      {
        id: task._id,
        input: { decision, reviewNotes: notes.trim() || undefined },
      },
      { onSuccess: () => onOpenChange(false) }
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Review task submission</DialogTitle>
          <DialogDescription>
            Review the submission for &ldquo;{task?.title}&rdquo; by{" "}
            {task?.assignedTo.name}.
          </DialogDescription>
        </DialogHeader>

        {task?.submissionNotes && (
          <div className="rounded-lg border border-border bg-muted/50 p-3">
            <p className="text-xs font-medium text-muted-foreground">Submission notes</p>
            <p className="mt-1 text-sm text-foreground">{task.submissionNotes}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          <div className="space-y-1.5">
            <Label>Decision</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={decision === "approved" ? "default" : "outline"}
                size="sm"
                onClick={() => setDecision("approved")}
              >
                <CheckCircle2 />
                Approve
              </Button>
              <Button
                type="button"
                variant={decision === "rejected" ? "destructive" : "outline"}
                size="sm"
                onClick={() => setDecision("rejected")}
              >
                <XCircle />
                Reject
              </Button>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="review-notes">Review notes (optional)</Label>
            <Textarea
              id="review-notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder={
                decision === "approved"
                  ? "Any feedback on the completed work?"
                  : "What needs to be changed?"
              }
              rows={3}
            />
          </div>

          {review.isError && (
            <Alert variant="destructive">
              <AlertCircle className="size-4" />
              <AlertTitle>Review failed</AlertTitle>
              <AlertDescription>{getErrorMessage(review.error)}</AlertDescription>
            </Alert>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={review.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant={decision === "rejected" ? "destructive" : "default"}
              disabled={review.isPending}
            >
              {review.isPending ? (
                <LoaderCircle className="animate-spin" />
              ) : decision === "approved" ? (
                <CheckCircle2 />
              ) : (
                <XCircle />
              )}
              {review.isPending
                ? "Submitting…"
                : decision === "approved"
                  ? "Approve task"
                  : "Reject task"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Delete dialog
// ---------------------------------------------------------------------------

function DeleteDialog({
  task,
  onOpenChange,
}: {
  task: Task | null;
  onOpenChange: (open: boolean) => void;
}) {
  const del = useDeleteTask();
  const open = task !== null;

  function handleDelete() {
    if (!task) return;
    del.mutate(task._id, { onSuccess: () => onOpenChange(false) });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete task?</DialogTitle>
          <DialogDescription>
            &ldquo;{task?.title}&rdquo; will be permanently deleted. This can&apos;t
            be undone.
          </DialogDescription>
        </DialogHeader>

        {del.isError && (
          <Alert variant="destructive">
            <AlertCircle className="size-4" />
            <AlertTitle>Couldn&apos;t delete task</AlertTitle>
            <AlertDescription>{getErrorMessage(del.error)}</AlertDescription>
          </Alert>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={del.isPending}
          >
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleDelete} disabled={del.isPending}>
            {del.isPending ? <LoaderCircle className="animate-spin" /> : <Trash2 />}
            {del.isPending ? "Deleting…" : "Delete task"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
