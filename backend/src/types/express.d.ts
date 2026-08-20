import type { IUser } from "../models/User.js";

declare global {
  namespace Express {
    interface Request {
      /** Authenticated user attached by requireAuth (present when a valid JWT cookie is sent). */
      user?: IUser;
    }
  }
}

export {};
