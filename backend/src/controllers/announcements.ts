import type { Request, Response } from "express";
import mongoose from "mongoose";
import { logActivity } from "../lib/activityLog.js";
import { notifyBatch } from "../lib/notifications.js";
import { isDuplicateKeyError } from "../lib/errors.js";
import { parsePagination, searchRegex } from "../lib/pagination.js";
import { pushToUsers, createEvent } from "../lib/sse.js";
import { Announcement } from "../models/Announcement.js";
import type { IAnnouncement } from "../models/Announcement.js";
import { Department } from "../models/Department.js";

const AUTHOR_SELECT = "name";
const DEPARTMENT_SELECT = "name";

interface AnnouncementBody {
  title?: unknown;
  body?: unknown;
  department?: unknown;
}

function isInvalidObjectId(id: string): boolean {
  return !mongoose.isValidObjectId(id);
}

/** Express 5 types params as `string | string[] | undefined` — normalize to a single id. */
function paramId(req: Request): string | undefined {
  const id = req.params.id;
  return typeof id === "string" ? id : undefined;
}

async function getAnnouncementOr404(req: Request, res: Response): Promise<IAnnouncement | undefined> {
  const id = paramId(req);
  if (!id || isInvalidObjectId(id)) {
    res.status(404).json({ error: "Announcement not found" });
    return undefined;
  }
  const announcement = await Announcement.findById(id);
  if (!announcement) {
    res.status(404).json({ error: "Announcement not found" });
    return undefined;
  }
  return announcement;
}

/**
 * Any authenticated user: lists announcements they can see.
 * - Employee/head: their own department's announcements.
 * - Admin: every announcement.
 * Optional search (title/body) + pagination.
 */
export async function listAnnouncements(req: Request, res: Response): Promise<void> {
  const user = req.user!;
  const { limit, offset } = parsePagination(req);
  const search = searchRegex(req.query.search);

  const filter: Record<string, unknown> = {};
  if (user.role !== "admin") {
    if (!user.department) {
      res.json({ announcements: [], total: 0, limit, offset });
      return;
    }
    filter.department = user.department;
  }
  if (search) {
    filter.$or = [{ title: search }, { body: search }];
  }

  let query = Announcement.find(filter)
    .populate("author", AUTHOR_SELECT)
    .populate("department", DEPARTMENT_SELECT)
    .sort({ createdAt: -1 });
  if (limit !== null) {
    query = query.skip(offset).limit(limit);
  }

  const [announcements, total] = await Promise.all([query, Announcement.countDocuments(filter)]);
  res.json({ announcements: announcements.map((item) => item.toJSON()), total, limit, offset });
}

/** Head or admin: creates an announcement. Heads post to their own department; admins pick one. */
export async function createAnnouncement(req: Request, res: Response): Promise<void> {
  const user = req.user!;
  const { title, body, department } = (req.body ?? {}) as AnnouncementBody;

  if (typeof title !== "string" || !title.trim()) {
    res.status(400).json({ error: "title is required" });
    return;
  }
  if (typeof body !== "string" || !body.trim()) {
    res.status(400).json({ error: "body is required" });
    return;
  }

  let departmentId: mongoose.Types.ObjectId;
  if (user.role === "admin") {
    if (typeof department !== "string" || isInvalidObjectId(department)) {
      res.status(400).json({ error: "department must be a valid id" });
      return;
    }
    departmentId = new mongoose.Types.ObjectId(department);
  } else {
    // Heads post to their own department only — a head without one can't post.
    if (!user.department) {
      res.status(400).json({ error: "You must be assigned to a department to create announcements" });
      return;
    }
    departmentId = user.department;
  }

  const departmentDoc = await Department.findById(departmentId);
  if (!departmentDoc) {
    res.status(404).json({ error: "Department not found" });
    return;
  }

  const announcement = await Announcement.create({
    title: title.trim(),
    body: body.trim(),
    department: departmentId,
    author: user._id,
  });

  logActivity({
    action: "announcement_created",
    actor: user,
    targetType: "announcement",
    targetId: announcement._id,
    targetName: announcement.title,
    details: { department: departmentDoc.name },
    ip: req.ip,
  });

  // Notify all members of the department about the new announcement.
  // Import User here to avoid circular dependency issues at module level.
  const { User } = await import("../models/User.js");
  const departmentMembers = await User.find({ department: departmentId }).select("_id");
  const recipientIds = departmentMembers
    .map((member) => member._id)
    .filter((id) => !id.equals(user._id)); // Don't notify the author themselves.
  if (recipientIds.length > 0) {
    notifyBatch(recipientIds, {
      actor: user,
      type: "announcement_created",
      title: "New announcement",
      message: `A new announcement \"${announcement.title}\" has been posted in your department.`,
      link: "/announcements",
      data: {
        announcementTitle: announcement.title,
        announcementBody: announcement.body,
        departmentName: departmentDoc.name,
      },
    });

    // Real-time SSE push to department members
    pushToUsers(
      recipientIds.map((id) => id.toString()),
      createEvent("announcement-new", {
        announcementId: announcement._id,
        title: announcement.title,
        department: departmentDoc.name,
        author: user.name,
      })
    );
  }

  const populated = await announcement.populate([
    { path: "author", select: AUTHOR_SELECT },
    { path: "department", select: DEPARTMENT_SELECT },
  ]);
  res.status(201).json({ announcement: populated.toJSON() });
}

