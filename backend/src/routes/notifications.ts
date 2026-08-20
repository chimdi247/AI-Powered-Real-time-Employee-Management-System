import { Router } from "express";
import {
  listNotifications,
  markAllAsRead,
  markAsRead,
  streamNotifications,
  unreadCount,
} from "../controllers/notifications.js";
import { requireAuth } from "../middlewares/requireAuth.js";

const router = Router();

router.use(requireAuth);

// List notifications (paginated).
router.get("/", listNotifications);

// Unread count for the badge.
router.get("/unread-count", unreadCount);

// SSE stream for real-time push.
router.get("/stream", streamNotifications);

// Mark a single notification as read.
router.patch("/:id/read", markAsRead);

// Mark all notifications as read.
router.post("/read-all", markAllAsRead);

export default router;
