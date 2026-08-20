import type { IncomingMessage, ServerResponse } from "http";
import mongoose from "mongoose";

// Import the Express app (this also registers all middleware and routes)
import app from "../src/server.js";

// ---------------------------------------------------------------------------
// MongoDB connection caching for serverless environments
// ---------------------------------------------------------------------------
// In serverless, each function instance may be reused across requests.
// We cache the connection to avoid reconnecting on every invocation.

let cachedConnection: typeof mongoose | null = null;

async function connectToDatabase(): Promise<typeof mongoose> {
  if (cachedConnection && mongoose.connection.readyState === 1) {
    return cachedConnection;
  }

  const uri = process.env.MONGO_URI;
  if (!uri) {
    throw new Error("MONGO_URI environment variable is not set.");
  }

  cachedConnection = await mongoose.connect(uri);
  console.log(`✅ MongoDB connected (serverless): ${mongoose.connection.name}`);
  return cachedConnection;
}

// ---------------------------------------------------------------------------
// Vercel serverless handler
// ---------------------------------------------------------------------------

export default async function handler(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  // Ensure the database is connected before handling the request
  try {
    await connectToDatabase();
  } catch (error) {
    console.error("❌ MongoDB connection failed:", error);
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Database connection failed" }));
    return;
  }

  // Pass the request to the Express app.
  // Express accepts any IncomingMessage-compatible object at runtime;
  // we cast to `any` to satisfy TypeScript's strict Express 5 types.
  return new Promise<void>((resolve, reject) => {
    (app as unknown as (req: IncomingMessage, res: ServerResponse, cb: (err?: unknown) => void) => void)(
      req,
      res,
      (err?: unknown) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      },
    );
  });
}
