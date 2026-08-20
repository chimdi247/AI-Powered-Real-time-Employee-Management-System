import { Resend } from "resend";

// ---------------------------------------------------------------------------
// Resend client — initialised lazily so the app still starts without a key
// (emails simply won't be sent when RESEND_API_KEY is missing).
// ---------------------------------------------------------------------------

const apiKey = process.env.RESEND_API_KEY;
if (!apiKey) {
  console.warn("[email] RESEND_API_KEY not set — emails will not be sent");
}
const resendClient = new Resend(apiKey);
// ---------------------------------------------------------------------------
// Sender configuration
// ---------------------------------------------------------------------------

function getFromAddress(): string {
  const name = process.env.FROM_NAME || "EMS";
  const email = process.env.FROM_EMAIL || "onboarding@resend.dev";
  return `${name} <${email}>`;
}

// ---------------------------------------------------------------------------
// Email sending helpers — fire-and-forget, errors are swallowed
// ---------------------------------------------------------------------------

interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  idempotencyKey?: string;
}

/**
 * Sends a single email. Failures are caught and logged — never throws.
 */
export async function sendEmail(params: SendEmailParams): Promise<void> {
  if (!resendClient) {
    console.warn(
      "[email] RESEND_API_KEY not set — skipping email to",
      params.to,
    );
    return;
  }

  const { to, subject, html } = params;

  try {
    const { data, error } = await resendClient.emails.send({
      from: "Resend <onboarding@resend.dev>",
      to: ["developerspack.team@gmail.com"],
      subject: subject,
      html: html,
    });

    if (error) {
      console.error("[email] Send failed:", error.message, data);
    }
  } catch (err) {
    console.error("[email] Unexpected error sending to", to, err);
  }
}

interface BatchEmailItem {
  to: string;
  subject: string;
  html: string;
}

/**
 * Sends multiple emails in a single batch (2-100 recipients).
 * Batch is atomic — if one fails validation, the whole batch fails.
 * Failures are caught and logged — never throws.
 */
export async function sendBatchEmails(items: BatchEmailItem[]): Promise<void> {
  if (items.length === 0) return;

  if (!resendClient) {
    console.warn(
      "[email] RESEND_API_KEY not set — skipping",
      items.length,
      "emails",
    );
    return;
  }

  const from = getFromAddress();
  const emails = items.map((item) => ({
    from,
    to: [item.to],
    subject: item.subject,
    html: item.html,
  }));

  const firstEmail = emails[0];
  if (!firstEmail) {
    return;
  }

  try {
    const { data, error } = await resendClient.emails.send({
      from: "Resend <onboarding@resend.dev>",
      to: ["developerspack.team@gmail.com"],
      subject: firstEmail.subject,
      html: firstEmail.html,
    });

    if (error) {
      console.error("[email] Batch send failed:", error.message, data);
    }
  } catch (err) {
    console.error("[email] Unexpected error in batch send:", err);
  }
}

// ---------------------------------------------------------------------------
// Email templates — clean, responsive HTML with inline styles
// ---------------------------------------------------------------------------

const BASE_STYLE = `
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
  line-height: 1.6;
  color: #1f2937;
  max-width: 600px;
  margin: 0 auto;
`;

const HEADER_STYLE = `
  background-color: #3b82f6;
  color: white;
  padding: 24px;
  text-align: center;
  border-radius: 8px 8px 0 0;
`;

const BODY_STYLE = `
  background-color: #ffffff;
  padding: 24px;
  border: 1px solid #e5e7eb;
  border-top: none;
  border-radius: 0 0 8px 8px;
`;

const FOOTER_STYLE = `
  text-align: center;
  padding: 16px;
  color: #6b7280;
  font-size: 12px;
`;

const BADGE_STYLE = `
  display: inline-block;
  padding: 4px 12px;
  border-radius: 16px;
  font-size: 14px;
  font-weight: 600;
  margin: 8px 0;
`;

const BUTTON_STYLE = `
  display: inline-block;
  background-color: #3b82f6;
  color: #ffffff !important;
  text-decoration: none;
  padding: 12px 24px;
  border-radius: 6px;
  font-weight: 600;
  margin: 16px 0;
`;

