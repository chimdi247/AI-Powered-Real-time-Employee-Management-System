import { Router } from "express";
import {
  acknowledgeReview,
  createReview,
  deleteReview,
  getReview,
  listReviews,
  myReviews,
  updateGoal,
  updateReview,
} from "../controllers/performanceReviews.js";
import { requireAuth } from "../middlewares/requireAuth.js";
import { requireRole } from "../middlewares/requireRole.js";

const router = Router();

router.use(requireAuth);

// Any authenticated employee: view their own reviews.
router.get("/mine", myReviews);

// Employee acknowledges their own review.
router.post("/:id/acknowledge", acknowledgeReview);

// Admin and head: create, list, update reviews and manage goals.
router.post("/", requireRole("admin", "head"), createReview);
router.get("/", requireRole("admin", "head"), listReviews);
router.get("/:id", getReview);
router.patch("/:id", requireRole("admin", "head"), updateReview);
router.patch(
  "/:id/goals/:goalIndex",
  requireRole("admin", "head"),
  updateGoal
);

// Admin only: delete a review.
router.delete("/:id", requireRole("admin"), deleteReview);

export default router;
