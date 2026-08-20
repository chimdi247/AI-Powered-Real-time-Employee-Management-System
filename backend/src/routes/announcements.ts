import { Router } from "express";
import {
  createAnnouncement,
  deleteAnnouncement,
  listAnnouncements,
  updateAnnouncement,
} from "../controllers/announcements.js";
import { requireAuth } from "../middlewares/requireAuth.js";
import { requireRole } from "../middlewares/requireRole.js";

const router = Router();

router.use(requireAuth);

// Any authenticated user can read the announcements they're allowed to see
// (employees/heads: their department's; admins: all).
router.get("/", listAnnouncements);

// Heads create/edit within their own department; admins can do everything.
router.post("/", requireRole("head", "admin"), createAnnouncement);
router.patch("/:id", requireRole("head", "admin"), updateAnnouncement);

// Heads cannot delete — admin-only.
router.delete("/:id", requireRole("admin"), deleteAnnouncement);

export default router;
