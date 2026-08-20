import { Router } from "express";
import { getDashboardAnalytics, getEmployeeDashboard } from "../controllers/dashboard.js";
import { requireAuth } from "../middlewares/requireAuth.js";
import { requireRole } from "../middlewares/requireRole.js";

const router = Router();

router.use(requireAuth);

// Employee: personal dashboard (no role restriction).
router.get("/my", getEmployeeDashboard);

// Admin/head: org-wide analytics.
router.get("/analytics", requireRole("admin", "head"), getDashboardAnalytics);

export default router;
