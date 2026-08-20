import type { Request, Response } from "express";
import mongoose from "mongoose";
import { inngest } from "../inngest/client.js";
import { AiInsight } from "../models/AiInsight.js";

// ---------------------------------------------------------------------------

function isInvalidObjectId(id: string): boolean {
  return !mongoose.isValidObjectId(id);
}

/** Express 5 types params as `string | string[] | undefined` — normalize to a single value. */
function param(req: Request, name: string): string | undefined {
  const value = req.params[name];
  return typeof value === "string" ? value : undefined;
}

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

interface GenerateInsightBody {
  period?: unknown;
}

// ---------------------------------------------------------------------------
// Controllers
// ---------------------------------------------------------------------------

/**
 * Admin/head: triggers asynchronous AI insight generation.
 * Creates a pending Insight doc and dispatches an Inngest event.
 */
export async function generateInsight(
  req: Request,
  res: Response
): Promise<void> {
  const user = req.user!;
  const { period } = (req.body ?? {}) as GenerateInsightBody;

  if (typeof period !== "string" || !period.trim()) {
    res.status(400).json({ error: "period is required (e.g. 'Last 30 days')" });
    return;
  }

  if (period.trim().length > 100) {
    res
      .status(400)
      .json({ error: "period must be 100 characters or fewer" });
    return;
  }

  const scope = user.role === "admin" ? "organization" : "department";
  const department =
    scope === "department" ? user.department ?? null : null;

  const insight = await AiInsight.create({
    createdBy: user._id,
    scope,
    department,
    status: "pending",
    period: period.trim(),
  });

  // Dispatch Inngest event for async generation.
  await inngest.send({
    name: "ai/insight-generate",
    data: { insightId: insight._id.toString() },
  });

  insight.status = "generating";
  await insight.save();

  res.status(201).json({ insight: insight.toJSON() });
}

/**
 * Admin/head: lists past insights scoped by role.
 * Admin sees all org-wide insights. Head sees only their department's insights.
 */
export async function listInsights(
  req: Request,
  res: Response
): Promise<void> {
  const user = req.user!;
  const { parsePagination } = await import("../lib/pagination.js");
  const { limit, offset } = parsePagination(req);

  const filter: Record<string, unknown> = {};

  // Heads can only see their department's insights.
  if (user.role === "head") {
    if (!user.department) {
      res.json({ insights: [], total: 0, limit, offset });
      return;
    }
    filter.$or = [
      { scope: "department", department: user.department },
      { createdBy: user._id },
    ];
  }

  let query = AiInsight.find(filter)
    .populate("createdBy", "name")
    .populate("department", "name")
    .sort({ createdAt: -1 });

  if (limit !== null) {
    query = query.skip(offset).limit(limit);
  }

  const [insights, total] = await Promise.all([
    query,
    AiInsight.countDocuments(filter),
  ]);

  res.json({
    insights: insights.map((i) => i.toJSON()),
    total,
    limit,
    offset,
  });
}

/**
 * Admin/head: get a single insight detail.
 */
export async function getInsight(
  req: Request,
  res: Response
): Promise<void> {
  const id = param(req, "id");
  if (!id || isInvalidObjectId(id)) {
    res.status(404).json({ error: "Insight not found" });
    return;
  }

  const insight = await AiInsight.findById(id)
    .populate("createdBy", "name")
    .populate("department", "name");

  if (!insight) {
    res.status(404).json({ error: "Insight not found" });
    return;
  }

  // Heads can only access their own or department insights.
  const user = req.user!;
  if (user.role === "head") {
    const isOwner = insight.createdBy._id.toString() === user._id.toString();
    const isDept =
      insight.department &&
      insight.department._id.toString() === user.department?.toString();
    if (!isOwner && !isDept) {
      res.status(403).json({ error: "You don't have access to this insight" });
      return;
    }
  }

  res.json({ insight: insight.toJSON() });
}

/**
 * Admin-only: deletes an AI insight.
 */
export async function deleteInsight(
  req: Request,
  res: Response
): Promise<void> {
  const id = param(req, "id");
  if (!id || isInvalidObjectId(id)) {
    res.status(404).json({ error: "Insight not found" });
    return;
  }

  const insight = await AiInsight.findById(id);
  if (!insight) {
    res.status(404).json({ error: "Insight not found" });
    return;
  }

  const deletedId = insight._id;
  const deletedTitle = insight.title ?? "Untitled insight";

  await insight.deleteOne();

  const { logActivity } = await import("../lib/activityLog.js");
  logActivity({
    action: "ai_insight_deleted",
    actor: req.user,
    targetType: "ai_insight",
    targetId: deletedId,
    targetName: deletedTitle,
    ip: req.ip,
  });

  res.json({ message: "Insight deleted" });
}
