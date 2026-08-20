import mongoose from "mongoose";

/**
 * Connects to MongoDB via Mongoose using the MONGO_URI environment variable.
 * Throws if the connection string is missing or the connection fails, so the
 * server can fail fast instead of serving requests against a dead database.
 */
export async function connectDB(): Promise<void> {
  const uri = process.env.MONGO_URI;

  if (!uri) {
    throw new Error("MONGO_URI is not set. Add it to backend/.env (see backend/.env.example).");
  }

  await mongoose.connect(uri);
  console.log(`✅ MongoDB connected: ${mongoose.connection.name}`);
}

/** Disconnects from MongoDB — used for clean shutdowns and tests. */
export async function disconnectDB(): Promise<void> {
  await mongoose.disconnect();
  console.log("🔌 MongoDB disconnected");
}