/** Head or admin: updates an announcement. Heads may only edit their own department's. */
export async function updateAnnouncement(req: Request, res: Response): Promise<void> {
  const announcement = await getAnnouncementOr404(req, res);
  if (!announcement) return;
  const user = req.user!;

  const { title, body, department } = (req.body ?? {}) as AnnouncementBody;

  const hasAnyField = title !== undefined || body !== undefined || department !== undefined;
  if (!hasAnyField) {
    res.status(400).json({ error: "At least one field to update is required" });
    return;
  }

  if (user.role !== "admin") {
    // Heads can only edit announcements in their own department.
    if (!user.department || !announcement.department.equals(user.department)) {
      res.status(403).json({ error: "You can only edit announcements in your own department" });
      return;
    }
    if (department !== undefined) {
      res.status(400).json({ error: "Heads cannot move an announcement to another department" });
      return;
    }
  }

  if (title !== undefined && (typeof title !== "string" || !title.trim())) {
    res.status(400).json({ error: "title is required" });
    return;
  }
  if (body !== undefined && (typeof body !== "string" || !body.trim())) {
    res.status(400).json({ error: "body is required" });
    return;
  }

  const changed: string[] = [];
  if (title !== undefined) {
    announcement.title = title.trim();
    changed.push("title");
  }
  if (body !== undefined) {
    announcement.body = body.trim();
    changed.push("body");
  }
  if (department !== undefined && user.role === "admin") {
    if (typeof department !== "string" || isInvalidObjectId(department)) {
      res.status(400).json({ error: "department must be a valid id" });
      return;
    }
    const departmentDoc = await Department.findById(department);
    if (!departmentDoc) {
      res.status(404).json({ error: "Department not found" });
      return;
    }
    announcement.department = new mongoose.Types.ObjectId(department);
    changed.push("department");
  }

  try {
    await announcement.save();
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      res.status(409).json({ error: "Duplicate value already exists" });
      return;
    }
    throw error;
  }

  logActivity({
    action: "announcement_updated",
    actor: user,
    targetType: "announcement",
    targetId: announcement._id,
    targetName: announcement.title,
    details: { changed },
    ip: req.ip,
  });

  // Real-time SSE push to department members
  const { User } = await import("../models/User.js");
  const departmentMembers = await User.find({ department: announcement.department }).select("_id");
  const recipientIds = departmentMembers
    .map((member) => member._id)
    .filter((id) => !id.equals(user._id));
  if (recipientIds.length > 0) {
    pushToUsers(
      recipientIds.map((id) => id.toString()),
      createEvent("announcement-new", {
        announcementId: announcement._id,
        title: announcement.title,
        action: "updated",
        author: user.name,
      })
    );
  }

  const populated = await announcement.populate([
    { path: "author", select: AUTHOR_SELECT },
    { path: "department", select: DEPARTMENT_SELECT },
  ]);
  res.json({ announcement: populated.toJSON() });
}

/** Admin-only: deletes an announcement (heads cannot delete — enforced here as well as in the route). */
export async function deleteAnnouncement(req: Request, res: Response): Promise<void> {
  const announcement = await getAnnouncementOr404(req, res);
  if (!announcement) return;
  const user = req.user!;

  if (user.role !== "admin") {
    res.status(403).json({ error: "Only admins can delete announcements" });
    return;
  }

  // Snapshot the target BEFORE removal so the audit trail stays meaningful.
  const deletedId = announcement._id;
  const deletedTitle = announcement.title;

  await announcement.deleteOne();

  logActivity({
    action: "announcement_deleted",
    actor: user,
    targetType: "announcement",
    targetId: deletedId,
    targetName: deletedTitle,
    ip: req.ip,
  });

  // Real-time SSE push to department members
  const { User } = await import("../models/User.js");
  const departmentMembers = await User.find({ department: announcement.department }).select("_id");
  const recipientIds = departmentMembers
    .map((member) => member._id)
    .filter((id) => !id.equals(user._id));
  if (recipientIds.length > 0) {
    pushToUsers(
      recipientIds.map((id) => id.toString()),
      createEvent("announcement-new", {
        announcementId: deletedId,
        title: deletedTitle,
        action: "deleted",
        author: user.name,
      })
    );
  }

  res.json({ message: "Announcement deleted" });
}
