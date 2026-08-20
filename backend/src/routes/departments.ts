import { Router } from "express";
import {
  createDepartment,
  deleteDepartment,
  getDepartment,
  listDepartments,
  myDepartment,
  setDepartmentEmployees,
  updateDepartment,
} from "../controllers/departments.js";
import { requireAuth } from "../middlewares/requireAuth.js";
import { requireRole } from "../middlewares/requireRole.js";

const router = Router();

router.use(requireAuth);

// Any authenticated user can read their own department.
// NOTE: must be registered before `/:id` so "mine" isn't parsed as an ObjectId.
router.get("/mine", myDepartment);

// Admin-only: CRUD + employee assignment.
router.post("/", requireRole("admin"), createDepartment);
router.get("/", requireRole("admin"), listDepartments);
router.get("/:id", requireRole("admin"), getDepartment);
router.patch("/:id", requireRole("admin"), updateDepartment);
router.delete("/:id", requireRole("admin"), deleteDepartment);
router.put("/:id/employees", requireRole("admin"), setDepartmentEmployees);

export default router;
