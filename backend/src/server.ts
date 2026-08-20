import "dotenv/config";
import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import helmet from "helmet";
import mongoose from "mongoose";
import morgan from "morgan";
import { strictRateLimit, moderateRateLimit, standardRateLimit } from "./middlewares/rateLimit.js";
import { serve } from "inngest/express";
import { connectDB, disconnectDB } from "./db/index.js";
import { inngest, functions } from "./inngest/index.js";
import { isDuplicateKeyError } from "./lib/errors.js";
import activityLogsRouter from "./routes/activityLogs.js";
import attendanceRouter from "./routes/attendance.js";
import announcementsRouter from "./routes/announcements.js";
import authRouter from "./routes/auth.js";
import departmentsRouter from "./routes/departments.js";
import feedbackRouter from "./routes/feedback.js";
import leavePoliciesRouter from "./routes/leavePolicies.js";
import leavesRouter from "./routes/leaves.js";
import notificationsRouter from "./routes/notifications.js";
import performanceReviewsRouter from "./routes/performanceReviews.js";
import reportsRouter from "./routes/reports.js";
import aiInsightsRouter from "./routes/aiInsights.js";
import dashboardRouter from "./routes/dashboard.js";
import tasksRouter from "./routes/tasks.js";
import usersRouter from "./routes/users.js";

const app = express();
const PORT = process.env.PORT ?? 5000;

// Trust the first proxy (Vercel edge network) so req.ip returns the real client IP
// instead of the proxy IP — without this, all users share one rate-limit bucket.
app.set("trust proxy", 1);

// Parse CORS_ORIGIN as a comma-separated allowlist (e.g. "http://localhost:5173,https://app.example.com")
const corsOrigins = (process.env.CORS_ORIGIN ?? "http://localhost:5173")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

// --- Global middleware (order matters: env first, then security/cors/parsing) ---
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev")); // Request logging
app.use(helmet()); // Secure HTTP headers
app.use(
  cors({
    origin(origin, callback) {
      // Allow requests with no Origin header (curl, Postman, server-to-server)
      if (!origin || corsOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true, // Required for cookie-based JWT auth (later steps)
  }),
);
app.use(cookieParser(process.env.COOKIE_SECRET)); // Parse cookies, incl. signed cookies
app.use(express.json({ limit: "1mb" })); // Parse JSON request bodies
app.use(express.urlencoded({ extended: true })); // Parse form request bodies

// Root health check — confirms the API is up and running
app.get("/", (_req, res) => {
  res.send("Employee Management System API is running 🚀");
});

// --- Rate limiting ---
// Strict: auth endpoints (login brute-force protection)
app.use("/api/auth", strictRateLimit);
// Moderate: expensive compute operations
app.use("/api/ai-insights", moderateRateLimit);
app.use("/api/reports", moderateRateLimit);
// Standard: general API endpoints
app.use("/api", standardRateLimit);

// --- API routers ---
app.use("/api/auth", authRouter);
app.use("/api/users", usersRouter);
app.use("/api/departments", departmentsRouter);
app.use("/api/leaves", leavesRouter);
app.use("/api/leave-policies", leavePoliciesRouter);
app.use("/api/activity-logs", activityLogsRouter);
app.use("/api/announcements", announcementsRouter);
app.use("/api/feedback", feedbackRouter);
app.use("/api/notifications", notificationsRouter);
app.use("/api/attendance", attendanceRouter);
app.use("/api/reports", reportsRouter);
app.use("/api/performance-reviews", performanceReviewsRouter);
app.use("/api/ai-insights", aiInsightsRouter);
app.use("/api/dashboard", dashboardRouter);
app.use("/api/tasks", tasksRouter);

// --- Inngest serve endpoint ---
app.use("/api/inngest", serve({ client: inngest, functions }));

// 404 for unknown API routes — JSON, not the default HTML page
app.use((_req, res) => {
  res.status(404).json({ error: "Not found" });
});

// Central JSON error handler — converts CORS, mongoose validation, and duplicate-key errors into clean API responses
app.use(
  (
    err: unknown,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    if (err instanceof mongoose.Error.ValidationError) {
      // Generic message — mongoose error text can embed attempted field values (e.g. passwords)
      res.status(400).json({ error: "Validation failed" });
      return;
    }
    if (isDuplicateKeyError(err)) {
      res.status(409).json({ error: "Duplicate value already exists" });
      return;
    }
    if (err instanceof Error && err.message === "Not allowed by CORS") {
      res.status(403).json({ error: err.message });
      return;
    }
    console.error("Unhandled error:", err);
    res.status(500).json({ error: "Internal server error" });
  },
);

// Start the server only when this file is run directly (not when imported in tests)
if (import.meta.main) {
  const startServer = async () => {
    try {
      // Establish the MongoDB connection before accepting requests
      await connectDB();
      app.listen(PORT, () => {
        console.log(`✅ Express server running on http://localhost:${PORT}`);
      });
    } catch (error) {
      console.error("❌ Failed to start server:", error);
      process.exit(1);
    }
  };

  // Close the MongoDB connection gracefully on shutdown (SIGINT: Ctrl+C, SIGTERM: docker stop / orchestrators)
  const shutdown = () => {
    void disconnectDB()
      .catch(() => undefined)
      .finally(() => process.exit(0));
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  startServer();
}

export default app;
