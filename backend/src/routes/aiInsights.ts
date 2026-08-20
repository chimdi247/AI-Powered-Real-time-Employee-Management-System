import { Router } from "express";
import {
  deleteInsight,
  generateInsight,
  getInsight,
  listInsights,
} from "../controllers/aiInsights.js";
import { requireAuth } from "../middlewares/requireAuth.js";
import { requireRole } from "../middlewares/requireRole.js";

const router = Router();

router.use(requireAuth);
router.use(requireRole("admin", "head"));

router.post("/generate", generateInsight);
router.get("/", listInsights);
router.get("/:id", getInsight);
router.delete("/:id", requireRole("admin"), deleteInsight);

export default router;
