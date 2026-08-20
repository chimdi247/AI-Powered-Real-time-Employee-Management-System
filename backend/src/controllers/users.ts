import type { Request, Response } from "express";
import mongoose from "mongoose";
import { logActivity } from "../lib/activityLog.js";
import { isDuplicateKeyError } from "../lib/errors.js";
import { parsePagination, searchRegex } from "../lib/pagination.js";
import type { IUser } from "../models/User.js";
import { User } from "../models/User.js";

interface CreateUserBody {
  name?: string;
  email?: string;
  password?: string;
  role?: "admin" | "employee" | "head";
  department?: string | null;
}

interface UpdateUserBody {
  name?: string;
  email?: string;
  role?: "admin" | "employee" | "head";
  department?: string | null;
  password?: string;
}

interface UpdateMeBody {
  name?: string;
  currentPassword?: string;
  password?: string;
}

function isInvalidObjectId(id: string): boolean {
  return !mongoose.isValidObjectId(id);
}

/** Express 5 types params as `string | string[] | undefined` — normalize to a single id. */
function paramId(req: Request): string | undefined {
  const id = req.params.id;
  return typeof id === "string" ? id : undefined;
}

async function getUserOr404(req: Request, res: Response): Promise<IUser | undefined> {
  const id = paramId(req);
  if (!id || isInvalidObjectId(id)) {
    res.status(404).json({ error: "User not found" });
    return undefined;
  }
  const user = await User.findById(id);
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return undefined;
  }
  return user;
}

/** Admin-only: lists users with optional search and pagination (e.g. to assign employees to departments). */
export async function listUsers(req: Request, res: Response): Promise<void> {
  const { limit, offset } = parsePagination(req);
  const search = searchRegex(req.query.search);

  const filter: Record<string, unknown> = {};
  if (search) {
    filter.$or = [{ name: search }, { email: search }];
  }

  let query = User.find(filter).sort({ name: 1 });
  if (limit !== null) {
    query = query.skip(offset).limit(limit);
  }

  const [users, total] = await Promise.all([query, User.countDocuments(filter)]);

  res.json({
    users: users.map((user) => user.toJSON()),
    total,
    limit,
    offset,
  });
}

/** Admin-only: creates a new user (admin or employee). There is no public registration endpoint. */
export async function createUser(req: Request, res: Response): Promise<void> {
  const { name, email, password, role, department } = (req.body ?? {}) as CreateUserBody;

  if (!name || !email || !password) {
    res.status(400).json({ error: "name, email and password are required" });
    return;
  }
  if (
    department !== undefined &&
    department !== null &&
    (typeof department !== "string" || isInvalidObjectId(department))
  ) {
    res.status(400).json({ error: "department must be a valid id or null" });
    return;
  }
  // A head without a department has nothing to manage — require an assignment.
  if (role === "head" && (department === undefined || department === null)) {
    res.status(400).json({ error: "A head of department must be assigned to a department" });
    return;
  }

  try {
    const user = await User.create({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      password,
      role: role === "admin" ? "admin" : role === "head" ? "head" : "employee",
      department:
        department === undefined
          ? undefined
          : department === null
            ? null
            : new mongoose.Types.ObjectId(department),
    });
    logActivity({
      action: "user_created",
      actor: req.user,
      targetType: "user",
      targetId: user._id,
      targetName: user.name,
      details: { role: user.role },
      ip: req.ip,
    });
    res.status(201).json({ user: user.toJSON() });
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      res.status(409).json({ error: "A user with this email already exists" });
      return;
    }
    throw error; // validation errors etc. flow to the global JSON error handler
  }
}

