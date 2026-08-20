import type { Request, Response } from "express";
import { ActivityLog } from "../models/ActivityLog.js";
import { parsePagination, searchRegex } from "../lib/pagination.js";

/**
 * Admin-only: lists activity log entries, newest first, with optional search
 * (actor, action, or target) and pagination.
 */
export async function listActivityLogs(req: Request, res: Response): Promise<void> {
  const { limit, offset } = parsePagination(req);
  const search = searchRegex(req.query.search);

  const filter: Record<string, unknown> = {};
  if (search) {
    filter.$or = [
      { action: search },
      { actorName: search },
      { actorEmail: search },
      { actorRole: search },
      { targetType: search },
      { targetName: search },
    ];
  }

  let query = ActivityLog.find(filter).sort({ createdAt: -1 });
  if (limit !== null) {
    query = query.skip(offset).limit(limit);
  }

  const [logs, total] = await Promise.all([query, ActivityLog.countDocuments(filter)]);

  res.json({
    logs: logs.map((log) => log.toJSON()),
    total,
    limit,
    offset,
  });
}
