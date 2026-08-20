import type { Response } from "express";
import type mongoose from "mongoose";
import {
  Notification,
  type INotification,
  type NotificationType,
} from "../models/Notification.js";
import type { IUser } from "../models/User.js";
import { User } from "../models/User.js";
import {
  sendEmail,
  sendBatchEmails,
  leaveApprovedTemplate,
  leaveRejectedTemplate,
  feedbackRespondedTemplate,
  announcementCreatedTemplate,
  reviewAssignedTemplate,
  reviewReadyTemplate,
  taskAssignedTemplate,
  taskCompletedTemplate,
  taskReviewedTemplate,
} from "./email.js";
import { pushToClient, createEvent, registerClient } from "./sse.js";

export interface NotifyParams {
  recipient: mongoose.Types.ObjectId;
  actor?: IUser | null;
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
  /** Optional structured data for email templates. */
  data?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// SSE connection manager — delegates to shared sse.ts
// ---------------------------------------------------------------------------

/** Register an SSE client for a user. Returns a cleanup function. */
export function registerSSEClient(
  userId: string,
  res: Response
): () => void {
  return registerClient(userId, res);
}

/** Push a notification to connected SSE clients for a given user. */
function pushToSSE(userId: string, notification: INotification): void {
  pushToClient(userId, createEvent("notification", notification.toJSON()));
}

// ---------------------------------------------------------------------------
// Email sending — fire-and-forget, errors are swallowed
// ---------------------------------------------------------------------------

/**
 * Looks up a user's email address and sends a notification email.
 * Failures are caught and logged — never throws.
 */
function sendNotificationEmail(
  recipientId: mongoose.Types.ObjectId,
  params: {
    subject: string;
    html: string;
    idempotencyKey?: string;
  }
): void {
  void User.findById(recipientId)
    .select("email")
    .lean()
    .then((user) => {
      if (!user || !user.email) return;
      sendEmail({
        to: user.email,
        subject: params.subject,
        html: params.html,
        idempotencyKey: params.idempotencyKey,
      });
    })
    .catch((err) => {
      console.error("[email] Failed to look up recipient for email:", err);
    });
}

/**
 * Looks up multiple users' email addresses and sends batch notification emails.
 * Failures are caught and logged — never throws.
 */
function sendBatchNotificationEmails(
  recipientIds: mongoose.Types.ObjectId[],
  items: Array<{
    recipientId: mongoose.Types.ObjectId;
    subject: string;
    html: string;
  }>
): void {
  void User.find({ _id: { $in: recipientIds } })
    .select("email")
    .lean()
    .then((users) => {
      const emailMap = new Map<string, string>();
      for (const user of users) {
        emailMap.set(user._id.toString(), user.email);
      }

      const batchItems = items
        .map((item) => {
          const email = emailMap.get(item.recipientId.toString());
          if (!email) return null;
          return { to: email, subject: item.subject, html: item.html };
        })
        .filter((item): item is { to: string; subject: string; html: string } => item !== null);

      if (batchItems.length > 0) {
        sendBatchEmails(batchItems);
      }
    })
    .catch((err) => {
      console.error("[email] Failed to look up recipients for batch email:", err);
    });
}

// ---------------------------------------------------------------------------
// Public helpers — fire-and-forget (mirrors the logActivity pattern)
// ---------------------------------------------------------------------------

/** Extract leave details from the message for template rendering. */
function parseLeaveDetails(
  type: NotificationType,
  title: string,
  message: string
): { leaveType: string; dates: string; days: string } | null {
  if (type !== "leave_approved" && type !== "leave_rejected") return null;

  // Message format: "Your {type} leave request for {days} day(s) has been {decision}."
  const match = message.match(
    /^Your (\w+) leave request for (\d+) day\(s\)/
  );
  if (!match) return null;

  return {
    leaveType: match[1] ?? "leave",
    dates: "",
    days: match[2] ?? "0",
  };
}

/** Format a date range for email templates. */
function formatDateRange(start?: Date, end?: Date): string {
  if (!start || !end) return "";
  const fmt = (d: Date) => d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
  return `${fmt(start)} → ${fmt(end)}`;
}

/**
 * Creates a notification document and pushes it to any connected SSE clients.
 * Also sends an email notification when applicable.
 * Failures are swallowed — notifications must never break the primary request.
 */
export function notify(params: NotifyParams): void {
  const { recipient, actor, type, title, message, link } = params;

  void Notification.create({
    recipient,
    actor: actor ? actor._id : null,
    type,
    title,
    message,
    link,
  })
    .then((doc) => {
      pushToSSE(recipient.toString(), doc);
      sendEmailForNotification(params);
    })
    .catch(() => undefined);
}

/**
 * Batch-creates notifications for multiple recipients (used for department-wide
 * announcements). Pushes each to SSE and sends emails.
 * Failures are swallowed.
 */
export function notifyBatch(
  recipients: mongoose.Types.ObjectId[],
  params: Omit<NotifyParams, "recipient">
): void {
  const docs = recipients.map((recipient) => ({
    recipient,
    actor: params.actor ? params.actor._id : null,
    type: params.type,
    title: params.title,
    message: params.message,
    link: params.link,
  }));

  void Notification.insertMany(docs)
    .then((created) => {
      for (const doc of created) {
        pushToSSE(doc.recipient.toString(), doc as unknown as INotification);
      }
      sendBatchEmailsForNotifications(recipients, params);
    })
    .catch(() => undefined);
}

// ---------------------------------------------------------------------------
// Email dispatch logic per notification type
// ---------------------------------------------------------------------------

/** Send an email for a single notification based on its type. */
function sendEmailForNotification(params: NotifyParams): void {
  const { recipient, type, message, data } = params;

  switch (type) {
    case "leave_approved":
    case "leave_rejected": {
      const isApproved = type === "leave_approved";
      const leaveType = (data?.leaveType as string) || "leave";
      const startDate = (data?.startDate as string) || "";
      const endDate = (data?.endDate as string) || "";
      const days = (data?.days as number) || 0;
      const note = (data?.note as string) || undefined;

      // Fallback: parse from message if data is not provided
      const match = message.match(/^Your (\w+) leave request for (\d+) day\(s\)/);
      const finalLeaveType = leaveType !== "leave" ? leaveType : (match?.[1] || "leave");
      const finalDays = days || (match ? parseInt(match[2] ?? "0", 10) : 0);

      const html = isApproved
        ? leaveApprovedTemplate({
            employeeName: "there",
            leaveType: finalLeaveType,
            startDate,
            endDate,
            days: finalDays,
            note,
          })
        : leaveRejectedTemplate({
            employeeName: "there",
            leaveType: finalLeaveType,
            startDate,
            endDate,
            days: finalDays,
            note,
          });

      sendNotificationEmail(recipient, {
        subject: isApproved ? "Leave Approved ✅" : "Leave Rejected ❌",
        html,
        idempotencyKey: `leave-${type}/${recipient}/${Date.now()}`,
      });
      break;
    }

    case "feedback_responded": {
      const category = (data?.category as string) || "feedback";
      const responseBody = (data?.responseBody as string) || message;
      const html = feedbackRespondedTemplate({
        employeeName: "there",
        category,
        responseBody,
        respondedBy: params.actor?.name || "An admin",
      });

      sendNotificationEmail(recipient, {
        subject: "Admin Responded to Your Feedback",
        html,
        idempotencyKey: `feedback-responded/${recipient}/${Date.now()}`,
      });
      break;
    }

    case "announcement_created": {
      // For announcements, we send batch emails (handled by sendBatchEmailsForNotifications)
      break;
    }

    case "review_assigned": {
      const period = (data?.period as string) || "";
      const reviewerName = (data?.reviewerName as string) || params.actor?.name || "An admin";
      const html = reviewAssignedTemplate({
        employeeName: "there",
        period,
        reviewerName,
      });

      sendNotificationEmail(recipient, {
        subject: "Performance Review Assigned 📋",
        html,
        idempotencyKey: `review-assigned/${recipient}/${Date.now()}`,
      });
      break;
    }

    case "review_acknowledged": {
      // The reviewer gets notified — we don't send an email for acknowledgment,
      // it's mainly an in-app notification.
      break;
    }

    case "task_assigned": {
      const taskTitle = (data?.taskTitle as string) || params.title;
      const dueDate = (data?.dueDate as string) || "";
      const assignerName = params.actor?.name || "A team lead";
      const priority = (data?.priority as string) || "medium";
      const html = taskAssignedTemplate({
        employeeName: "there",
        taskTitle,
        dueDate,
        assignerName,
        priority,
      });

      sendNotificationEmail(recipient, {
        subject: `📋 New Task Assigned: ${taskTitle}`,
        html,
        idempotencyKey: `task-assigned/${recipient}/${Date.now()}`,
      });
      break;
    }

    case "task_completed": {
      const taskTitle = (data?.taskTitle as string) || params.title;
      const submissionNotes = (data?.submissionNotes as string) || "";
      const assigneeName = (data?.assigneeName as string) || "An employee";
      const html = taskCompletedTemplate({
        reviewerName: "there",
        taskTitle,
        submissionNotes,
        assigneeName,
      });

      sendNotificationEmail(recipient, {
        subject: `✅ Task Submitted for Review: ${taskTitle}`,
        html,
        idempotencyKey: `task-completed/${recipient}/${Date.now()}`,
      });
      break;
    }

    case "task_approved":
    case "task_rejected": {
      const isApproved = type === "task_approved";
      const taskTitle = (data?.taskTitle as string) || params.title;
      const reviewNotes = (data?.reviewNotes as string) || "";
      const html = taskReviewedTemplate({
        employeeName: "there",
        taskTitle,
        approved: isApproved,
        reviewNotes,
      });

      sendNotificationEmail(recipient, {
        subject: isApproved ? `✅ Task Approved: ${taskTitle}` : `❌ Task Rejected: ${taskTitle}`,
        html,
        idempotencyKey: `task-reviewed/${type}/${recipient}/${Date.now()}`,
      });
      break;
    }
  }
}

/** Send batch emails for announcement notifications. */
function sendBatchEmailsForNotifications(
  recipients: mongoose.Types.ObjectId[],
  params: Omit<NotifyParams, "recipient">
): void {
  if (params.type !== "announcement_created") return;

  const data = params.data || {};
  const announcementTitle = (data.announcementTitle as string) || params.title;
  const announcementBody = (data.announcementBody as string) || params.message;
  const departmentName = (data.departmentName as string) || "your department";

  const items = recipients.map((recipientId) => ({
    recipientId,
    subject: `📢 ${announcementTitle}`,
    html: announcementCreatedTemplate({
      recipientName: "there",
      announcementTitle,
      announcementBody,
      departmentName,
      authorName: params.actor?.name || "A team member",
    }),
  }));

  sendBatchNotificationEmails(recipients, items);
}
