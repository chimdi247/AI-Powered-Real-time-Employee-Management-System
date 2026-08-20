import type { NextFunction, Request, Response } from "express";
import type { AccessTokenPayload } from "../lib/jwt.js";
import { verifyAccessToken } from "../lib/jwt.js";
import { User } from "../models/User.js";

/** Reads the JWT from the httpOnly cookie, verifies it, and attaches the current user to the request. */
export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const token = req.cookies.token as string | undefined;

  if (!token) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  let payload: AccessTokenPayload;
  try {
    payload = verifyAccessToken(token);
  } catch {
    // Invalid or expired token — treat as unauthenticated
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  // Re-load the user on every request so deleted/disabled users lose access immediately.
  // DB errors intentionally propagate to the global error handler (500), not a 401.
  const user = await User.findById(payload.sub);

  if (!user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  req.user = user;
  next();
}
