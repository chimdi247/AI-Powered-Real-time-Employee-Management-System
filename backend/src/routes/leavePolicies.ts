import { Router } from "express";
import { listPolicies, updatePolicy } from "../controllers/leavePolicies.js";
import { requireAuth } from "../middlewares/requireAuth.js";
import { requireRole } from "../middlewares/requireRole.js";

const router = Router();

// Admin-only: leave policies shape entitlements and request limits.
router.use(requireAuth, requireRole("admin"));

router.get("/", listPolicies);
router.patch("/:type", updatePolicy);

export default router;