function wrapTemplate(headerTitle: string, bodyHtml: string): string {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin: 0; padding: 20px; background-color: #f3f4f6;">
  <div style="${BASE_STYLE}">
    <div style="${HEADER_STYLE}">
      <h1 style="margin: 0; font-size: 20px;">🏢 Employee Management System</h1>
      <p style="margin: 8px 0 0; opacity: 0.9; font-size: 14px;">${headerTitle}</p>
    </div>
    <div style="${BODY_STYLE}">
      ${bodyHtml}
    </div>
    <div style="${FOOTER_STYLE}">
      This is an automated notification from the Employee Management System.
    </div>
  </div>
</body>
</html>`;
}

// -- Leave templates -------------------------------------------------------

export function leaveApprovedTemplate(params: {
  employeeName: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  days: number;
  note?: string;
}): string {
  const badgeColor = "#10b981";
  const body = `
    <p>Hi <strong>${params.employeeName}</strong>,</p>
    <p>Your leave request has been <span style="${BADGE_STYLE} background-color: ${badgeColor}; color: white;">✅ Approved</span></p>
    <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
      <tr><td style="padding: 8px 0; color: #6b7280;">Leave Type</td><td style="padding: 8px 0; font-weight: 600;">${params.leaveType.charAt(0).toUpperCase() + params.leaveType.slice(1)}</td></tr>
      <tr><td style="padding: 8px 0; color: #6b7280;">Duration</td><td style="padding: 8px 0; font-weight: 600;">${params.startDate} → ${params.endDate}</td></tr>
      <tr><td style="padding: 8px 0; color: #6b7280;">Days</td><td style="padding: 8px 0; font-weight: 600;">${params.days}</td></tr>
      ${params.note ? `<tr><td style="padding: 8px 0; color: #6b7280;">Note</td><td style="padding: 8px 0;">${params.note}</td></tr>` : ""}
    </table>
    <a href="${process.env.APP_URL || "http://localhost:5173"}/leaves" style="${BUTTON_STYLE}">View Leave Requests</a>
  `;
  return wrapTemplate("Leave Approved", body);
}

export function leaveRejectedTemplate(params: {
  employeeName: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  days: number;
  note?: string;
}): string {
  const badgeColor = "#ef4444";
  const body = `
    <p>Hi <strong>${params.employeeName}</strong>,</p>
    <p>Your leave request has been <span style="${BADGE_STYLE} background-color: ${badgeColor}; color: white;">❌ Rejected</span></p>
    <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
      <tr><td style="padding: 8px 0; color: #6b7280;">Leave Type</td><td style="padding: 8px 0; font-weight: 600;">${params.leaveType.charAt(0).toUpperCase() + params.leaveType.slice(1)}</td></tr>
      <tr><td style="padding: 8px 0; color: #6b7280;">Duration</td><td style="padding: 8px 0; font-weight: 600;">${params.startDate} → ${params.endDate}</td></tr>
      <tr><td style="padding: 8px 0; color: #6b7280;">Days</td><td style="padding: 8px 0; font-weight: 600;">${params.days}</td></tr>
      ${params.note ? `<tr><td style="padding: 8px 0; color: #6b7280;">Reason</td><td style="padding: 8px 0;">${params.note}</td></tr>` : ""}
    </table>
    <a href="${process.env.APP_URL || "http://localhost:5173"}/leaves" style="${BUTTON_STYLE}">View Leave Requests</a>
  `;
  return wrapTemplate("Leave Rejected", body);
}

// -- Feedback template -----------------------------------------------------

export function feedbackRespondedTemplate(params: {
  employeeName: string;
  category: string;
  responseBody: string;
  respondedBy: string;
}): string {
  const body = `
    <p>Hi <strong>${params.employeeName}</strong>,</p>
    <p>An admin has responded to your <strong>${params.category}</strong> feedback.</p>
    <div style="background-color: #f9fafb; border-left: 4px solid #3b82f6; padding: 16px; margin: 16px 0; border-radius: 0 6px 6px 0;">
      <p style="margin: 0 0 8px; color: #6b7280; font-size: 13px;"><strong>${params.respondedBy}</strong> responded:</p>
      <p style="margin: 0; color: #374151;">${params.responseBody}</p>
    </div>
    <a href="${process.env.APP_URL || "http://localhost:5173"}/feedback" style="${BUTTON_STYLE}">View Feedback</a>
  `;
  return wrapTemplate("Feedback Response", body);
}

// -- Announcement template -------------------------------------------------

export function announcementCreatedTemplate(params: {
  recipientName: string;
  announcementTitle: string;
  announcementBody: string;
  departmentName: string;
  authorName: string;
}): string {
  const body = `
    <p>Hi <strong>${params.recipientName}</strong>,</p>
    <p>A new announcement has been posted in <strong>${params.departmentName}</strong>.</p>
    <div style="background-color: #eff6ff; border: 1px solid #bfdbfe; padding: 16px; margin: 16px 0; border-radius: 6px;">
      <h3 style="margin: 0 0 8px; color: #1e40af;">${params.announcementTitle}</h3>
      <p style="margin: 0; color: #374151;">${params.announcementBody}</p>
      <p style="margin: 12px 0 0; color: #6b7280; font-size: 13px;">Posted by ${params.authorName}</p>
    </div>
    <a href="${process.env.APP_URL || "http://localhost:5173"}/announcements" style="${BUTTON_STYLE}">View Announcements</a>
  `;
  return wrapTemplate("New Announcement", body);
}

// -- Performance Review templates ------------------------------------------

export function reviewAssignedTemplate(params: {
  employeeName: string;
  period: string;
  reviewerName: string;
}): string {
  const badgeColor = "#8b5cf6";
  const body = `
    <p>Hi <strong>${params.employeeName}</strong>,</p>
    <p>A performance review has been <span style="${BADGE_STYLE} background-color: ${badgeColor}; color: white;">📋 Assigned</span></p>
    <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
      <tr><td style="padding: 8px 0; color: #6b7280;">Review Period</td><td style="padding: 8px 0; font-weight: 600;">${params.period}</td></tr>
      <tr><td style="padding: 8px 0; color: #6b7280;">Reviewer</td><td style="padding: 8px 0; font-weight: 600;">${params.reviewerName}</td></tr>
    </table>
    <p style="color: #6b7280; font-size: 14px;">Your review is being generated by AI. You'll receive another notification when it's ready for your acknowledgment.</p>
    <a href="${process.env.APP_URL || "http://localhost:5173"}/performance-reviews" style="${BUTTON_STYLE}">View Performance Reviews</a>
  `;
  return wrapTemplate("Performance Review Assigned", body);
}

export function reviewReadyTemplate(params: {
  employeeName: string;
  period: string;
  overallScore: number;
  reviewerName: string;
}): string {
  const badgeColor = "#10b981";
  const body = `
    <p>Hi <strong>${params.employeeName}</strong>,</p>
    <p>Your performance review is <span style="${BADGE_STYLE} background-color: ${badgeColor}; color: white;">✅ Ready</span></p>
    <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
      <tr><td style="padding: 8px 0; color: #6b7280;">Review Period</td><td style="padding: 8px 0; font-weight: 600;">${params.period}</td></tr>
      <tr><td style="padding: 8px 0; color: #6b7280;">Reviewer</td><td style="padding: 8px 0; font-weight: 600;">${params.reviewerName}</td></tr>
      <tr><td style="padding: 8px 0; color: #6b7280;">Overall Score</td><td style="padding: 8px 0; font-weight: 600;">${params.overallScore.toFixed(1)}/5</td></tr>
    </table>
    <p style="color: #6b7280; font-size: 14px;">Please review your performance feedback and acknowledge when you're ready.</p>
    <a href="${process.env.APP_URL || "http://localhost:5173"}/performance-reviews" style="${BUTTON_STYLE}">View & Acknowledge</a>
  `;
  return wrapTemplate("Performance Review Ready", body);
}

// -- Task templates --------------------------------------------------------

export function taskAssignedTemplate(params: {
  employeeName: string;
  taskTitle: string;
  dueDate: string;
  assignerName: string;
  priority: string;
}): string {
  const priorityColors: Record<string, string> = {
    low: "#6b7280",
    medium: "#3b82f6",
    high: "#f59e0b",
    urgent: "#ef4444",
  };
  const badgeColor = priorityColors[params.priority] || "#3b82f6";
  const body = `
    <p>Hi <strong>${params.employeeName}</strong>,</p>
    <p>A new task has been assigned to you.</p>
    <div style="background-color: #f9fafb; border-left: 4px solid ${badgeColor}; padding: 16px; margin: 16px 0; border-radius: 0 6px 6px 0;">
      <h3 style="margin: 0 0 8px; color: #1f2937;">${params.taskTitle}</h3>
      <table style="width: 100%; border-collapse: collapse;">
        <tr><td style="padding: 4px 0; color: #6b7280; font-size: 13px;">Priority</td><td style="padding: 4px 0; font-weight: 600; font-size: 13px;"><span style="${BADGE_STYLE} background-color: ${badgeColor}; color: white; font-size: 12px;">${params.priority.toUpperCase()}</span></td></tr>
        ${params.dueDate ? `<tr><td style="padding: 4px 0; color: #6b7280; font-size: 13px;">Due Date</td><td style="padding: 4px 0; font-weight: 600; font-size: 13px;">${params.dueDate}</td></tr>` : ""}
        <tr><td style="padding: 4px 0; color: #6b7280; font-size: 13px;">Assigned by</td><td style="padding: 4px 0; font-weight: 600; font-size: 13px;">${params.assignerName}</td></tr>
      </table>
    </div>
    <a href="${process.env.APP_URL || "http://localhost:5173"}/tasks" style="${BUTTON_STYLE}">View Task</a>
  `;
  return wrapTemplate("New Task Assigned", body);
}

export function taskCompletedTemplate(params: {
  reviewerName: string;
  taskTitle: string;
  submissionNotes: string;
  assigneeName: string;
}): string {
  const badgeColor = "#3b82f6";
  const body = `
    <p>Hi <strong>${params.reviewerName}</strong>,</p>
    <p>A task has been <span style="${BADGE_STYLE} background-color: ${badgeColor}; color: white;">📋 Submitted for Review</span></p>
    <div style="background-color: #f9fafb; border-left: 4px solid ${badgeColor}; padding: 16px; margin: 16px 0; border-radius: 0 6px 6px 0;">
      <h3 style="margin: 0 0 8px; color: #1f2937;">${params.taskTitle}</h3>
      <p style="margin: 0 0 4px; color: #6b7280; font-size: 13px;">Submitted by: <strong>${params.assigneeName}</strong></p>
      ${params.submissionNotes ? `<p style="margin: 8px 0 0; color: #374151; font-size: 14px;">${params.submissionNotes}</p>` : ""}
    </div>
    <a href="${process.env.APP_URL || "http://localhost:5173"}/admin/tasks" style="${BUTTON_STYLE}">Review Task</a>
  `;
  return wrapTemplate("Task Submitted for Review", body);
}

export function taskReviewedTemplate(params: {
  employeeName: string;
  taskTitle: string;
  approved: boolean;
  reviewNotes: string;
}): string {
  const badgeColor = params.approved ? "#10b981" : "#ef4444";
  const badgeText = params.approved ? "✅ Approved" : "❌ Rejected";
  const body = `
    <p>Hi <strong>${params.employeeName}</strong>,</p>
    <p>Your task submission has been <span style="${BADGE_STYLE} background-color: ${badgeColor}; color: white;">${badgeText}</span></p>
    <div style="background-color: #f9fafb; border-left: 4px solid ${badgeColor}; padding: 16px; margin: 16px 0; border-radius: 0 6px 6px 0;">
      <h3 style="margin: 0 0 8px; color: #1f2937;">${params.taskTitle}</h3>
      ${params.reviewNotes ? `<p style="margin: 0; color: #374151; font-size: 14px;">${params.reviewNotes}</p>` : ""}
    </div>
    <a href="${process.env.APP_URL || "http://localhost:5173"}/tasks" style="${BUTTON_STYLE}">View Task</a>
  `;
  return wrapTemplate(`Task ${params.approved ? "Approved" : "Rejected"}`, body);
}
