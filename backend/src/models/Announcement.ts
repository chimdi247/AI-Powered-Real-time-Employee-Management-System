import mongoose, { Schema } from "mongoose";

export interface IAnnouncement extends mongoose.Document {
  title: string;
  body: string;
  /** Department this announcement is scoped to (heads post for their own; admins for any). */
  department: mongoose.Types.ObjectId;
  /** The user who created it (snapshot fields are not stored — author is live). */
  author: mongoose.Types.ObjectId;
}

const announcementSchema = new Schema<IAnnouncement>(
  {
    title: { type: String, required: true, trim: true },
    body: { type: String, required: true, trim: true },
    department: { type: Schema.Types.ObjectId, ref: "Department", required: true, index: true },
    author: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

// Department-scoped listing is the only access pattern — index department + createdAt desc.
announcementSchema.index({ department: 1, createdAt: -1 });

// Never leak the internal version key in JSON responses
announcementSchema.set("toJSON", {
  transform: (_doc, ret) => {
    const json = ret as unknown as Record<string, unknown>;
    delete json.__v;
    return json;
  },
});

export const Announcement = mongoose.model<IAnnouncement>("Announcement", announcementSchema);
