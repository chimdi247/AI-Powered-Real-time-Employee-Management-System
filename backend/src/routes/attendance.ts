import { Router } from "express";
import {
  attendanceStats,
  departmentAttendance,
  getAttendance,
  markAttendance,
  myAttendance,
  updateAttendance,
} from "../controllers/attendance.js";
import { requireAuth } from "../middlewares/requireAuth.js";
import { requireRole } from "../middlewares/requireRole.js";

const router = Router();

router.use(requireAuth);

// Any authenticated user: their own attendance records.
router.get("/mine", myAttendance);

// Head or admin: mark attendance for department members.
router.post("/", requireRole("head", "admin"), markAttendance);

// Head or admin: department attendance overview.
router.get("/department", requireRole("head", "admin"), departmentAttendance);

// Admin-only: attendance statistics and reports.
router.get("/stats", requireRole("admin"), attendanceStats);

// Any authenticated user: single record detail.
router.get("/:id", getAttendance);

// Head or admin: update an existing attendance record.
router.patch("/:id", requireRole("head", "admin"), updateAttendance);

export default router;
