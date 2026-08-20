import { Router } from "express";
import {
  departmentActivities,
  employeePerformance,
  leaveStatistics,
} from "../controllers/reports.js";
import { requireAuth } from "../middlewares/requireAuth.js";
import { requireRole } from "../middlewares/requireRole.js";

const router = Router();

router.use(requireAuth);
router.use(requireRole("admin"));

router.get("/employee-performance", employeePerformance);
router.get("/leave-statistics", leaveStatistics);
router.get("/department-activities", departmentActivities);

export default router;
