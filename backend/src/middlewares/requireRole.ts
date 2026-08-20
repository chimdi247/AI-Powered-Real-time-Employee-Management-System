import type { NextFunction, Request, Response } from "express";
import type { IUser } from "../models/User.js";

export type Role = IUser["role"];

/** Route guard factory: only allows requests from users whose role is in the allowlist. Must run after requireAuth. */
export function requireRole(...roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user || !roles.includes(req.user.role)) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    next();
  };
}
