import { Router } from "express";
import { listActivityLogs } from "../controllers/activityLogs.js";
import { requireAuth } from "../middlewares/requireAuth.js";
import { requireRole } from "../middlewares/requireRole.js";

const router = Router();

// Admin-only: the activity log is an audit trail, never visible to employees.
router.get("/", requireAuth, requireRole("admin"), listActivityLogs);

export default router;