/** Admin-only: updates a user's name/email/role/department and optionally resets the password. */
export async function updateUser(req: Request, res: Response): Promise<void> {
  const user = await getUserOr404(req, res);
  if (!user) return;

  const { name, email, role, department, password } = (req.body ?? {}) as UpdateUserBody;

  const hasAnyField =
    name !== undefined ||
    email !== undefined ||
    role !== undefined ||
    department !== undefined ||
    password !== undefined;
  if (!hasAnyField) {
    res.status(400).json({ error: "At least one field to update is required" });
    return;
  }

  // An admin must never be able to demote (or promote) themselves.
  const actor = req.user;
  if (actor && actor._id.equals(user._id) && role !== undefined && role !== user.role) {
    res.status(400).json({ error: "You cannot change your own role" });
    return;
  }

  if (name !== undefined && !name.trim()) {
    res.status(400).json({ error: "name cannot be empty" });
    return;
  }
  if (role !== undefined && role !== "admin" && role !== "employee" && role !== "head") {
    res.status(400).json({ error: "role must be admin, employee, or head" });
    return;
  }
  if (password !== undefined && password.length < 8) {
    res.status(400).json({ error: "password must be at least 8 characters" });
    return;
  }
  if (
    department !== undefined &&
    department !== null &&
    (typeof department !== "string" || isInvalidObjectId(department))
  ) {
    res.status(400).json({ error: "department must be a valid id or null" });
    return;
  }

  // After this update the user must still satisfy "heads have a department".
  const nextRole = role ?? user.role;
  const nextDepartment =
    department === null ? null : department === undefined ? user.department : department;
  if (nextRole === "head" && !nextDepartment) {
    res.status(400).json({ error: "A head of department must be assigned to a department" });
    return;
  }

  const changed: string[] = [];
  if (name !== undefined) {
    user.name = name.trim();
    changed.push("name");
  }
  if (email !== undefined) {
    user.email = email.trim().toLowerCase();
    changed.push("email");
  }
  if (role !== undefined) {
    user.role = role;
    changed.push("role");
  }
  if (department !== undefined) {
    user.department = department === null ? null : new mongoose.Types.ObjectId(department);
    changed.push("department");
  }
  if (password !== undefined) {
    // The model's pre-save hook rehashes whenever password is modified.
    user.password = password;
    changed.push("password");
  }

  try {
    await user.save();
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      res.status(409).json({ error: "A user with this email already exists" });
      return;
    }
    throw error;
  }

  logActivity({
    action: "user_updated",
    actor: req.user,
    targetType: "user",
    targetId: user._id,
    targetName: user.name,
    details: { changed },
    ip: req.ip,
  });

  res.json({ user: user.toJSON() });
}

/** Admin-only: deletes a user. The admin's own account is protected. */
export async function deleteUser(req: Request, res: Response): Promise<void> {
  const user = await getUserOr404(req, res);
  if (!user) return;

  const actor = req.user;
  if (actor && actor._id.equals(user._id)) {
    res.status(400).json({ error: "You cannot delete your own account" });
    return;
  }

  // Snapshot the target BEFORE removal so the audit trail stays meaningful.
  const deletedId = user._id;
  const deletedName = user.name;
  const deletedEmail = user.email;
  const deletedRole = user.role;

  await user.deleteOne();

  logActivity({
    action: "user_deleted",
    actor: req.user,
    targetType: "user",
    targetId: deletedId,
    targetName: deletedName,
    details: { email: deletedEmail, role: deletedRole },
    ip: req.ip,
  });

  res.json({ message: "User deleted" });
}

/**
 * Any authenticated user: updates their own profile. Only name + password are
 * editable — email/role/department fields in the body are intentionally ignored
 * (email is the unique login identifier, managed by admins).
 */
export async function updateMe(req: Request, res: Response): Promise<void> {
  const user = req.user!;
  const { name, currentPassword, password } = (req.body ?? {}) as UpdateMeBody;

  const hasAnyField = name !== undefined || password !== undefined;
  if (!hasAnyField) {
    res.status(400).json({ error: "At least one field to update is required" });
    return;
  }

  if (name !== undefined && !name.trim()) {
    res.status(400).json({ error: "name cannot be empty" });
    return;
  }

  const changed: string[] = [];
  if (name !== undefined) {
    user.name = name.trim();
    changed.push("name");
  }
  if (password !== undefined) {
    if (password.length < 8) {
      res.status(400).json({ error: "password must be at least 8 characters" });
      return;
    }
    // requireAuth loads the user without the password hash (select: false) —
    // fetch it explicitly to verify the current password.
    const stored = await User.findById(user._id).select("+password");
    if (!stored || !(await stored.comparePassword(currentPassword ?? ""))) {
      res.status(401).json({ error: "Current password is incorrect" });
      return;
    }
    user.password = password;
    changed.push("password");
  }

  await user.save();

  logActivity({
    action: "profile_updated",
    actor: user,
    details: { changed },
    ip: req.ip,
  });

  res.json({ user: user.toJSON() });
}
