import { Router } from "express";
import {
  createTask,
  deleteTask,
  getTask,
  listTasks,
  myTasks,
  createdTasks,
  reviewTask,
  submitTask,
  updateStatus,
  updateTask,
} from "../controllers/tasks.js";
import { requireAuth } from "../middlewares/requireAuth.js";
import { requireRole } from "../middlewares/requireRole.js";

const router = Router();

router.use(requireAuth);

// Any authenticated user: their own assigned tasks.
router.get("/mine", myTasks);

// Head/admin: tasks they created.
router.get("/created", requireRole("head", "admin"), createdTasks);

// Admin-only: all tasks.
router.get("/", requireRole("admin"), listTasks);

// Any authenticated user (with access): task detail.
router.get("/:id", getTask);

// Admin/creator: update task details.
router.patch("/:id", requireRole("head", "admin"), updateTask);

// Employee (assignee): update task status.
router.patch("/:id/status", updateStatus);

// Employee (assignee): submit completed work.
router.post("/:id/submit", submitTask);

// Head/admin (creator or admin): review a submission.
router.post("/:id/review", requireRole("head", "admin"), reviewTask);

// Head/admin or creator: create a task.
router.post("/", requireRole("head", "admin"), createTask);

// Admin or creator: delete a task.
router.delete("/:id", deleteTask);

export default router;
