import mongoose, { Schema } from "mongoose";
import bcrypt from "bcryptjs";

/** Per-employee annual leave balance for the tracked leave types. */
export interface LeaveBalance {
  /** The calendar year this balance applies to (stale years are lazily reset). */
  year: number;
  annual: number;
  sick: number;
  personal: number;
}

export interface IUser extends mongoose.Document {
  name: string;
  email: string;
  password: string;
  role: "admin" | "employee" | "head";
  /** Single department per employee (null until assigned). */
  department?: mongoose.Types.ObjectId | null;
  leaveBalance?: LeaveBalance;
  comparePassword(candidate: string): Promise<boolean>;
}

const userSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, "Please provide a valid email address"],
    },
    password: { type: String, required: true, minlength: 8, select: false },
    role: { type: String, enum: ["admin", "employee", "head"], default: "employee" },
    department: { type: Schema.Types.ObjectId, ref: "Department", default: null },
    leaveBalance: {
      type: {
        year: { type: Number, required: true },
        annual: { type: Number, required: true, min: 0 },
        sick: { type: Number, required: true, min: 0 },
        personal: { type: Number, required: true, min: 0 },
      },
      default: undefined,
    },
  },
  { timestamps: true }
);

// Hash the password with bcrypt (cost 10) whenever it changes — plain text is never stored
userSchema.pre("save", async function () {
  if (!this.isModified("password")) return;
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

userSchema.methods.comparePassword = function (candidate: string): Promise<boolean> {
  return bcrypt.compare(candidate, this.password);
};

// Never leak the password hash or the internal version key in JSON responses
userSchema.set("toJSON", {
  transform: (_doc, ret) => {
    const json = ret as unknown as Record<string, unknown>;
    delete json.password;
    delete json.__v;
    return json;
  },
});

export const User = mongoose.model<IUser>("User", userSchema);
