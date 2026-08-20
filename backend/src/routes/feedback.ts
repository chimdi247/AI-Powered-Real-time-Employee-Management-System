import { Router } from "express";
import {
  createFeedback,
  listFeedback,
  myFeedback,
  updateFeedback,
} from "../controllers/feedback.js";
import { requireAuth } from "../middlewares/requireAuth.js";
import { requireRole } from "../middlewares/requireRole.js";

const router = Router();

router.use(requireAuth);

// Any authenticated user can submit feedback and track their own submissions.
router.post("/", createFeedback);
router.get("/mine", myFeedback);

// Admin-only: see everything and respond/resolve/reopen.
router.get("/", requireRole("admin"), listFeedback);
router.patch("/:id", requireRole("admin"), updateFeedback);

export default router;
