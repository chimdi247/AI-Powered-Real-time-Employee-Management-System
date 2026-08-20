# Email Notifications via Resend

## Overview
Add email notifications for important events (leave approvals/rejections, feedback responses, announcements) using Resend. Emails are sent alongside existing in-app notifications. Emails fail silently — they never break the primary request.

## Architecture
- **Email service**: New `backend/src/lib/email.ts` — Resend SDK wrapper with `sendEmail()` and `sendBatchEmail()` helpers
- **Email templates**: HTML templates in the same file for each event type
- **Integration point**: `backend/src/lib/notifications.ts` — `notify()` and `notifyBatch()` now also send emails after creating in-app notifications
- **No new routes or models needed** — pure backend integration

## Events to Email
| Event | Recipients | Template |
|-------|-----------|----------|
| Leave approved | Leave owner | "Your {type} leave has been approved" |
| Leave rejected | Leave owner | "Your {type} leave has been rejected" |
| Feedback responded | Feedback author (non-anonymous) | "An admin responded to your feedback" |
| Announcement created | Department members | "New announcement: {title}" |

## Email Service (`backend/src/lib/email.ts`)
- Initialize Resend with `process.env.RESEND_API_KEY`
- `sendEmail({ to, subject, html })` — fire-and-forget, errors logged and swallowed
- `sendBatchEmails([{ to, subject, html }])` — batch send for announcements
- Use idempotency keys: `{event-type}/{recipient-id}/{entity-id}`
- From address: `process.env.FROM_EMAIL` (fallback: `onboarding@resend.dev`)
- From name: `process.env.FROM_NAME` (fallback: `EMS`)

## HTML Templates
- Clean, responsive HTML emails with inline styles
- Consistent branding: company name header, action color (#3b82f6), footer with "Employee Management System"
- Each template takes relevant data (employee name, leave dates, feedback message, announcement title)

## Integration (`backend/src/lib/notifications.ts`)
- After creating in-app notification in `notify()`, call `sendEmail()` for the recipient
- After creating batch notifications in `notifyBatch()`, call `sendBatchEmails()` for all recipients
- Look up recipient email from User model (cached in-memory per request)
- Emails are fire-and-forget — failures are caught and logged, never thrown

## Env Variables
```
RESEND_API_KEY=re_xxxxxxxxx    # Required for email delivery
FROM_EMAIL=ems@example.com     # Sender address (must match verified Resend domain)
FROM_NAME=EMS                  # Sender display name
```

## Files to Create
1. `backend/src/lib/email.ts` — Email service + templates

## Files to Modify
1. `backend/src/lib/notifications.ts` — Add email sending to notify/notifyBatch

## Verification
1. `cd backend && bun run typecheck` — must pass
2. Manual test: trigger a leave approval and verify email is sent (or logged in dev mode)
