import type { ActivityAction, IActivityLog } from "../models/ActivityLog.js";
import { ActivityLog } from "../models/ActivityLog.js";
import type { IUser } from "../models/User.js";

export interface ActivityLogEntry {
  action: ActivityAction;
  /**
   * The user who performed the action. When given, name/email/role snapshots
   * are derived from it. Omit (or pass null) for events with no known user
   * (e.g. failed logins) and pass `actorEmail` explicitly.
   */
  actor?: IUser | null;
  /** Email snapshot — used when `actor` is unknown (failed logins). */
  actorEmail?: string;
  targetType?: string;
  targetId?: IActivityLog["targetId"];
  targetName?: string;
  details?: unknown;
  ip?: string;
}

/**
 * Records an activity log entry **fire-and-forget** — logging must never break
 * the primary request, so failures are swallowed.
 */
export function logActivity(entry: ActivityLogEntry): void {
  const { actor, actorEmail, ...rest } = entry;

  const doc = {
    ...rest,
    actor: actor ? actor._id : null,
    actorName: actor?.name,
    actorEmail: actor?.email ?? actorEmail,
    actorRole: actor?.role,
  };

  void ActivityLog.create(doc).catch(() => undefined);
}
